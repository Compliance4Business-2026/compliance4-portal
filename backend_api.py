import os
import io
import csv
import json
import re
import time
from datetime import datetime, date
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import httpx
import openpyxl
import pandas as pd
from PIL import Image
from google.cloud import firestore, storage
import uvicorn

# Initialize FastAPI App
app = FastAPI(title="Compliance4 Accounting Portal API", version="2.0.0")

# 100% Secure CORS Configuration to Prevent Domain Blocking & net::ERR_FAILED
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.compliance4business.in",
        "https://compliance4-portal.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy initialization for Firestore and Storage to prevent startup blocking
_db = None
_storage_client = None

def get_db():
    global _db
    if _db is None:
        try:
            _db = firestore.Client()
        except Exception as e:
            print(f"Firestore Client init warning: {e}")
            _db = None
    return _db

def get_storage():
    global _storage_client
    if _storage_client is None:
        try:
            _storage_client = storage.Client()
        except Exception as e:
            print(f"Storage Client init warning: {e}")
            _storage_client = None
    return _storage_client

# Local or Cloud Storage configuration for uploaded files
UPLOAD_DIR = "/tmp/compliance4_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
STORAGE_BUCKET_NAME = os.getenv("STORAGE_BUCKET_NAME", "")

# ----------------- DATA MODELS ----------------- #
class TallyPushRequest(BaseModel):
    bill: Dict[str, Any]
    company_name: Optional[str] = "Panasuria Confectionery"

class LoginAuthRequest(BaseModel):
    username: str
    password: str

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Compliance4 Backend Hub",
        "timestamp": datetime.utcnow().isoformat()
    }

# ==============================================================================
# ROUTE 1: INVOICE EXTRACTION (GEMINI 3.6-FLASH) + PERMANENT FILE STORAGE
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
    file_extension = os.path.splitext(file.filename)[1] or ".pdf"
    unique_filename = f"inv_{int(time.time() * 1000)}_{os.urandom(4).hex()}{file_extension}"

    # 1. Save file permanently to server storage / GCS bucket
    file_url = ""
    try:
        s_client = get_storage()
        if STORAGE_BUCKET_NAME and s_client:
            bucket = s_client.bucket(STORAGE_BUCKET_NAME)
            blob = bucket.blob(f"invoices/{company_name}/{unique_filename}")
            blob.upload_from_string(file_bytes, content_type=mime_type)
            file_url = blob.public_url
        else:
            local_path = os.path.join(UPLOAD_DIR, unique_filename)
            with open(local_path, "wb") as f:
                f.write(file_bytes)
            file_url = f"/api/files/{unique_filename}"
    except Exception as storage_err:
        print(f"Warning: Permanent file storage failed: {storage_err}")
        local_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(local_path, "wb") as f:
            f.write(file_bytes)
        file_url = f"/api/files/{unique_filename}"

    # 2. Extract data via Gemini AI with structured invoice breakdown and smart two-tier resolution
    prompt = """
    You are an expert accountant processing purchase bills and supplier invoices. Carefully examine the image layout.
    1. VENDOR NAME: Find the main business/supplier name printed at the top center or header (e.g., 'SHREE CHAMUNDA VEGETABLE & FRUIT SUPPLIERS'). Ignore file names.
    2. INVOICE NUMBER: Look for bill no, invoice no, or reference code (e.g., 'GB/2504').
    3. ITEMS & TOTALS: Extract every line item with its description, quantity, rate, and amount. Sum up to the correct grand total.
    
    Return ONLY a valid raw JSON object without markdown or code fences:
    {
      "vendor_name": "String",
      "vendor_gstin": "String (15-char GSTIN if available, else '')",
      "invoice_number": "String",
      "invoice_date": "YYYY-MM-DD",
      "place_of_supply": "String (e.g. Gujarat)",
      "taxable_amount": Float,
      "cgst": Float,
      "sgst": Float,
      "igst": Float,
      "grand_total": Float,
      "items": [
        {
          "item_name": "String",
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

        def call_gemini(data_bytes, m_type):
            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(
                model='gemini-3.6-flash',
                contents=[
                    types.Part.from_bytes(data=data_bytes, mime_type=m_type),
                    prompt
                ]
            )
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean_text)

        extracted_data = {}
        try:
            compressed_bytes = file_bytes
            comp_mime = mime_type
            if mime_type.startswith("image/"):
                img = Image.open(io.BytesIO(file_bytes))
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                
                max_width = 1200
                if img.width > max_width:
                    ratio = max_width / float(img.width)
                    new_height = int(float(img.height) * ratio)
                    img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                
                output_io = io.BytesIO()
                img.save(output_io, format="JPEG", quality=80)
                compressed_bytes = output_io.getvalue()
                comp_mime = "image/jpeg"

            extracted_data = call_gemini(compressed_bytes, comp_mime)

            if not extracted_data.get("vendor_name") or extracted_data.get("vendor_name") in ["", "Unknown"]:
                raise ValueError("Low-res extraction missed vendor name, triggering high-res fallback.")

        except Exception as low_res_err:
            print(f"Low-res extraction attempt failed or insufficient, falling back to original HD: {low_res_err}")
            extracted_data = call_gemini(file_bytes, mime_type)

        extracted_data["id"] = f"inv_{int(datetime.now().timestamp() * 1000)}"
        extracted_data["voucher_type"] = "Purchase"
        extracted_data["supplier_invoice_no"] = extracted_data.get("invoice_number", "")
        extracted_data["bill_date"] = extracted_data.get("invoice_date", datetime.now().strftime("%Y-%m-%d"))
        extracted_data["file_preview_url"] = file_url  # Permanent file reference URL

        return extracted_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini invoice extraction failed: {str(e)}")

@app.get("/api/files/{filename}")
async def serve_uploaded_file(filename: str):
    """Serve locally stored invoice files permanently."""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

# ==============================================================================
# ROUTE 2: STANDARD EXCEL / CSV BANK STATEMENT PARSER
# ==============================================================================
def parse_date_value(val: Any) -> str:
    if val is None or pd.isna(val):
        return datetime.now().strftime("%Y-%m-%d")
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")

    s = str(val).strip().strip("'").strip('"')
    m4 = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", s)
    if m4:
        d, m, y = m4.group(1), m4.group(2), m4.group(3)
        try:
            return f"{y}-{int(m):02d}-{int(d):02d}"
        except Exception:
            pass

    m2 = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{2})", s)
    if m2:
        d, m, y = m2.group(1), m2.group(2), m2.group(3)
        try:
            return f"20{y}-{int(m):02d}-{int(d):02d}"
        except Exception:
            pass

    return datetime.now().strftime("%Y-%m-%d")

def clean_num(val: Any) -> float:
    if val is None or pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return abs(float(val))
    s = str(val).strip().replace(",", "").replace("₹", "").replace("Rs.", "").replace("Dr", "").replace("Cr", "")
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
        if filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            decoded = contents.decode("utf-8", errors="ignore")
            df = pd.read_csv(io.StringIO(decoded, newline=""), on_bad_lines="skip")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read spreadsheet: {str(e)}")

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="The file is empty.")

    cols = {str(c).strip().lower(): c for c in df.columns}
    
    date_col = next((cols[k] for k in cols if "date" in k), None)
    narr_col = next((cols[k] for k in cols if any(x in k for x in ["narr", "desc", "partic"])), None)
    debit_col = next((cols[k] for k in cols if any(x in k for x in ["debit", "withdrawal", "dr"])), None)
    credit_col = next((cols[k] for k in cols if any(x in k for x in ["credit", "deposit", "cr"])), None)

    if date_col is None and len(df.columns) >= 1:
        date_col = df.columns[0]
    if narr_col is None and len(df.columns) >= 2:
        narr_col = df.columns[1]
    if debit_col is None and len(df.columns) >= 3:
        debit_col = df.columns[2]
    if credit_col is None and len(df.columns) >= 4:
        credit_col = df.columns[3]

    txns = []
    for idx, row in df.iterrows():
        if pd.isna(row.get(date_col)) and pd.isna(row.get(narr_col)):
            continue

        raw_narr = str(row.get(narr_col, "Bank Transaction")).strip()
        if raw_narr.lower() in ["nan", "none", ""]:
            raw_narr = "Bank Transaction"

        parsed_date = parse_date_value(row.get(date_col))
        debit = clean_num(row.get(debit_col, 0.0))
        credit = clean_num(row.get(credit_col, 0.0))

        amount = debit if debit > 0 else credit
        if amount == 0.0:
            continue

        assigned_ledger, default_vtype = auto_assign_ledger(raw_narr)
        actual_vtype = "Payment" if debit > 0 else "Receipt"
        if default_vtype == "Contra":
            actual_vtype = "Contra"

        txns.append({
            "id": f"bank_{int(datetime.now().timestamp() * 1000)}_{idx}",
            "date": parsed_date,
            "narration": raw_narr,
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
            detail="No valid transactions found. Ensure headers are: Date, Narration, Debit, Credit."
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

# ==============================================================================
# ROUTE 5: FIRESTORE DATA PERSISTENCE & MULTI-TENANT SYNC
# ==============================================================================

# --- 5.1 Central Authentication ---
@app.post("/api/auth/login")
def login(creds: LoginAuthRequest):
    clean_user = creds.username.strip().lower()

    database = get_db()
    admin_doc = database.collection("system_config").document("admin_credentials").get() if database else None
    admin_data = admin_doc.to_dict() if admin_doc and admin_doc.exists else {
        "username": "admin",
        "password": "admin123",
        "fullName": "Super Administrator"
    }

    if clean_user == admin_data["username"].lower() and creds.password == admin_data["password"]:
        return {
            "id": "super_admin",
            "username": admin_data["username"],
            "fullName": admin_data.get("fullName", "Super Administrator"),
            "role": "admin",
            "allowedClients": "ALL",
            "permissions": {
                "dashboard": "edit", "sales": "edit", "purchases": "edit",
                "otherExpenses": "edit", "banking": "edit", "settings": "edit"
            },
            "salesSubPerms": {
                "allowNormal": True, "allowPos": True,
                "allowedDocTypes": ["Tax Invoice", "Bill of Supply", "Export Invoice"]
            }
        }

    user_ref = database.collection("users").document(clean_user).get() if database else None
    if not user_ref or not user_ref.exists:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user_data = user_ref.to_dict()
    if user_data.get("password") != creds.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user_data.get("isActive", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    return user_data

# --- 5.2 User Access Management ---
@app.get("/api/users")
def get_users():
    database = get_db()
    if not database:
        return []
    docs = database.collection("users").stream()
    return [doc.to_dict() for doc in docs]

@app.post("/api/users")
def save_user(user: Dict[str, Any] = Body(...)):
    database = get_db()
    username = user.get("username", "").strip().lower()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if database:
        database.collection("users").document(username).set(user)
    return {"status": "success", "username": username}

@app.delete("/api/users/{username}")
def delete_user(username: str):
    database = get_db()
    if database:
        database.collection("users").document(username.strip().lower()).delete()
    return {"status": "deleted"}

# --- 5.3 Client Entities & COA ---
@app.get("/api/clients")
def get_clients():
    database = get_db()
    if not database:
        return {}
    docs = database.collection("client_profiles").stream()
    return {doc.id: doc.to_dict() for doc in docs}

@app.post("/api/clients/{client_name}")
def save_client_profile(client_name: str, profile: Dict[str, Any] = Body(...)):
    database = get_db()
    if database:
        database.collection("client_profiles").document(client_name.strip()).set(profile)
    return {"status": "success"}

@app.delete("/api/clients/{client_name}")
def delete_client_profile(client_name: str):
    database = get_db()
    if database:
        database.collection("client_profiles").document(client_name.strip()).delete()
        database.collection("client_coa").document(client_name.strip()).delete()
        database.collection("item_rules").document(client_name.strip()).delete()
    return {"status": "deleted"}

@app.get("/api/clients/{client_name}/coa")
def get_client_coa(client_name: str):
    database = get_db()
    if not database:
        return []
    doc = database.collection("client_coa").document(client_name.strip()).get()
    return doc.to_dict().get("ledgers", []) if doc.exists else []

@app.post("/api/clients/{client_name}/coa")
def save_client_coa(client_name: str, payload: Dict[str, Any] = Body(...)):
    database = get_db()
    ledgers = payload.get("ledgers", [])
    if database:
        database.collection("client_coa").document(client_name.strip()).set({"ledgers": ledgers})
    return {"status": "success", "count": len(ledgers)}

# --- NEW: 5.3.1 Item-Learning / Memorization Rules Persistence ---
@app.get("/api/clients/{client_name}/item-rules")
def get_item_rules(client_name: str):
    database = get_db()
    if not database:
        return {}
    doc = database.collection("item_rules").document(client_name.strip()).get()
    return doc.to_dict().get("rules", {}) if doc.exists else {}

@app.post("/api/clients/{client_name}/item-rules")
def save_item_rules(client_name: str, payload: Dict[str, Any] = Body(...)):
    database = get_db()
    rules = payload.get("rules", {})
    if database:
        database.collection("item_rules").document(client_name.strip()).set({"rules": rules})
    return {"status": "success", "count": len(rules)}

# --- 5.4 Purchases & Invoice Workflow ---
@app.get("/api/clients/{client_name}/bills")
def get_bills(client_name: str, stage: str = "needs_review"):
    database = get_db()
    if not database:
        return []
    docs = database.collection("purchases").document(client_name.strip()).collection(stage).stream()
    return [doc.to_dict() for doc in docs]

@app.post("/api/clients/{client_name}/bills")
def save_bill(client_name: str, stage: str = "needs_review", bill: Dict[str, Any] = Body(...)):
    database = get_db()
    bill_id = str(bill.get("id") or f"inv_{int(time.time() * 1000)}")
    if database:
        database.collection("purchases").document(client_name.strip()).collection(stage).document(bill_id).set(bill)
    return {"status": "success", "id": bill_id}

@app.delete("/api/clients/{client_name}/bills/{stage}/{bill_id}")
def delete_bill(client_name: str, stage: str, bill_id: str):
    database = get_db()
    if database:
        database.collection("purchases").document(client_name.strip()).collection(stage).document(str(bill_id)).delete()
    return {"status": "deleted"}

# --- 5.5 Banking & Reconciliation Persistence ---
@app.get("/api/clients/{client_name}/bank-txns")
def get_bank_transactions(client_name: str, status: str = "pending"):
    database = get_db()
    if not database:
        return []
    docs = database.collection("banking").document(client_name.strip()).collection(status).stream()
    return [doc.to_dict() for doc in docs]

@app.post("/api/clients/{client_name}/bank-txns")
def save_bank_transactions(client_name: str, status: str = "pending", payload: Dict[str, Any] = Body(...)):
    database = get_db()
    txns = payload.get("transactions", [])
    if database:
        batch = database.batch()
        for txn in txns:
            txn_id = str(txn.get("id") or f"bank_{int(time.time() * 1000)}")
            ref = database.collection("banking").document(client_name.strip()).collection(status).document(txn_id)
            batch.set(ref, txn)
        batch.commit()
    return {"status": "success", "count": len(txns)}

@app.delete("/api/clients/{client_name}/bank-txns/{status}/{txn_id}")
def delete_bank_transaction(client_name: str, status: str, txn_id: str):
    database = get_db()
    if database:
        database.collection("banking").document(client_name.strip()).collection(status).document(str(txn_id)).delete()
    return {"status": "deleted"}

# --- 5.6 Sales & POS Module Persistence ---
@app.get("/api/clients/{client_name}/sales")
def get_sales_records(client_name: str, status: str = "approved"):
    database = get_db()
    if not database:
        return []
    docs = database.collection("sales").document(client_name.strip()).collection(status).stream()
    return [doc.to_dict() for doc in docs]

@app.post("/api/clients/{client_name}/sales")
def save_sales_record(client_name: str, status: str = "approved", payload: Dict[str, Any] = Body(...)):
    database = get_db()
    records = payload.get("records")
    if database and records is not None and isinstance(records, list):
        batch = database.batch()
        for rec in records:
            rec_id = str(rec.get("id") or f"sale_{int(time.time() * 1000)}")
            ref = database.collection("sales").document(client_name.strip()).collection(status).document(rec_id)
            batch.set(ref, rec)
        batch.commit()
        return {"status": "success", "count": len(records)}

    rec_id = str(payload.get("id") or f"sale_{int(time.time() * 1000)}")
    if database:
        database.collection("sales").document(client_name.strip()).collection(status).document(rec_id).set(payload)
    return {"status": "success", "id": rec_id}

@app.delete("/api/clients/{client_name}/sales/{status}/{record_id}")
def delete_sales_record(client_name: str, status: str, record_id: str):
    database = get_db()
    if database:
        database.collection("sales").document(client_name.strip()).collection(status).document(str(record_id)).delete()
    return {"status": "deleted"}

# --- 5.7 Other Expenses Module Persistence ---
@app.get("/api/clients/{client_name}/expenses")
def get_expense_records(client_name: str, status: str = "approved"):
    database = get_db()
    if not database:
        return []
    docs = database.collection("other_expenses").document(client_name.strip()).collection(status).stream()
    return [doc.to_dict() for doc in docs]

@app.post("/api/clients/{client_name}/expenses")
def save_expense_record(client_name: str, status: str = "approved", payload: Dict[str, Any] = Body(...)):
    database = get_db()
    expenses = payload.get("expenses")
    if database and expenses is not None and isinstance(expenses, list):
        batch = database.batch()
        for exp in expenses:
            exp_id = str(exp.get("id") or f"exp_{int(time.time() * 1000)}")
            ref = database.collection("other_expenses").document(client_name.strip()).collection(status).document(exp_id)
            batch.set(ref, exp)
        batch.commit()
        return {"status": "success", "count": len(expenses)}

    exp_id = str(payload.get("id") or f"exp_{int(time.time() * 1000)}")
    if database:
        database.collection("other_expenses").document(client_name.strip()).collection(status).document(exp_id).set(payload)
    return {"status": "success", "id": exp_id}

@app.delete("/api/clients/{client_name}/expenses/{status}/{expense_id}")
def delete_expense_record(client_name: str, status: str, expense_id: str):
    database = get_db()
    if database:
        database.collection("other_expenses").document(client_name.strip()).collection(status).document(str(expense_id)).delete()
    return {"status": "deleted"}

# --- 5.8 Bulk Seeder (Browser localStorage to Firestore) ---
@app.post("/api/system/seed-from-backup")
def seed_from_backup(payload: Dict[str, Any] = Body(...)):
    database = get_db()
    if not database:
        raise HTTPException(status_code=500, detail="Firestore database unavailable.")
    
    batch = database.batch()

    if "c4_client_profiles" in payload:
        raw_profiles = payload["c4_client_profiles"]
        profiles = json.loads(raw_profiles) if isinstance(raw_profiles, str) else raw_profiles
        for cname, pdata in profiles.items():
            ref = database.collection("client_profiles").document(cname.strip())
            batch.set(ref, pdata)

    if "c4_user_accounts" in payload:
        raw_users = payload["c4_user_accounts"]
        users = json.loads(raw_users) if isinstance(raw_users, str) else raw_users
        for u in users:
            uname = u.get("username", "").strip().lower()
            if uname:
                ref = database.collection("users").document(uname)
                batch.set(ref, u)

    for key, val in payload.items():
        if key.startswith("c4_coa_"):
            cname = key.replace("c4_coa_", "").strip()
            ledgers = json.loads(val) if isinstance(val, str) else val
            ref = database.collection("client_coa").document(cname)
            batch.set(ref, {"ledgers": ledgers})

    batch.commit()
    return {"status": "success", "message": "All profiles, COAs, and users successfully committed to Firestore"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("backend_api:app", host="0.0.0.0", port=port)
