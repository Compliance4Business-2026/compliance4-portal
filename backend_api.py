from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import io
import os
import re
import httpx
import hashlib
import pandas as pd
from datetime import datetime
from google import genai
from google.genai import types
from supabase import create_client, Client

app = FastAPI(title="Compliance4 Core Operations API", version="2.0.0")

# Enable CORS for browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase and Gemini Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

ai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

STOP_WORDS = {"1ltr", "ltr", "500g", "1kg", "kg", "gm", "ml", "pkt", "pcs", "box", "can", "tin", "nos", "unit", "pack"}

# ==========================================
# 1. CLEANING & EXTRACTION SCHEMAS
# ==========================================
class LineItemSchema(BaseModel):
    description: str
    hsn_code: Optional[str] = ""
    qty: float = 1.0
    rate: float = 0.0
    amount: float
    ledger: Optional[str] = "Purchase Account"

class InvoiceExtractionSchema(BaseModel):
    vendor_name: str
    billing_address: Optional[str] = ""
    vendor_gstin: Optional[str] = ""
    source_state: Optional[str] = "Gujarat"
    destination_state: Optional[str] = "Gujarat"
    invoice_number: str
    invoice_date: str
    items: List[LineItemSchema]
    subtotal: float
    cgst: float = 0.0
    sgst: float = 0.0
    igst: float = 0.0
    round_off: float = 0.0
    grand_total: float

def clean_text(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    tokens = [t for t in text.split() if t not in STOP_WORDS]
    return " ".join(tokens).strip()

def extract_counterparty(narration: str) -> str:
    text = str(narration).strip()
    if not text or text.lower() == "nan":
        return ""
    if "/" in text:
        parts = [p.strip() for p in text.split("/") if p.strip()]
        valid = [p for p in parts if not re.match(r'^[0-9]+$', p) and len(p) > 2 and not re.match(r'^[a-z]{4}[0-9]+$', p.lower())]
        if valid:
            cand = valid[-1]
            if len(cand) > 2 and not cand.lower().startswith("inf") and not cand.lower().startswith("neft"):
                return clean_text(cand)
    t = text.lower()
    t = re.sub(r'\b(upi|neft|rtgs|imps|pos|ach|nach|inb|mb|chq|e-pay|rev-upi|dr|cr|trf)\b', ' ', t)
    t = re.sub(r'/[0-9a-z_-]+', ' ', t)
    t = re.sub(r'\b[0-9]{5,}\b', ' ', t)
    t = re.sub(r'@[a-z]+', ' ', t)
    t = re.sub(r'[^a-z0-9\s]', ' ', t)
    tokens = [tok for tok in t.split() if tok not in STOP_WORDS and len(tok) > 2]
    return " ".join(tokens).strip()

# ==========================================
# 2. PURCHASE BILL PROCESSING & LEARNING
# ==========================================
@app.post("/api/purchase/extract")
async def extract_purchase_bill(
    org_id: str = Form(...),
    file: UploadFile = File(...)
):
    if not supabase or not ai_client:
        raise HTTPException(status_code=500, detail="Database or Gemini credentials missing.")

    raw_bytes = await file.read()
    file_hash = hashlib.md5(raw_bytes).hexdigest()

    # Check for duplicate file
    existing = supabase.table("purchase_invoices").select("id, invoice_number").eq("org_id", org_id).eq("file_hash", file_hash).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail=f"Duplicate invoice! Matches invoice #{existing.data[0]['invoice_number']}")

    # Upload binary to Supabase Storage
    storage_path = f"{org_id}/{file_hash}_{file.filename}"
    supabase.storage.from_("invoices").upload(storage_path, raw_bytes, {"content-type": file.content_type})
    file_url = supabase.storage.from_("invoices").get_public_url(storage_path)

    # Fetch available chart of accounts & memorized rules
    ledgers_res = supabase.table("ledgers").select("name").eq("org_id", org_id).execute()
    active_ledgers = [l["name"] for l in ledgers_res.data] if ledgers_res.data else ["Purchase Account"]
    rules_res = supabase.table("item_ledger_rules").select("clean_description, target_ledger").eq("org_id", org_id).execute()
    rule_map = {r["clean_description"]: r["target_ledger"] for r in rules_res.data}

    # Extract with Gemini
    prompt = f"""
    Extract invoice line items accurately.
    Capture complete product descriptions.
    Assign line-item ledgers from: {', '.join(active_ledgers)}.
    """
    mime = file.content_type if file.content_type in ["application/pdf", "image/jpeg", "image/png"] else "application/pdf"
    
    response = ai_client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[types.Part.from_bytes(data=raw_bytes, mime_type=mime), prompt],
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=InvoiceExtractionSchema)
    )
    
    data = InvoiceExtractionSchema.model_validate_json(response.text)

    # Apply memorized ledger mapping
    for itm in data.items:
        clean_d = clean_text(itm.description)
        if clean_d in rule_map:
            itm.ledger = rule_map[clean_d]

    # Save to Pending Review Queue
    try:
        inv_date = datetime.strptime(data.invoice_date, "%d-%m-%Y").strftime("%Y-%m-%d")
    except Exception:
        inv_date = datetime.now().strftime("%Y-%m-%d")
    archive_month = inv_date[:7]

    insert_res = supabase.table("purchase_invoices").insert({
        "org_id": org_id,
        "file_name": file.filename,
        "file_hash": file_hash,
        "file_url": file_url,
        "vendor_name": data.vendor_name,
        "vendor_ledger": data.vendor_name,
        "vendor_gstin": data.vendor_gstin,
        "billing_address": data.billing_address,
        "source_state": data.source_state,
        "destination_state": data.destination_state,
        "invoice_number": data.invoice_number,
        "invoice_date": inv_date,
        "subtotal": data.subtotal,
        "cgst": data.cgst,
        "sgst": data.sgst,
        "igst": data.igst,
        "round_off": data.round_off,
        "grand_total": data.grand_total,
        "status": "pending_review",
        "archive_month": archive_month,
        "narration": f"Purchase from {data.vendor_name} inv #{data.invoice_number}"
    }).execute()

    invoice_id = insert_res.data[0]["id"]

    for item in data.items:
        supabase.table("purchase_line_items").insert({
            "invoice_id": invoice_id,
            "description": item.description,
            "hsn_code": item.hsn_code,
            "qty": item.qty,
            "rate": item.rate,
            "amount": item.amount,
            "assigned_ledger": item.ledger
        }).execute()

    return {"status": "success", "invoice_id": invoice_id, "data": data}

class ApproveBillPayload(BaseModel):
    invoice_id: str
    org_id: str
    vendor_ledger: str
    items: List[LineItemSchema]
    archive_month: str

@app.post("/api/purchase/approve")
async def approve_purchase_invoice(payload: ApproveBillPayload):
    # Memorize rules for future invoices
    for itm in payload.items:
        clean_d = clean_text(itm.description)
        if clean_d and itm.ledger:
            supabase.table("item_ledger_rules").upsert({
                "org_id": payload.org_id,
                "clean_description": clean_d,
                "target_ledger": itm.ledger,
                "updated_at": datetime.now().isoformat()
            }, on_conflict="org_id, clean_description").execute()

    # Move to approved & assign month folder
    supabase.table("purchase_invoices").update({
        "status": "approved",
        "vendor_ledger": payload.vendor_ledger,
        "archive_month": payload.archive_month
    }).eq("id", payload.invoice_id).execute()

    return {"status": "success", "message": "Invoice approved and rule memorized."}

# ==========================================
# 3. BANK RECONCILIATION & AUTO-LEARNING
# ==========================================
@app.post("/api/bank/upload")
async def upload_bank_statement(
    org_id: str = Form(...),
    bank_account_id: str = Form(...),
    file: UploadFile = File(...)
):
    contents = await file.read()
    if file.filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))

    rules_res = supabase.table("bank_ledger_rules").select("clean_counterparty, target_ledger, default_voucher_type").eq("org_id", org_id).execute()
    bank_rules = {r["clean_counterparty"]: (r["target_ledger"], r["default_voucher_type"]) for r in rules_res.data}

    parsed = []
    for _, row in df.iterrows():
        narration = str(row.get("Narration") or row.get("Description") or "")
        if not narration or narration.lower() == "nan":
            continue

        clean_party = extract_counterparty(narration)
        debit = float(row.get("Debit") or row.get("Withdrawal") or 0.0)
        credit = float(row.get("Credit") or row.get("Deposit") or 0.0)

        assigned_ledger = None
        voucher_type = "Payment" if debit > 0 else "Receipt"
        is_verified = False

        if clean_party in bank_rules:
            assigned_ledger, voucher_type = bank_rules[clean_party]
            is_verified = True

        raw_date = str(row.get("Date") or datetime.now().strftime("%Y-%m-%d")).split(" ")[0]
        archive_month = raw_date[:7]

        parsed.append({
            "org_id": org_id,
            "bank_account_id": bank_account_id,
            "txn_date": raw_date,
            "narration": narration,
            "clean_counterparty": clean_party,
            "debit": debit,
            "credit": credit,
            "voucher_type": voucher_type,
            "assigned_ledger": assigned_ledger,
            "is_verified": is_verified,
            "archive_month": archive_month
        })

    if parsed:
        supabase.table("bank_transactions").insert(parsed).execute()

    return {"status": "success", "count": len(parsed)}

class VerifyBankTxnPayload(BaseModel):
    txn_id: str
    org_id: str
    counterparty: str
    assigned_ledger: str
    voucher_type: str

@app.post("/api/bank/verify-and-learn")
async def verify_and_learn_bank(payload: VerifyBankTxnPayload):
    clean_p = clean_text(payload.counterparty)
    if clean_p and payload.assigned_ledger:
        supabase.table("bank_ledger_rules").upsert({
            "org_id": payload.org_id,
            "clean_counterparty": clean_p,
            "target_ledger": payload.assigned_ledger,
            "default_voucher_type": payload.voucher_type,
            "updated_at": datetime.now().isoformat()
        }, on_conflict="org_id, clean_counterparty").execute()

    # Update this transaction
    supabase.table("bank_transactions").update({
        "assigned_ledger": payload.assigned_ledger,
        "voucher_type": payload.voucher_type,
        "is_verified": True
    }).eq("id", payload.txn_id).execute()

    # Auto-update all pending lines matching this counterparty
    supabase.table("bank_transactions").update({
        "assigned_ledger": payload.assigned_ledger,
        "voucher_type": payload.voucher_type,
        "is_verified": True
    }).eq("org_id", payload.org_id).eq("clean_counterparty", clean_p).eq("is_verified", False).execute()

    return {"status": "success", "message": "Rule recorded and matching transactions verified."}

# ==========================================
# 4. DIRECT TALLY PRIME (PORT 9000) DISPATCH
# ==========================================
@app.post("/api/tally/sync-voucher")
async def sync_to_tally_direct(xml_payload: str = Form(...), tally_url: str = "http://localhost:9000"):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(tally_url, content=xml_payload.encode("utf-8"), headers={"Content-Type": "text/xml"})
            if "<CREATED>1</CREATED>" in res.text or "<ALTERED>1</ALTERED>" in res.text:
                return {"status": "success", "response": res.text}
            else:
                return {"status": "tally_error", "response": res.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed connecting to Tally Prime on port 9000: {str(e)}")
