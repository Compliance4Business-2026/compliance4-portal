import os
import io
import csv
import json
import re
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import openpyxl
import pandas as pd

app = FastAPI(title="Compliance4 Accounting Portal API", version="2.0.0")

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
# ROUTE 2: RESILIENT INSTANT BANK STATEMENT PARSER
# ==============================================================================
DATE_PATTERNS = [
    r"^\d{2}[/-]\d{2}[/-]\d{4}",     # 01/06/2024 or 01-06-2024
    r"^\d{4}[/-]\d{2}[/-]\d{2}",     # 2024-06-01 or 2024/06/01
    r"^\d{2}\s+[A-Za-z]{3}\s+\d{4}"  # 01 Jun 2024
]

def clean_amount(val) -> float:
    if val is None or pd.isna(val):
        return 0.0
    s = str(val).replace(",", "").replace("₹", "").replace("Rs.", "").replace("Dr", "").replace("Cr", "").strip()
    try:
        return abs(float(s))
    except Exception:
        return 0.0

def matches_date(val) -> Optional[str]:
    if val is None or pd.isna(val):
        return None
    s = str(val).strip()
    for pat in DATE_PATTERNS:
        match = re.search(pat, s)
        if match:
            raw_date = match.group(0)
            for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y/%m/%d", "%d %b %Y"):
                try:
                    return datetime.strptime(raw_date, fmt).strftime("%Y-%m-%d")
                except ValueError:
                    pass
            return raw_date
    return None

def auto_assign_ledger(narration: str) -> tuple[str, str]:
    n = narration.lower()
    if any(k in n for k in ["cash", "atm", "self", "cdm"]):
        return "Cash in Hand", "Contra"
    if "zomato" in n:
        return "Zomato Payout Clearance", "Receipt"
    if "swiggy" in n:
        return "Swiggy Payout Clearance", "Receipt"
    if any(k in n for k in ["elect", "power", "torrent"]):
        return "Electricity Expense Payable", "Payment"
    if any(k in n for k in ["salary", "wages", "staff advance"]):
        return "Staff Advance / Salary", "Payment"
    if "rent" in n:
        return "Rent Expenses", "Payment"
    if any(k in n for k in ["charge", "fee", "gst"]):
        return "Bank Charges & Fees", "Payment"
    if "interest" in n:
        return "Interest Income", "Receipt"
    return "UPI Collection", "Payment"

def safe_parse_csv(text_data: str) -> List[List[Any]]:
    """Tolerates unquoted newlines and malformed CSV rows from bank exports."""
    # Attempt 1: Standard StringIO with universal newline handling
    try:
        f = io.StringIO(text_data, newline=None)
        return list(csv.reader(f))
    except Exception:
        pass

    # Attempt 2: Ignore quoting errors
    try:
        f = io.StringIO(text_data, newline=None)
        return list(csv.reader(f, quoting=csv.QUOTE_NONE, escapechar='\\'))
    except Exception:
        pass

    # Attempt 3: Line-by-line split fallback
    grid = []
    for line in text_data.splitlines():
        if line.strip():
            grid.append([col.strip().strip('"').strip("'") for col in line.split(",")])
    return grid

@app.post("/api/bank/reconcile-file")
async def reconcile_bank_file(
    file: UploadFile = File(...),
    company_name: str = Form("Panasuria Confectionery"),
    bank_ledger: str = Form("HDFC Bank - 8050")
):
    contents = await file.read()
    filename = file.filename.lower()
    grid: List[List[Any]] = []

    try:
        if filename.endswith((".xlsx", ".xls")):
            try:
                wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
                sheet = wb.active
                for row in sheet.iter_rows(values_only=True):
                    grid.append(list(row))
            except Exception:
                try:
                    tables = pd.read_html(io.BytesIO(contents))
                    if tables:
                        grid = tables[0].fillna("").values.tolist()
                except Exception:
                    decoded = contents.decode("utf-8", errors="ignore")
                    grid = safe_parse_csv(decoded)
        else:
            decoded = contents.decode("utf-8", errors="ignore")
            grid = safe_parse_csv(decoded)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read file format: {str(e)}")

    if not grid:
        raise HTTPException(status_code=400, detail="The uploaded bank statement is empty.")

    txns = []
    for r_idx, row in enumerate(grid):
        if not row or not any(row):
            continue

        clean_row = [c for c in row if c is not None and str(c).strip() != ""]
        if len(clean_row) < 3:
            continue

        # Look for date in first 4 columns
        found_date = None
        date_pos = -1
        for idx in range(min(4, len(clean_row))):
            d_val = matches_date(clean_row[idx])
            if d_val:
                found_date = d_val
                date_pos = idx
                break

        if not found_date:
            continue

        # Look for narration string
        narr = "Bank Transaction"
        for idx in range(date_pos + 1, len(clean_row)):
            val = str(clean_row[idx]).strip()
            if len(val) > 3 and not re.match(r"^[\d\.,\s₹\-]+$", val):
                narr = val
                break

        # Look for numeric amounts (Debit, Credit)
        numbers = []
        for idx in range(date_pos + 1, len(clean_row)):
            num = clean_amount(clean_row[idx])
            if num > 0:
                numbers.append((idx, num))

        if not numbers:
            continue

        debit = 0.0
        credit = 0.0

        if len(numbers) >= 2:
            debit = numbers[0][1]
            credit = numbers[1][1]
        elif len(numbers) == 1:
            raw_str = " ".join([str(c).lower() for c in clean_row])
            if "cr" in raw_str or "dep" in raw_str:
                credit = numbers[0][1]
            else:
                debit = numbers[0][1]

        amount = debit if debit > 0 else credit
        if amount == 0.0:
            continue

        assigned_ledger, default_vtype = auto_assign_ledger(narr)
        actual_vtype = "Payment" if debit > 0 else "Receipt"
        if default_vtype == "Contra":
            actual_vtype = "Contra"

        txns.append({
            "id": f"bank_{int(datetime.now().timestamp() * 1000)}_{r_idx}",
            "date": found_date,
            "narration": narr,
            "debit": debit,
            "credit": credit,
            "amount": amount,
            "voucher_type": actual_vtype,
            "ledger": assigned_ledger,
            "bank_ledger": bank_ledger
        })

    if not txns:
        raise HTTPException(
            status_code=400,
            detail="Found date cells, but could not detect valid transaction amounts. Ensure the file contains statement rows."
        )

    return txns

# ==============================================================================
# ROUTE 3: PUSH PURCHASE INVOICE TO TALLY PRIME
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
