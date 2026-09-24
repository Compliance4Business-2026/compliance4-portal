import os
import io
import json
import base64
import requests
import pandas as pd
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from google import genai
from google.genai import types

# -------------------------------------------------------------------------
# FASTAPI & CORS CONFIGURATION
# -------------------------------------------------------------------------
app = FastAPI(title="Compliance4 Core Operations API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------------
# CLIENT INITIALIZATIONS
# -------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

supabase_client: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Supabase Init Warning: {e}")

gemini_client = None
if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Gemini Init Warning: {e}")

# -------------------------------------------------------------------------
# PYDANTIC DATA SCHEMAS
# -------------------------------------------------------------------------
class LineItem(BaseModel):
    description: str
    qty: Optional[float] = 1.0
    rate: Optional[float] = 0.0
    amount: float
    ledger: Optional[str] = "Purchase: General Goods"

class InvoiceData(BaseModel):
    id: Optional[str] = None
    vendor_name: str
    vendor_ledger: Optional[str] = None
    vendor_gstin: Optional[str] = ""
    invoice_number: str
    invoice_date: str
    place_of_supply: Optional[str] = "Gujarat"
    taxable_amount: float
    cgst: Optional[float] = 0.0
    sgst: Optional[float] = 0.0
    igst: Optional[float] = 0.0
    grand_total: float
    items: List[LineItem] = []
    file_url: Optional[str] = None

class TallyPushRequest(BaseModel):
    bill: Dict[str, Any]
    company_name: str

# -------------------------------------------------------------------------
# ROUTE 1: INVOICE UPLOAD & GEMINI EXTRACTION
# -------------------------------------------------------------------------
@app.post("/api/invoices/upload")
@app.post("/api/process-bill")
async def upload_invoice(
    file: UploadFile = File(...),
    company_name: str = Form("Panasuria Confectionery")
):
    if not gemini_client:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured on Cloud Run.")

    file_bytes = await file.read()
    mime_type = file.content_type or "application/pdf"

    prompt = """
    You are an expert Indian CA auditor and accounting parser. Extract the following invoice data strictly as a valid JSON object:
    {
      "vendor_name": "Name of Vendor",
      "vendor_gstin": "15-digit GSTIN or blank",
      "invoice_number": "Invoice/Bill Number",
      "invoice_date": "YYYY-MM-DD",
      "place_of_supply": "State name (e.g. Gujarat)",
      "taxable_amount": 0.00,
      "cgst": 0.00,
      "sgst": 0.00,
      "igst": 0.00,
      "grand_total": 0.00,
      "items": [
        {
          "description": "Item or Service description",
          "qty": 1.0,
          "rate": 0.00,
          "amount": 0.00,
          "ledger": "Suggested Tally Expense Ledger"
        }
      ]
    }
    Ensure all numbers are standard floats without commas or currency symbols. Do not return Markdown code blocks.
    """

    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                prompt
            ]
        )

        clean_text = response.text.replace("```json", "").replace("
