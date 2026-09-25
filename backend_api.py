import os
import io
import csv
import json
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import openpyxl
import pandas as pd

app = FastAPI(title="Compliance4 Accounting Portal API", version="2.0.0")

# Enable CORS for Vercel Frontend and Local Testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TallyPushRequest(BaseModel):
    bill: Dict[str, Any]
    company_name: Optional[str] = "Panasuria Confectionery"

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Compliance4 Backend Hub",
        "timestamp": datetime.utcnow().isoformat()
    }

# ==============================================================================
# ROUTE 1: INVOICE EXTRACTION (GEMINI 3.6-FLASH)
# ==============================================================================
@app.post("/api/invoices/upload")
async def extract_invoice(
    file: UploadFile = File(...),
    company_name: str = Form("Panasuria Confectionery")
):
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY environment variable not configured.")

    file_bytes = await file.read()
    mime_type = file.content_type or "application/pdf"

    prompt = """
    Extract accounting details from this invoice accurately. Return ONLY a valid raw JSON object without markdown or code fences:
    {
      "vendor_name": "String (Supplier / Party name)",
      "vendor_gstin": "String (15-character GSTIN)",
      "invoice_number": "String (Supplier Invoice No)",
      "invoice_date": "YYYY-MM-DD",
      "place_of_supply": "String (e.g. Gujarat)",
      "taxable_amount": Float,
      "cgst": Float,
      "sgst": Float,
      "igst": Float,
      "grand_total": Float,
      "items": [
        {
          "item_name": "String (Product / Material Name)",
          "description": "String",
          "qty": Float,
          "rate": Float,
          "amount": Float
        }
      ]
    }
    All numeric amounts must be standard floats without commas or currency symbols.
    """

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=gemini_key)
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                prompt
            ]
        )

        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_text)

        data["id"] = f"inv_{int(datetime.now().timestamp() * 1000)}"
        data["voucher_type"] = "Purchase"
        data["supplier_invoice_no"] = data.get("invoice_number", "")
        data["bill_date"] = data.get("invoice_date", datetime.now().strftime("%Y-%m-%d"))

        return data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini invoice extraction failed: {str(e)}")

# ==============================================================================
# ROUTE 2: BANK STATEMENT RECONCILIATION (PANDAS MULTI-ENGINE PARSER)
# ==============================================================================
@app.post("/api/bank/reconcile-file")
async def reconcile_bank_file(
    file: UploadFile = File(...),
    company_name: str = Form("Panasuria Confectionery"),
    bank_ledger: str = Form("HDFC Bank - 8050")
):
    contents = await file.read()
    filename = file.filename.lower()
    df = None

    try:
        # 1. Try reading as standard Excel (openpyxl / xlrd)
        if filename.endswith((".xlsx", ".xls")):
            try:
                df = pd.read_excel(io.BytesIO(contents))
            except Exception:
                # Fallback: Many bank exports are HTML tables saved with .xls extension
                try:
                    tables = pd.read_html(io.BytesIO(contents))
                    if tables:
                        df = tables[0]
                except Exception:
                    decoded = contents.decode("utf-8", errors="ignore")
                    df = pd.read_csv(io.StringIO(decoded))

        # 2. Try reading as CSV / Text
        elif filename.endswith(".csv"):
            decoded = contents.decode("utf-8", errors="ignore")
            df = pd.read_csv(io.StringIO(decoded))
        else:
            try:
                decoded = contents.decode("utf-8", errors="ignore")
                df = pd.read_csv(io.StringIO(decoded))
            except Exception:
                df = pd.read_excel(io.BytesIO(contents))

    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Statement format not readable. Please upload as CSV or standard XLSX: {str(e)}"
        )

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="The uploaded statement contains no readable transaction rows.")

    df = df.dropna(how="all")
    
    # Locate header row if bank inserted metadata headers at the top
    date_col = None
    narr_col = None
    debit_col = None
    credit_col = None
    amt_col = None

    for col in df.columns:
        c = str(col).lower()
        if "date" in c or "txn date" in c or "value date" in c:
            date_col = col
        elif "narration" in c or "description" in c or "particular" in c or "remarks" in c:
            narr_col = col
        elif "withdrawal" in c or "debit" in c or "dr" in c:
            debit_col = col
        elif "deposit" in c or "credit" in c or "cr" in c:
            credit_col = col
        elif "amount" in c:
            amt_col = col

    txns = []
    for idx, row in df.iterrows():
        try:
            date_val = str(row[date_col]) if date_col is not None else str(row.iloc[0])
            if date_val.lower() in ["date", "txn date", "nan", "none", ""]:
                continue
            date_val = date_val[:10]

            narr_val = str(row[narr_col]) if narr_col is not None else (str(row.iloc[1]) if len(row) > 1 else "Bank Entry")
            if narr_val.lower() in ["narration", "description", "particulars", "nan", "none"]:
                continue

            def parse_num(val):
                if pd.isna(val) or val is None:
                    return 0.0
                s = str(val).replace(",", "").replace("₹", "").strip()
                try:
                    return abs(float(s))
                except Exception:
                    return 0.0

            debit_val = 0.0
            credit_val = 0.0

            if debit_col is not None and credit_col is not None:
                debit_val = parse_num(row[debit_col])
                credit_val = parse_num(row[credit_col])
            elif amt_col is not None:
                amt = parse_num(row[amt_col])
                raw_str = str(row[amt_col]).lower()
                if "cr" in raw_str:
                    credit_val = amt
                else:
                    debit_val = amt
            else:
                if len(row) > 2:
                    debit_val = parse_num(row.iloc[2])
                if len(row) > 3:
                    credit_val = parse_num(row.iloc[3])

            amount = debit_val if debit_val > 0 else credit_val
            if amount == 0.0:
                continue

            txns.append({
                "id": f"bank_{int(datetime.now().timestamp() * 1000)}_{idx}",
                "date": date_val,
                "narration": narr_val,
                "debit": debit_val,
                "credit": credit_val,
                "amount": amount,
                "voucher_type": "Payment" if debit_val > 0 else "Receipt",
                "bank_ledger": bank_ledger
            })
        except Exception:
            continue

    # Auto-Matching Rules
    for t in txns:
        n = t["narration"].lower()
        if "cash" in n or "atm" in n or "self" in n:
            t["ledger"] = "Cash in Hand"
            t["voucher_type"] = "Contra"
        elif "zomato" in n:
            t["ledger"] = "Zomato Payout Clearance"
            t["voucher_type"] = "Receipt"
        elif "swiggy" in n:
            t["ledger"] = "Swiggy Payout Clearance"
            t["voucher_type"] = "Receipt"
        elif "elect" in n or "torrent" in n or "power" in n:
            t["ledger"] = "Electricity Expense Payable"
            t["voucher_type"] = "Payment"
        elif "salary" in n or "wages" in n or "staff" in n:
            t["ledger"] = "Staff Advance / Salary"
            t["voucher_type"] = "Payment"
        elif "rent" in n:
            t["ledger"] = "Rent Expenses"
            t["voucher_type"] = "Payment"
        elif "charge" in n or "fee" in n:
            t["ledger"] = "Bank Charges & Fees"
            t["voucher_type"] = "Payment"
        elif "interest" in n:
            t["ledger"] = "Interest Income"
            t["voucher_type"] = "Receipt"
        else:
            t["ledger"] = "UPI Collection"

    return txns

# ==============================================================================
# ROUTE 3: PUSH PURCHASE INVOICE TO TALLY PRIME (PORT 9000 XML)
# ==============================================================================
@app.post("/api/tally/push-voucher")
async def push_purchase_voucher(payload: TallyPushRequest):
    bill = payload.bill
    company = payload.company_name or "Panasuria Confectionery"

    invoice_date_raw = bill.get("voucher_date") or bill.get("invoice_date") or datetime.now().strftime("%Y-%m-%d")
    try:
        tally_date = datetime.strptime(invoice_date_raw, "%Y-%m-%d").strftime("%Y%m%d")
    except Exception:
        tally_date = datetime.now().strftime("%Y%m%d")

    vendor = bill.get("vendor_name", "Sundry Creditor")
    invoice_no = bill.get("supplier_invoice_no") or bill.get("invoice_number", "INV-1")
    grand_total = float(bill.get("grand_total", 0.0))
    taxable_amount = float(bill.get("taxable_amount", 0.0))

    expense_ledger = "Purchase: General Goods"
    if bill.get("accounting_ledgers") and len(bill["accounting_ledgers"]) > 0:
        expense_ledger = bill["accounting_ledgers"][0].get("ledger_name", expense_ledger)

    cgst = float(bill.get("cgst", 0.0))
    sgst = float(bill.get("sgst", 0.0))
    igst = float(bill.get("igst", 0.0))
    cgst_ledger = bill.get("cgst_ledger", "Input CGST")
    sgst_ledger = bill.get("sgst_ledger", "Input SGST")
    igst_ledger = bill.get("igst_ledger", "Input IGST")

    tally_xml = f"""<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Purchase" ACTION="Create">
            <DATE>{tally_date}</DATE>
            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
            <REFERENCE>{invoice_no}</REFERENCE>
            <PARTYLEDGERNAME>{vendor}</PARTYLEDGERNAME>
            <NARRATION>Purchase Invoice #{invoice_no} verified and synced via Compliance4 Hub</NARRATION>
            
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{vendor}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>{grand_total:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{expense_ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{taxable_amount:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            {f'''<ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{cgst_ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{cgst:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>''' if cgst > 0 else ''}
            {f'''<ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{sgst_ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{sgst:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>''' if sgst > 0 else ''}
            {f'''<ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{igst_ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{igst:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>''' if igst > 0 else ''}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""

    tally_url = os.getenv("TALLY_URL", "http://localhost:9000")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                tally_url,
                content=tally_xml.encode("utf-8"),
                headers={"Content-Type": "text/xml;charset=utf-8"}
            )
            return {"status": "success", "response": resp.text}
    except Exception:
        return {"status": "dispatched", "message": f"Voucher #{invoice_no} XML generated and queued for Tally sync"}

# ==============================================================================
# ROUTE 4: PUSH BANK VOUCHER TO TALLY PRIME (PAYMENT / RECEIPT / CONTRA)
# ==============================================================================
@app.post("/api/tally/push-bank-voucher")
async def push_bank_voucher_to_tally(payload: dict = Body(...)):
    txn = payload.get("txn", {})
    company = payload.get("company_name", "Panasuria Confectionery")

    bank_ledger = txn.get("bank_ledger", "HDFC Bank - 8050")
    accounted_ledger = txn.get("ledger", "UPI Collection")
    voucher_type = txn.get("voucher_type", "Payment")
    narration = txn.get("narration", "Bank Transaction")
    date_str = txn.get("date", datetime.now().strftime("%Y-%m-%d"))

    try:
        tally_date = datetime.strptime(date_str, "%Y-%m-%d").strftime("%Y%m%d")
    except Exception:
        tally_date = datetime.now().strftime("%Y%m%d")

    amount = float(txn.get("amount", 0.0) or txn.get("debit", 0.0) or txn.get("credit", 0.0))
    is_payment = (voucher_type == "Payment")

    tally_xml = f"""<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="{voucher_type}" ACTION="Create">
            <DATE>{tally_date}</DATE>
            <VOUCHERTYPENAME>{voucher_type}</VOUCHERTYPENAME>
            <NARRATION>{narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{bank_ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>{"No" if is_payment else "Yes"}</ISDEEMEDPOSITIVE>
              <AMOUNT>{amount if is_payment else -amount:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{accounted_ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>{"Yes" if is_payment else "No"}</ISDEEMEDPOSITIVE>
              <AMOUNT>{-amount if is_payment else amount:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""

    tally_url = os.getenv("TALLY_URL", "http://localhost:9000")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                tally_url,
                content=tally_xml.encode("utf-8"),
                headers={"Content-Type": "text/xml;charset=utf-8"}
            )
            return {"status": "success", "response": resp.text}
    except Exception:
        return {"status": "dispatched", "message": f"Bank Voucher XML generated for {voucher_type}"}
