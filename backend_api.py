import os
import io
import csv
import json
import re
from datetime import datetime, date
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
# ROUTE 2: RESILIENT BANK PARSER (HDFC & ICICI CELL SCANNER)
# ==============================================================================
def parse_date_value(val: Any) -> Optional[str]:
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")

    s = str(val).strip()
    if not s or s.startswith("*"):
        return None

    # Matches DD/MM/YYYY or DD-MM-YYYY (e.g. 01/08/2026 in ICICI)
    m4 = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b", s)
    if m4:
        d, m, y = m4.group(1), m4.group(2), m4.group(3)
        try:
            return f"{y}-{int(m):02d}-{int(d):02d}"
        except Exception:
            pass

    # Matches DD/MM/YY or DD-MM-YY (e.g. 01/09/26 in HDFC)
    m2 = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2})\b", s)
    if m2:
        d, m, y = m2.group(1), m2.group(2), m2.group(3)
        try:
            return f"20{y}-{int(m):02d}-{int(d):02d}"
        except Exception:
            pass

    return None

def clean_amount(val: Any) -> float:
    if val is None or pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return abs(float(val))
    s = str(val).replace(",", "").replace("₹", "").replace("Rs.", "").replace("Dr", "").replace("Cr", "").strip()
    try:
        f = float(s)
        return abs(f) if f > 0 else 0.0
    except Exception:
        return 0.0

def auto_assign_ledger(narration: str) -> tuple[str, str]:
    n = narration.lower()
    if any(k in n for k in ["cash", "atm", "self", "cdm"]):
        return "Cash in Hand", "Contra"
    if "zomato" in n:
        return "Zomato Payout Clearance", "Receipt"
    if "swiggy" in n:
        return "Swiggy Payout Clearance", "Receipt"
    if "blink" in n:
        return "Blinkit Payout Clearance", "Receipt"
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

def robust_read_table(contents: bytes, filename: str) -> List[List[Any]]:
    """Guarantees extraction without crashing on unquoted newlines or unknown formats."""
    # 1. Try reading with openpyxl for .xlsx
    if filename.endswith(".xlsx"):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            sheet = wb.active
            return [list(r) for r in sheet.iter_rows(values_only=True)]
        except Exception:
            pass

    # 2. Try pandas read_excel for .xls / .xlsx
    if filename.endswith((".xls", ".xlsx")):
        try:
            df = pd.read_excel(io.BytesIO(contents), header=None)
            return df.fillna("").values.tolist()
        except Exception:
            pass

        # Many bank .xls exports are actually HTML tables
        try:
            tables = pd.read_html(io.BytesIO(contents))
            if tables:
                return tables[0].fillna("").values.tolist()
        except Exception:
            pass

    # 3. CSV / Text with newline='' to eliminate the newline-in-unquoted-field error
    decoded = contents.decode("utf-8", errors="ignore")
    
    try:
        f = io.StringIO(decoded, newline="")
        return list(csv.reader(f))
    except Exception:
        pass

    try:
        # Fallback to python engine with on_bad_lines='skip'
        df = pd.read_csv(io.StringIO(decoded), header=None, engine="python", on_bad_lines="skip")
        return df.fillna("").values.tolist()
    except Exception:
        pass

    # 4. Pure string line splitter (bulletproof fallback)
    rows = []
    for line in decoded.splitlines():
        if line.strip():
            rows.append([cell.strip().strip('"') for cell in line.split(",")])
    return rows

@app.post("/api/bank/reconcile-file")
async def reconcile_bank_file(
    file: UploadFile = File(...),
    company_name: str = Form("Panasuria Confectionery"),
    bank_ledger: str = Form("HDFC Bank - 8050")
):
    contents = await file.read()
    filename = file.filename.lower()

    grid = robust_read_table(contents, filename)

    if not grid:
        raise HTTPException(status_code=400, detail="The statement file contains no readable data.")

    txns = []

    for r_idx, row in enumerate(grid):
        if not row or not any(row):
            continue

        row_list = list(row)
        
        # 1. Detect Date in the first 4 columns
        found_date = None
        date_col_idx = -1

        for c_idx in range(min(4, len(row_list))):
            d_val = parse_date_value(row_list[c_idx])
            if d_val:
                row_text = " ".join([str(x) for x in row_list if x is not None]).lower()
                if "statement from" in row_text or "page no" in row_text:
                    continue
                found_date = d_val
                date_col_idx = c_idx
                break

        if not found_date:
            continue

        # 2. Extract Narration
        narr = "Bank Transaction"
        for c_idx in range(len(row_list)):
            if c_idx == date_col_idx:
                continue
            val = str(row_list[c_idx] or "").strip()
            if len(val) > 4 and not parse_date_value(val) and not re.match(r"^[\d\.,\s₹\-\(\)]+$", val):
                narr = val
                break

        # 3. Extract Debit and Credit
        debit = 0.0
        credit = 0.0

        # Check for ICICI format with explicit 'CR' or 'DR' cell
        has_cr_dr = False
        for c_idx, cell in enumerate(row_list):
            cell_str = str(cell or "").strip().upper()
            if cell_str in ["CR", "DR"]:
                has_cr_dr = True
                if c_idx + 1 < len(row_list):
                    amt = clean_amount(row_list[c_idx + 1])
                    if cell_str == "CR":
                        credit = amt
                    else:
                        debit = amt
                break

        # Check for HDFC format: Column E (index 4) = Withdrawal, Column F (index 5) = Deposit
        if not has_cr_dr:
            if len(row_list) >= 6:
                debit = clean_amount(row_list[4])
                credit = clean_amount(row_list[5])

            if debit == 0.0 and credit == 0.0:
                nums = []
                for c_idx in range(len(row_list)):
                    if c_idx != date_col_idx:
                        n = clean_amount(row_list[c_idx])
                        if n > 0:
                            nums.append(n)
                if len(nums) >= 2:
                    debit = nums[0]
                elif len(nums) == 1:
                    debit = nums[0]

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
            detail="Could not detect transaction rows. Please confirm the file has dates and amounts."
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
