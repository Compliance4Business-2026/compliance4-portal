import streamlit as st
import pandas as pd
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional
import io
import json
import os
import time
import base64
import re
import hashlib
from difflib import SequenceMatcher
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

# 1. Page Config
st.set_page_config(
    page_title="Compliance4 Business | Accounting Portal",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 2. Bespoke Styling Injection
CUSTOM_CSS = """
<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .stApp {
        background: radial-gradient(circle at 10% 20%, #E6F3EB 0%, #EFF6F1 45%, #F4F7F5 100%) !important;
        min-height: 100vh;
    }

    [data-testid="stSidebar"] {
        background-color: #FFFFFF !important;
        border-right: 1px solid #E2E8F0 !important;
        padding-top: 1.5rem;
    }
    [data-testid="stSidebar"] * {
        color: #1E293B !important;
    }
    [data-testid="stSidebar"] .stSelectbox label {
        font-weight: 800 !important;
        color: #475569 !important;
        text-transform: uppercase !important;
        font-size: 0.72rem !important;
        letter-spacing: 0.06em !important;
        margin-bottom: 6px !important;
    }

    [data-testid="stSidebar"] div[data-baseweb="select"] > div {
        background: linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%) !important;
        border: 1px solid #94A3B8 !important;
        border-radius: 12px !important;
        padding: 4px 6px !important;
        font-weight: 600 !important;
        color: #0F172A !important;
    }

    .ai-cache-box {
        border: 1px solid #E2E8F0;
        background: #FFFFFF;
        border-radius: 12px;
        padding: 14px 16px;
        margin-top: 24px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .ai-cache-title {
        font-size: 0.72rem;
        font-weight: 800;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 12px;
    }
    .ai-cache-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        background: #F8FAFC;
        border: 1px solid #EDF2F7;
        border-radius: 8px;
        margin-bottom: 8px;
    }
    .ai-cache-label {
        font-size: 0.8rem;
        color: #334155;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .ai-cache-val {
        font-size: 0.85rem;
        font-weight: 700;
        color: #0F172A;
    }

    .hero-banner {
        position: relative;
        background: radial-gradient(ellipse at 85% 50%, rgba(30, 64, 110, 0.95) 0%, rgba(13, 34, 64, 1) 70%),
                    url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><path d="M250,40 L340,90 L290,160 L380,120 L320,30 L220,110 Z" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/><circle cx="250" cy="40" r="2.5" fill="rgba(255,255,255,0.3)"/><circle cx="340" cy="90" r="2.5" fill="rgba(255,255,255,0.3)"/><circle cx="290" cy="160" r="2.5" fill="rgba(255,255,255,0.3)"/><circle cx="380" cy="120" r="2.5" fill="rgba(255,255,255,0.3)"/><circle cx="320" cy="30" r="2.5" fill="rgba(255,255,255,0.3)"/><circle cx="220" cy="110" r="2.5" fill="rgba(255,255,255,0.3)"/></svg>');
        background-repeat: no-repeat;
        background-position: right center;
        background-size: contain;
        background-color: #0D2240;
        padding: 32px 40px;
        border-radius: 16px;
        color: #FFFFFF;
        box-shadow: 0 12px 30px -8px rgba(13, 34, 64, 0.25);
        margin-bottom: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .hero-title {
        font-family: 'Playfair Display', serif;
        font-size: 2rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        margin: 0;
        color: #FFFFFF !important;
    }
    .hero-subtitle {
        font-size: 0.88rem;
        color: #94A3B8 !important;
        margin-top: 8px;
        font-weight: 400;
        letter-spacing: 0.01em;
    }
    .hero-pill {
        background: rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(10px);
        padding: 7px 18px;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-weight: 600;
        font-size: 0.82rem;
        color: #FFFFFF !important;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: transparent !important;
        border-bottom: none !important;
        margin-bottom: 16px;
    }
    .stTabs [data-baseweb="tab"] {
        background: rgba(255, 255, 255, 0.6) !important;
        border: 1px solid rgba(203, 213, 225, 0.6) !important;
        border-radius: 9999px !important;
        padding: 6px 18px !important;
        font-weight: 600 !important;
        font-size: 0.84rem !important;
        color: #475569 !important;
        backdrop-filter: blur(6px);
        transition: all 0.2s ease;
    }
    .stTabs [data-baseweb="tab"]:hover {
        background: #FFFFFF !important;
        color: #0D2240 !important;
    }
    .stTabs [aria-selected="true"] {
        background: #0D2240 !important;
        color: #FFFFFF !important;
        border-color: #0D2240 !important;
        box-shadow: 0 4px 12px rgba(13, 34, 64, 0.18) !important;
    }

    .app-panel {
        background: rgba(255, 255, 255, 0.75);
        border: 1px solid rgba(226, 232, 240, 0.9);
        border-radius: 14px;
        padding: 24px 28px;
        backdrop-filter: blur(12px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
        margin-bottom: 16px;
    }
    .empty-state-notice {
        background: rgba(255, 255, 255, 0.65);
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 16px 20px;
        color: #64748B;
        font-size: 0.9rem;
    }

    .duplicate-alert {
        background: #FEF2F2;
        border: 1.5px solid #F87171;
        border-radius: 12px;
        padding: 14px 18px;
        color: #991B1B;
        margin-bottom: 16px;
        box-shadow: 0 2px 6px rgba(239, 68, 68, 0.1);
    }
    .duplicate-alert-title {
        font-weight: 800;
        font-size: 0.95rem;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .duplicate-alert-desc {
        font-size: 0.85rem;
        margin-top: 4px;
        color: #7F1D1D;
    }

    /* Scrollable Zoom Container */
    .zoom-container {
        overflow: auto;
        max-height: 700px;
        border: 1px solid #CBD5E1;
        border-radius: 12px;
        background: #525659;
        text-align: center;
        padding: 10px;
    }

    .stButton>button[kind="primary"] {
        background-color: #0D2240 !important;
        border-color: #0D2240 !important;
        border-radius: 9999px !important;
        padding: 8px 24px !important;
        font-weight: 700 !important;
        font-size: 0.88rem !important;
        box-shadow: 0 4px 12px rgba(13, 34, 64, 0.18) !important;
    }
    .stButton>button[kind="secondary"] {
        background-color: #FFFFFF !important;
        border: 1px solid #CBD5E1 !important;
        border-radius: 9999px !important;
        color: #334155 !important;
        padding: 8px 20px !important;
        font-weight: 600 !important;
    }
    hr {
        border-top: 1px solid rgba(203, 213, 225, 0.5) !important;
        margin: 20px 0 !important;
    }
</style>
"""
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

# 3. Team Passcode Gate
def check_password():
    def password_entered():
        correct_password = str(st.secrets.get("APP_PASSWORD", "Bhargavi@2003")).strip()
        entered = st.session_state.get("password_input", "").strip()
        if entered == correct_password:
            st.session_state["password_correct"] = True
            if "password_input" in st.session_state:
                del st.session_state["password_input"]
        else:
            st.session_state["password_correct"] = False

    if "password_correct" not in st.session_state:
        st.markdown("""
        <div style="max-width: 390px; margin: 90px auto; background: #FFFFFF; padding: 36px; border-radius: 20px; border: 1px solid #E2E8F0; box-shadow: 0 12px 30px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 2.2rem; margin-bottom: 6px;">🔐</div>
            <h3 style="color: #0D2240; font-family: 'Playfair Display', serif; font-weight: 700; margin-bottom: 2px;">Compliance4 Portal</h3>
            <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 20px;">Enter office passcode to continue</p>
        </div>
        """, unsafe_allow_html=True)
        col1, col2, col3 = st.columns([1.2, 1.6, 1.2])
        with col2:
            st.text_input("Office Passcode", type="password", on_change=password_entered, key="password_input", label_visibility="collapsed", placeholder="Passcode...")
        return False
    elif not st.session_state["password_correct"]:
        st.markdown("""
        <div style="max-width: 390px; margin: 90px auto 0 auto; background: #FFFFFF; padding: 36px 36px 12px 36px; border-radius: 20px; border: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 2.2rem; margin-bottom: 6px;">🔐</div>
            <h3 style="color: #0D2240; font-family: 'Playfair Display', serif; font-weight: 700; margin-bottom: 2px;">Compliance4 Portal</h3>
            <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 12px;">Enter office passcode to continue</p>
        </div>
        """, unsafe_allow_html=True)
        col1, col2, col3 = st.columns([1.2, 1.6, 1.2])
        with col2:
            st.text_input("Office Passcode", type="password", on_change=password_entered, key="password_input", label_visibility="collapsed", placeholder="Passcode...")
            st.error("Incorrect passcode.")
        return False
    return True

if not check_password():
    st.stop()

LOGO_PATH = "logo.png"

# 4. Persistent Stores & Default Chart of Accounts
CLIENTS_FILE = "client_ledgers.json"
PENDING_BILLS_FILE = "pending_bills.json"
APPROVED_BILLS_FILE = "approved_bills.json"
ITEM_RULES_FILE = "item_ledger_rules.json"
BANK_RULES_FILE = "bank_ledger_rules.json"

DEFAULT_CLIENTS = {
    "The Marx Ventures": [
        "Purchase: Beverages",
        "Purchase: Raw Materials",
        "Purchase: Food & Groceries",
        "Packaging Supplies",
        "Kitchen Consumables",
        "Freight & Delivery Inward",
        "Bank Charges",
        "Electricity Expense",
        "Rent Expense",
        "Staff Welfare Expense",
        "Repairs & Maintenance - Kitchen",
        "Housekeeping Expenses",
        "Printing & Stationery",
        "Delivery Partner Charges (Zomato/Swiggy)",
        "Miscellaneous Expenses"
    ],
    "Indbuy Global Pvt Ltd": [
        "Trading Goods Purchase",
        "Freight & Forwarding Charges",
        "Warehouse Storage Expense",
        "Office Supplies Expense",
        "Printing & Stationery",
        "Bank Charges",
        "Professional Fees"
    ],
    "Default Client": [
        "Purchase Account",
        "Office Supplies Expense",
        "Repairs & Maintenance",
        "Miscellaneous Expenses",
        "Bank Charges"
    ]
}

def load_client_masters():
    if os.path.exists(CLIENTS_FILE):
        try:
            with open(CLIENTS_FILE, "r") as f:
                data = json.load(f)
                if data:
                    return data
        except Exception:
            return DEFAULT_CLIENTS
    return DEFAULT_CLIENTS

def save_client_masters(data):
    with open(CLIENTS_FILE, "w") as f:
        json.dump(data, f, indent=4)

def load_pending_bills():
    if os.path.exists(PENDING_BILLS_FILE):
        try:
            with open(PENDING_BILLS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_pending_bills(bills):
    with open(PENDING_BILLS_FILE, "w") as f:
        json.dump(bills, f, indent=4)

def load_approved_bills():
    if os.path.exists(APPROVED_BILLS_FILE):
        try:
            with open(APPROVED_BILLS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_approved_bills(bills):
    with open(APPROVED_BILLS_FILE, "w") as f:
        json.dump(bills, f, indent=4)

def load_item_rules():
    if os.path.exists(ITEM_RULES_FILE):
        try:
            with open(ITEM_RULES_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_item_rules(rules):
    with open(ITEM_RULES_FILE, "w") as f:
        json.dump(rules, f, indent=4)

def load_bank_rules():
    if os.path.exists(BANK_RULES_FILE):
        try:
            with open(BANK_RULES_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_bank_rules(rules):
    with open(BANK_RULES_FILE, "w") as f:
        json.dump(rules, f, indent=4)

# 5. Robust Normalization & Token Overlap Matcher
STOP_WORDS = {
    "1ltr", "1 ltr", "ltr", "500g", "1kg", "kg", "gm", "ml", 
    "pkt", "pcs", "box", "can", "tin", "nos", "no", "unit", 
    "pack", "bottle", "bottles", "jar", "jars"
}

def clean_text(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    tokens = [t for t in text.split() if t not in STOP_WORDS]
    return " ".join(tokens).strip()

def compute_file_hash(raw_bytes: bytes) -> str:
    return hashlib.md5(raw_bytes).hexdigest()

def match_learned_ledger(client_name: str, item_desc: str, rules_dict: dict, valid_ledgers: list) -> Optional[str]:
    client_rules = rules_dict.get(client_name, {})
    if not client_rules:
        return None

    cleaned_query = clean_text(item_desc)
    if not cleaned_query:
        return None

    query_tokens = set(cleaned_query.split())
    clean_valid_map = {l.strip().lower(): l for l in valid_ledgers}

    if cleaned_query in client_rules:
        target_led = client_rules[cleaned_query].strip()
        if target_led.lower() in clean_valid_map:
            return clean_valid_map[target_led.lower()]

    best_ledger = None
    best_score = 0.0

    for learned_name, ledger_name in client_rules.items():
        clean_target = clean_text(learned_name)
        target_tokens = set(clean_target.split())
        
        if not target_tokens:
            continue

        intersection = query_tokens.intersection(target_tokens)
        token_score = len(intersection) / max(len(target_tokens), 1)
        char_score = SequenceMatcher(None, cleaned_query, clean_target).ratio()
        sub_boost = 0.2 if (clean_target in cleaned_query or cleaned_query in clean_target) else 0.0
        total_score = max(token_score + sub_boost, char_score)

        if total_score > best_score and total_score >= 0.55:
            matched_clean = ledger_name.strip()
            if matched_clean.lower() in clean_valid_map:
                best_score = total_score
                best_ledger = clean_valid_map[matched_clean.lower()]

    return best_ledger

def record_approval_learning(bill_dict: dict):
    client_name = bill_dict.get("client_name", "Default Client")
    rules = load_item_rules()
    if client_name not in rules:
        rules[client_name] = {}

    for item in bill_dict.get("items", []):
        desc = item.get("description", "")
        ledger = item.get("ledger", "").strip()
        clean_desc = clean_text(desc)
        if clean_desc and ledger:
            rules[client_name][clean_desc] = ledger

    save_item_rules(rules)

def check_invoice_duplicate(vendor_name: str, invoice_no: str, current_idx: int, pending_list: list, approved_list: list):
    clean_v = clean_text(vendor_name)
    clean_inv = clean_text(invoice_no)
    
    if not clean_inv or not clean_v:
        return None

    for b in approved_list:
        if clean_text(b.get("vendor_name", "")) == clean_v and clean_text(b.get("invoice_number", "")) == clean_inv:
            return {
                "source": "Approved Vouchers",
                "vendor": b.get("vendor_name"),
                "inv_no": b.get("invoice_number"),
                "date": b.get("invoice_date"),
                "total": b.get("grand_total", 0.0),
                "file": b.get("file_name", "Previous Upload")
            }

    for i, b in enumerate(pending_list):
        if i == current_idx:
            continue
        if clean_text(b.get("vendor_name", "")) == clean_v and clean_text(b.get("invoice_number", "")) == clean_inv:
            return {
                "source": "Pending Review Queue",
                "vendor": b.get("vendor_name"),
                "inv_no": b.get("invoice_number"),
                "date": b.get("invoice_date"),
                "total": b.get("grand_total", 0.0),
                "file": b.get("file_name", "Staged Bill")
            }
    return None

client_masters = load_client_masters()
item_rules = load_item_rules()
bank_rules = load_bank_rules()

GST_TREATMENTS = ["Regular", "Composition", "Unregistered", "Overseas / Import"]
STATES = ["Gujarat", "Maharashtra", "Delhi", "Rajasthan", "Karnataka", "Tamil Nadu", "Other"]

# 6. Pydantic Schema
class LineItem(BaseModel):
    description: str = Field(description="Complete description of goods or services")
    hsn_code: Optional[str] = Field(default="", description="HSN/SAC Code")
    qty: float = Field(default=1.0, description="Quantity")
    rate: float = Field(default=0.0, description="Unit rate")
    amount: float = Field(description="Total taxable line amount")
    ledger: str = Field(default="", description="Best matching ledger name from client master")

class InvoiceExtraction(BaseModel):
    vendor_name: str = Field(description="Supplier or vendor business name")
    billing_address: Optional[str] = Field(default="", description="Vendor address")
    vendor_gstin: Optional[str] = Field(default="", description="Vendor GSTIN")
    source_state: Optional[str] = Field(default="Gujarat", description="State of vendor")
    destination_state: Optional[str] = Field(default="Gujarat", description="Place of supply")
    invoice_number: str = Field(description="Invoice reference number")
    invoice_date: str = Field(description="Invoice date in DD-MM-YYYY format")
    items: List[LineItem] = Field(description="Itemized goods or services")
    subtotal: float = Field(description="Taxable Subtotal")
    cgst: float = Field(default=0.0, description="CGST amount")
    sgst: float = Field(default=0.0, description="SGST amount")
    igst: float = Field(default=0.0, description="IGST amount")
    round_off: float = Field(default=0.0, description="Round off fraction if any")
    grand_total: float = Field(description="Grand invoice total")

if "active_review_index" not in st.session_state:
    st.session_state["active_review_index"] = None
if "bank_df_working" not in st.session_state:
    st.session_state["bank_df_working"] = None
if "active_main_module" not in st.session_state:
    st.session_state["active_main_module"] = "Purchase"
if "zoom_level" not in st.session_state:
    st.session_state["zoom_level"] = 100

pending_bills_list = load_pending_bills()
approved_bills_list = load_approved_bills()

# 7. XML Generators (With Automatic Round-Off Debit/Credit Entries)
def generate_tally_xml(approved_bills):
    xml = """<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
"""
    for b in approved_bills:
        clean_date = "".join(filter(str.isdigit, b["invoice_date"]))
        if len(clean_date) == 8 and b["invoice_date"].count("-") == 2:
            p = b["invoice_date"].split("-")
            if len(p[0]) == 2:
                clean_date = f"{p[2]}{p[1]}{p[0]}"

        xml += f"""        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Purchase" ACTION="Create">
            <DATE>{clean_date}</DATE>
            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
            <REFERENCE>{b["invoice_number"]}</REFERENCE>
            <PARTYLEDGERNAME>{b["vendor_name"]}</PARTYLEDGERNAME>
            <NARRATION>{b.get("narration", "")}</NARRATION>

            <!-- Party Credit -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{b["vendor_name"]}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>{b["grand_total"]:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
"""
        ledger_totals = {}
        for itm in b["items"]:
            led = itm.get("ledger", "Purchase Account")
            amt = float(itm.get("amount", 0.0))
            ledger_totals[led] = ledger_totals.get(led, 0.0) + amt

        for led_name, total_amt in ledger_totals.items():
            xml += f"""            <!-- Line Item Debit: {led_name} -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{led_name}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{total_amt:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n"""

        if b.get("cgst", 0.0) > 0:
            xml += f"""            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>CGST Input</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{b['cgst']:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n"""
        if b.get("sgst", 0.0) > 0:
            xml += f"""            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>SGST Input</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{b['sgst']:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n"""
        if b.get("igst", 0.0) > 0:
            xml += f"""            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>IGST Input</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{b['igst']:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n"""

        # Auto Round-Off Ledger Handling
        round_off_val = round(float(b.get("round_off", 0.0)), 2)
        if round_off_val != 0.0:
            # If positive round-off (invoice total increased), Debit Round-off
            if round_off_val > 0:
                xml += f"""            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Round Off</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{round_off_val:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n"""
            # If negative round-off (invoice total decreased), Credit Round-off
            else:
                xml += f"""            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Round Off</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>{abs(round_off_val):.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n"""

        xml += """          </VOUCHER>
        </TALLYMESSAGE>\n"""

    xml += """      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""
    return xml

def generate_bank_tally_xml(df_bank, bank_ledger_name):
    xml = """<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
"""
    for _, row in df_bank.iterrows():
        raw_date = str(row.get("Date", "")).strip()
        clean_date = "".join(filter(str.isdigit, raw_date))
        if len(clean_date) == 8 and "-" in raw_date:
            p = raw_date.split("-")
            if len(p[0]) == 2:
                clean_date = f"{p[2]}{p[1]}{p[0]}"
        elif len(clean_date) != 8:
            clean_date = time.strftime("%Y%m%d")

        narration = str(row.get("Narration", "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        assigned_ledger = str(row.get("Assigned Ledger", "Suspense Account"))
        debit_amt = float(row.get("Debit / Withdrawal", 0.0) or 0.0)
        credit_amt = float(row.get("Credit / Deposit", 0.0) or 0.0)

        if debit_amt > 0:
            xml += f"""        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Payment" ACTION="Create">
            <DATE>{clean_date}</DATE>
            <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>{bank_ledger_name}</PARTYLEDGERNAME>
            <NARRATION>{narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{assigned_ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{debit_amt:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{bank_ledger_name}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>{debit_amt:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>\n"""

        elif credit_amt > 0:
            xml += f"""        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>{clean_date}</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>{bank_ledger_name}</PARTYLEDGERNAME>
            <NARRATION>{narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{bank_ledger_name}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{credit_amt:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{assigned_ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>{credit_amt:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>\n"""

    xml += """      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""
    return xml

def optimize_file(file_name, raw_bytes):
    ext = file_name.lower().split('.')[-1]
    if ext in ['jpg', 'jpeg', 'png']:
        try:
            img = Image.open(io.BytesIO(raw_bytes))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85, optimize=True)
            return "image/jpeg", buf.getvalue()
        except Exception:
            return "image/jpeg", raw_bytes
    return "application/pdf", raw_bytes

def process_single_bill(file_name, file_bytes, mime, file_hash, client, ledgers_str, client_name, valid_ledgers, rules_dict):
    prompt = f"""
    Extract invoice details accurately into structured format.
    IMPORTANT: Capture the full multi-line item description completely (e.g. 'Rich Versatile Gold Cooking Base' instead of just '(1Ltr)').
    Check if there is a 'Rounding Off' or 'Round Off' fraction stated on the bill, and record it in round_off.
    For each line item, assign the best matching accounting ledger strictly from this client's chart of accounts:
    {ledgers_str}
    """
    for attempt in range(1, 4):
        try:
            resp = client.models.generate_content(
                model='gemini-3.6-flash',
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=InvoiceExtraction,
                ),
            )

            if resp.text:
                parsed = InvoiceExtraction.model_validate_json(resp.text)
                bill_entry = parsed.model_dump()
                bill_entry["file_name"] = file_name
                bill_entry["file_hash"] = file_hash
                bill_entry["file_base64"] = base64.b64encode(file_bytes).decode("utf-8")
                bill_entry["mime_type"] = mime
                bill_entry["gst_treatment"] = "Regular"
                bill_entry["client_name"] = client_name

                # Auto calculate round_off if omitted
                calc_expected = bill_entry["subtotal"] + bill_entry["cgst"] + bill_entry["sgst"] + bill_entry["igst"]
                if bill_entry.get("round_off", 0.0) == 0.0 and abs(bill_entry["grand_total"] - calc_expected) > 0.001:
                    bill_entry["round_off"] = round(bill_entry["grand_total"] - calc_expected, 2)

                for itm in bill_entry.get("items", []):
                    learned_ledger = match_learned_ledger(
                        client_name,
                        itm.get("description", ""),
                        rules_dict,
                        valid_ledgers
                    )
                    if learned_ledger:
                        itm["ledger"] = learned_ledger

                return True, bill_entry, None
        except Exception as err:
            err_str = str(err)
            if ("503" in err_str or "UNAVAILABLE" in err_str) and attempt < 3:
                time.sleep(2)
                continue
            return False, None, f"{file_name}: {err_str}"
    return False, None, f"{file_name}: Google servers busy after 3 retries."

# 8. Sidebar
with st.sidebar:
    if os.path.exists(LOGO_PATH):
        st.image(LOGO_PATH, width=195)
    else:
        st.markdown("<h2 style='color:#0D2240; font-family:Playfair Display,serif; font-weight:800; margin-top:0;'>Compliance4</h2>", unsafe_allow_html=True)
    
    st.markdown("<p style='color:#64748B; font-size:0.75rem; font-weight:600; letter-spacing:0.04em; margin-top:-6px; margin-bottom: 24px;'>BUSINESS PROCESS OUTSOURCING</p>", unsafe_allow_html=True)

    client_options = list(client_masters.keys())
    if not client_options:
        client_masters = DEFAULT_CLIENTS
        client_options = list(client_masters.keys())

    selected_client = st.selectbox("ACTIVE CLIENT ACCOUNT", options=client_options)
    active_ledgers = client_masters.get(selected_client, ["Purchase Account"])

    try:
        default_key = st.secrets.get("GEMINI_API_KEY", "")
    except Exception:
        default_key = ""

    api_key = default_key if default_key else st.text_input("Gemini API Key", type="password")

    current_client_rules = item_rules.get(selected_client, {})
    current_bank_rules = bank_rules.get(selected_client, {})
    
    st.markdown(f"""
    <div class="ai-cache-box">
        <div class="ai-cache-title">AI CACHE STATUS</div>
        <div class="ai-cache-row">
            <span class="ai-cache-label">📑 Invoice Items Memorized</span>
            <span class="ai-cache-val">{len(current_client_rules)}</span>
        </div>
        <div class="ai-cache-row">
            <span class="ai-cache-label">🏛️ Bank Parties Mapped</span>
            <span class="ai-cache-val">{len(current_bank_rules)}</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

# 9. Executive Hero Banner
st.markdown(f"""
<div class="hero-banner">
    <div>
        <h1 class="hero-title">Compliance4 Business</h1>
        <div class="hero-subtitle">Automated Accounting & Tally Integration Architecture</div>
    </div>
    <div class="hero-pill">🏷️ {selected_client}</div>
</div>
""", unsafe_allow_html=True)

# 10. Detail Review Workspace (With Image Zoom & Round-Off Reconciliation)
if st.session_state["active_review_index"] is not None and len(pending_bills_list) > 0:
    if st.session_state["active_review_index"] >= len(pending_bills_list):
        st.session_state["active_review_index"] = max(0, len(pending_bills_list) - 1)

    idx = st.session_state["active_review_index"]
    bill = pending_bills_list[idx]

    dup_match = check_invoice_duplicate(
        bill.get("vendor_name", ""),
        bill.get("invoice_number", ""),
        idx,
        pending_bills_list,
        approved_bills_list
    )

    nav_c1, nav_c2, nav_c3, nav_c4 = st.columns([2.5, 3.5, 2, 2])
    with nav_c1:
        if st.button("← Back to Invoice Queue", type="secondary", use_container_width=True):
            st.session_state["active_review_index"] = None
            st.rerun()
    with nav_c2:
        st.markdown(f"<div style='text-align:center; font-weight:700; color:#0D2240; padding-top:8px;'>Invoice {idx + 1} of {len(pending_bills_list)} in Queue</div>", unsafe_allow_html=True)
    with nav_c3:
        if idx > 0:
            if st.button("⏮️ Previous", type="secondary", use_container_width=True):
                st.session_state["active_review_index"] = idx - 1
                st.rerun()
    with nav_c4:
        if idx < len(pending_bills_list) - 1:
            if st.button("⏭️ Skip to Next", type="secondary", use_container_width=True):
                st.session_state["active_review_index"] = idx + 1
                st.rerun()

    if dup_match:
        st.markdown(f"""
        <div class="duplicate-alert">
            <div class="duplicate-alert-title">⚠️ Potential Duplicate Invoice Detected!</div>
            <div class="duplicate-alert-desc">
                An invoice with number <b>#{dup_match['inv_no']}</b> from <b>{dup_match['vendor']}</b> 
                (Total: <b>₹{dup_match['total']:,.2f}</b>, Date: <b>{dup_match['date']}</b>) 
                already exists in <b>{dup_match['source']}</b> (Original file: <i>{dup_match['file']}</i>).
                <br>Please verify this document carefully before approving to prevent double accounting.
            </div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("---")
    col_preview, col_form = st.columns([1, 1.2], gap="large")

    with col_preview:
        # ZOOM CONTROLS HEADER
        z_c1, z_c2, z_c3, z_c4 = st.columns([2.5, 1, 1, 1])
        with z_c1:
            st.markdown(f"**📄 Document Preview** ({st.session_state['zoom_level']}%)")
        with z_c2:
            if st.button("🔍 Zoom +", key="zoom_in", use_container_width=True):
                st.session_state["zoom_level"] = min(250, st.session_state["zoom_level"] + 25)
                st.rerun()
        with z_c3:
            if st.button("🔍 Zoom -", key="zoom_out", use_container_width=True):
                st.session_state["zoom_level"] = max(50, st.session_state["zoom_level"] - 25)
                st.rerun()
        with z_c4:
            if st.button("↺ Reset", key="zoom_reset", use_container_width=True):
                st.session_state["zoom_level"] = 100
                st.rerun()

        # ZOOM CONTAINER (SCROLLABLE & ZOOMABLE)
        if bill.get("file_base64"):
            if bill.get("mime_type", "").startswith("image"):
                img_data_uri = f"data:{bill.get('mime_type')};base64,{bill['file_base64']}"
                st.markdown(f"""
                <div class="zoom-container">
                    <img src="{img_data_uri}" style="width: {st.session_state['zoom_level']}%; max-width: none; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);" />
                </div>
                """, unsafe_allow_html=True)
            else:
                st.info("PDF document preview active")

    with col_form:
        with st.form(key=f"review_form_{idx}"):
            st.markdown("""
            <div class="app-panel" style="padding: 16px 20px; margin-bottom: 12px;">
                <div style="font-weight: 700; color: #0D2240;">Invoice Header & GST Controls</div>
            </div>
            """, unsafe_allow_html=True)

            v_name = st.text_input("Vendor / Supplier Name", value=bill.get("vendor_name", ""))
            v_address = st.text_input("Billing Address", value=bill.get("billing_address", ""))
            
            r1_c1, r1_c2 = st.columns(2)
            with r1_c1:
                curr_gst = bill.get("gst_treatment", "Regular")
                gst_idx = GST_TREATMENTS.index(curr_gst) if curr_gst in GST_TREATMENTS else 0
                v_gst_treat = st.selectbox("GST Treatment", GST_TREATMENTS, index=gst_idx)
            with r1_c2:
                v_gstin = st.text_input("Vendor GSTIN", value=bill.get("vendor_gstin", ""))

            r2_c1, r2_c2 = st.columns(2)
            with r2_c1:
                src_idx = STATES.index(bill.get("source_state")) if bill.get("source_state") in STATES else 0
                v_src_state = st.selectbox("Source State (Supplier)", STATES, index=src_idx)
            with r2_c2:
                dest_idx = STATES.index(bill.get("destination_state")) if bill.get("destination_state") in STATES else 0
                v_dest_state = st.selectbox("Place of Supply (POS)", STATES, index=dest_idx)

            r3_c1, r3_c2 = st.columns(2)
            with r3_c1:
                v_inv_no = st.text_input("Invoice Number", value=bill.get("invoice_number", ""))
            with r3_c2:
                v_inv_date = st.text_input("Invoice Date (DD-MM-YYYY)", value=bill.get("invoice_date", ""))

            st.markdown("<div style='font-weight: 700; color: #0D2240; margin: 16px 0 8px 0;'>Line Items & Ledger Assignment</div>", unsafe_allow_html=True)

            clean_active_ledgers = [l.strip() for l in active_ledgers]
            clean_map = {l.lower(): l for l in clean_active_ledgers}

            for itm in bill.get("items", []):
                curr_l = str(itm.get("ledger", "")).strip()
                if curr_l.lower() in clean_map:
                    itm["ledger"] = clean_map[curr_l.lower()]
                else:
                    re_matched = match_learned_ledger(selected_client, itm.get("description", ""), item_rules, active_ledgers)
                    itm["ledger"] = re_matched if re_matched else clean_active_ledgers[0]

            df_items = pd.DataFrame(bill["items"])

            edited_df = st.data_editor(
                df_items,
                key=f"items_editor_{idx}",
                column_config={
                    "description": "Item Description",
                    "hsn_code": "HSN",
                    "qty": st.column_config.NumberColumn("Qty", min_value=0, format="%.2f"),
                    "rate": st.column_config.NumberColumn("Rate", format="₹%.2f"),
                    "amount": st.column_config.NumberColumn("Taxable (₹)", format="₹%.2f"),
                    "ledger": st.column_config.SelectboxColumn(
                        "Tally Purchase Ledger",
                        help="Select purchase or expense ledger for each line item",
                        width="medium",
                        options=clean_active_ledgers,
                        required=True,
                    )
                },
                num_rows="dynamic",
                use_container_width=True
            )

            st.markdown("<div style='font-weight: 700; color: #0D2240; margin: 16px 0 8px 0;'>Taxes & Round-Off Reconciliation</div>", unsafe_allow_html=True)
            t_c1, t_c2, t_c3, t_c4 = st.columns(4)
            with t_c1:
                v_cgst = st.number_input("CGST (₹)", value=float(bill.get("cgst", 0.0)), step=0.01, format="%.2f")
            with t_c2:
                v_sgst = st.number_input("SGST (₹)", value=float(bill.get("sgst", 0.0)), step=0.01, format="%.2f")
            with t_c3:
                v_igst = st.number_input("IGST (₹)", value=float(bill.get("igst", 0.0)), step=0.01, format="%.2f")
            with t_c4:
                v_round_off = st.number_input("Round-Off (₹)", value=float(bill.get("round_off", 0.0)), step=0.01, format="%.2f", help="Adjusts paisa difference to match printed bill")

            v_narration = st.text_area(
                "Voucher Narration",
                value=bill.get("narration", f"Purchase from {v_name} via Inv #{v_inv_no}")
            )

            updated_items = edited_df.to_dict(orient="records")
            calc_subtotal = sum([float(r.get("amount", 0.0)) for r in updated_items])
            calc_grand_total = round(calc_subtotal + v_cgst + v_sgst + v_igst + v_round_off, 2)

            st.markdown(f"""
            <div style="background: #FFFFFF; border: 1px solid #CBD5E1; padding: 14px 20px; border-radius: 12px; margin: 14px 0;">
                <div style="display: flex; justify-content: space-between; font-weight: 600; color: #475569; font-size: 0.9rem;">
                    <span>Taxable: ₹{calc_subtotal:,.2f}</span>
                    <span>GST: ₹{(v_cgst+v_sgst+v_igst):,.2f}</span>
                    <span>Round-Off: {'+' if v_round_off >= 0 else ''}₹{v_round_off:.2f}</span>
                </div>
                <div style="font-size: 1.45rem; font-weight: 800; color: #0D2240; margin-top: 4px;">Grand Total: ₹{calc_grand_total:,.2f}</div>
            </div>
            """, unsafe_allow_html=True)

            act_col1, act_col2, act_col3 = st.columns([1.5, 1, 1])
            with act_col1:
                submit_approve = st.form_submit_button("✅ Approve & Next Invoice", type="primary", use_container_width=True)
            with act_col2:
                submit_save_only = st.form_submit_button("💾 Save Draft", type="secondary", use_container_width=True)
            with act_col3:
                submit_reject = st.form_submit_button("🗑️ Reject Bill", type="secondary", use_container_width=True)

        if submit_approve or submit_save_only or submit_reject:
            bill["vendor_name"] = v_name
            bill["billing_address"] = v_address
            bill["gst_treatment"] = v_gst_treat
            bill["vendor_gstin"] = v_gstin
            bill["source_state"] = v_src_state
            bill["destination_state"] = v_dest_state
            bill["invoice_number"] = v_inv_no
            bill["invoice_date"] = v_inv_date
            bill["items"] = updated_items
            bill["cgst"] = v_cgst
            bill["sgst"] = v_sgst
            bill["igst"] = v_igst
            bill["round_off"] = v_round_off
            bill["subtotal"] = calc_subtotal
            bill["grand_total"] = calc_grand_total
            bill["narration"] = v_narration

            if submit_approve:
                pending_bills_list.pop(idx)
                record_approval_learning(bill)
                approved_bills_list.append(bill)
                save_pending_bills(pending_bills_list)
                save_approved_bills(approved_bills_list)

                if len(pending_bills_list) > 0:
                    st.session_state["active_review_index"] = min(idx, len(pending_bills_list) - 1)
                    st.toast("Approved! Staged next invoice.", icon="✨")
                else:
                    st.session_state["active_review_index"] = None
                    st.toast("All pending invoices reviewed!", icon="🎉")
                st.rerun()

            elif submit_reject:
                pending_bills_list.pop(idx)
                save_pending_bills(pending_bills_list)
                if len(pending_bills_list) > 0:
                    st.session_state["active_review_index"] = min(idx, len(pending_bills_list) - 1)
                    st.toast("Bill rejected. Loaded next invoice.", icon="🗑️")
                else:
                    st.session_state["active_review_index"] = None
                st.rerun()

            elif submit_save_only:
                pending_bills_list[idx] = bill
                save_pending_bills(pending_bills_list)
                st.toast("Draft saved successfully!", icon="💾")
                st.rerun()

# 11. Main Dashboard Interface (Modular View)
else:
    if st.session_state["active_review_index"] is not None and len(pending_bills_list) == 0:
        st.session_state["active_review_index"] = None

    col_mod1, col_mod2, col_mod3, col_mod_space = st.columns([1.6, 1.6, 1.4, 3.4])
    with col_mod1:
        btn_type1 = "primary" if st.session_state["active_main_module"] == "Purchase" else "secondary"
        if st.button("📄 Purchase Invoices Module", type=btn_type1, use_container_width=True):
            st.session_state["active_main_module"] = "Purchase"
            st.rerun()
    with col_mod2:
        btn_type2 = "primary" if st.session_state["active_main_module"] == "Bank" else "secondary"
        if st.button("🏛️ Bank Statement Module", type=btn_type2, use_container_width=True):
            st.session_state["active_main_module"] = "Bank"
            st.rerun()
    with col_mod3:
        btn_type3 = "primary" if st.session_state["active_main_module"] == "Settings" else "secondary"
        if st.button("⚙️ Master Settings", type=btn_type3, use_container_width=True):
            st.session_state["active_main_module"] = "Settings"
            st.rerun()

    st.write("")

    # ========================================================
    # MODULE 1: PURCHASE INVOICES
    # ========================================================
    if st.session_state["active_main_module"] == "Purchase":
        p_sub_upload, p_sub_review, p_sub_approved = st.tabs([
            "📤 Upload Invoices",
            f"📝 Needs Review ({len(pending_bills_list)})",
            f"✅ Approved Vouchers ({len(approved_bills_list)})"
        ])

        with p_sub_upload:
            st.markdown(f"""
            <div class="app-panel">
                <h4 style="color: #0D2240; font-family:'Playfair Display',serif; font-weight: 700; margin-top: 0;">Upload Purchase Documents: {selected_client}</h4>
                <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 0;">
                    Upload purchase bills (PDF, JPG, PNG). Exact duplicate files are checked in local memory and skipped before sending to Google AI, protecting your balance.
                </p>
            </div>
            """, unsafe_allow_html=True)

            uploaded_files = st.file_uploader(
                "Select Invoices",
                type=["pdf", "jpg", "jpeg", "png"],
                accept_multiple_files=True,
                key="bill_uploader_field"
            )

            if not api_key:
                st.warning("⚠️ Please provide a Gemini API Key in the left sidebar or Streamlit secrets.")

            if uploaded_files and api_key:
                if st.button("🚀 Process Batch Invoices", type="primary"):
                    client = genai.Client(api_key=api_key)
                    progress_bar = st.progress(0)
                    status_placeholder = st.empty()
                    status_placeholder.info("⚡ Inspecting file fingerprints & checking for duplicates...")

                    existing_hashes = set()
                    for b in pending_bills_list:
                        if b.get("file_hash"):
                            existing_hashes.add(b["file_hash"])
                    for b in approved_bills_list:
                        if b.get("file_hash"):
                            existing_hashes.add(b["file_hash"])

                    prepared_files = []
                    skipped_duplicates = []

                    for f in uploaded_files:
                        f.seek(0)
                        raw_bytes = f.read()
                        f_hash = compute_file_hash(raw_bytes)

                        if f_hash in existing_hashes:
                            skipped_duplicates.append(f.name)
                            continue

                        mime, optimized_bytes = optimize_file(f.name, raw_bytes)
                        prepared_files.append((f.name, optimized_bytes, mime, f_hash))

                    if skipped_duplicates:
                        st.info(f"🛡️ Skipped {len(skipped_duplicates)} identical file(s) already in the database (₹0.00 spent): {', '.join(skipped_duplicates)}")

                    if not prepared_files:
                        if skipped_duplicates:
                            st.warning("All uploaded files were already processed previously. No new API calls were made.")
                    else:
                        ledgers_str = ", ".join(active_ledgers)
                        completed_count = 0
                        total_files = len(prepared_files)
                        newly_extracted = []

                        fresh_rules = load_item_rules()
                        max_workers = min(4, total_files)

                        with ThreadPoolExecutor(max_workers=max_workers) as executor:
                            futures = [
                                executor.submit(
                                    process_single_bill,
                                    fname,
                                    fbytes,
                                    fmime,
                                    fhash,
                                    client,
                                    ledgers_str,
                                    selected_client,
                                    active_ledgers,
                                    fresh_rules
                                )
                                for fname, fbytes, fmime, fhash in prepared_files
                            ]

                            for future in as_completed(futures):
                                success, bill_data, err_msg = future.result()
                                if success:
                                    newly_extracted.append(bill_data)
                                else:
                                    st.error(f"❌ {err_msg}")

                                completed_count += 1
                                progress_bar.progress(completed_count / total_files)

                        if newly_extracted:
                            pending_bills_list.extend(newly_extracted)
                            save_pending_bills(pending_bills_list)
                            status_placeholder.success(f"✅ Successfully staged {len(newly_extracted)} invoice(s) for review!")
                            time.sleep(1)
                            st.rerun()

        with p_sub_review:
            if not pending_bills_list:
                st.markdown("""
                <div class="empty-state-notice">
                    No purchase bills currently awaiting review.
                </div>
                """, unsafe_allow_html=True)
            else:
                for idx, item in enumerate(pending_bills_list):
                    is_dup = check_invoice_duplicate(
                        item.get("vendor_name", ""),
                        item.get("invoice_number", ""),
                        idx,
                        pending_bills_list,
                        approved_bills_list
                    )
                    dup_tag = " <span style='background:#FEE2E2; color:#B91C1C; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:9999px; margin-left:8px;'>⚠️ DUPLICATE</span>" if is_dup else ""

                    st.markdown(f"""
                    <div class="app-panel" style="padding: 16px 22px; margin-bottom: 12px; {'border-left: 4px solid #EF4444;' if is_dup else ''}">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div style="font-size: 1.05rem; font-weight: 700; color: #0D2240;">{item['vendor_name']}{dup_tag}</div>
                                <div style="font-size: 0.82rem; color: #64748B; margin-top: 3px;">
                                    <b>Invoice:</b> #{item['invoice_number']} &nbsp;|&nbsp; <b>Date:</b> {item['invoice_date']} &nbsp;|&nbsp; <b>GSTIN:</b> {item.get('vendor_gstin', 'N/A')}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.25rem; font-weight: 800; color: #0D2240;">₹{item['grand_total']:,.2f}</div>
                                <div style="font-size: 0.78rem; color: #64748B;">Taxable: ₹{item['subtotal']:,.2f}</div>
                            </div>
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
                    
                    c_act1, c_act2 = st.columns([8.5, 1.5])
                    with c_act2:
                        if st.button("🔍 Review & Edit", key=f"rev_{idx}", use_container_width=True):
                            st.session_state["active_review_index"] = idx
                            st.rerun()
                    st.write("")

        with p_sub_approved:
            if not approved_bills_list:
                st.markdown("""
                <div class="empty-state-notice">
                    No approved purchase vouchers present yet.
                </div>
                """, unsafe_allow_html=True)
            else:
                st.markdown("<div style='font-weight:700; color:#0D2240; margin-bottom:8px;'>Approved Purchase Invoices Register</div>", unsafe_allow_html=True)
                
                for a_idx, b in enumerate(approved_bills_list):
                    c_app_info, c_app_act = st.columns([8, 2])
                    with c_app_info:
                        st.markdown(f"""
                        <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:12px 16px; margin-bottom:8px;">
                            <div style="display:flex; justify-content:space-between;">
                                <span style="font-weight:700; color:#0D2240;">{b['vendor_name']} (Inv #{b['invoice_number']})</span>
                                <span style="font-weight:800; color:#0D2240;">₹{b['grand_total']:,.2f}</span>
                            </div>
                            <div style="font-size:0.8rem; color:#64748B; margin-top:3px;">
                                Date: {b['invoice_date']} | GSTIN: {b.get('vendor_gstin', 'N/A')} | Items: {len(b.get('items', []))} | Round-Off: ₹{b.get('round_off', 0.0):.2f}
                            </div>
                        </div>
                        """, unsafe_allow_html=True)
                    with c_app_act:
                        if st.button("✏️ Rectify / Edit", key=f"rectify_{a_idx}", use_container_width=True):
                            voucher_to_edit = approved_bills_list.pop(a_idx)
                            pending_bills_list.append(voucher_to_edit)
                            save_approved_bills(approved_bills_list)
                            save_pending_bills(pending_bills_list)
                            st.session_state["active_review_index"] = len(pending_bills_list) - 1
                            st.rerun()

                st.markdown("---")

                summary_rows = []
                itemized_rows = []

                for b in approved_bills_list:
                    summary_rows.append({
                        "Client": b.get("client_name", ""),
                        "Vendor Name": b["vendor_name"],
                        "GSTIN": b.get("vendor_gstin", ""),
                        "Invoice No": b["invoice_number"],
                        "Date": b["invoice_date"],
                        "Taxable Subtotal (₹)": b["subtotal"],
                        "CGST (₹)": b["cgst"],
                        "SGST (₹)": b["sgst"],
                        "IGST (₹)": b["igst"],
                        "Round-Off (₹)": b.get("round_off", 0.0),
                        "Grand Total (₹)": b["grand_total"],
                    })
                    for itm in b["items"]:
                        itemized_rows.append({
                            "Client": b.get("client_name", ""),
                            "Invoice No": b["invoice_number"],
                            "Vendor Name": b["vendor_name"],
                            "Item": itm.get("description", ""),
                            "HSN": itm.get("hsn_code", ""),
                            "Qty": itm.get("qty", 1),
                            "Rate": itm.get("rate", 0),
                            "Amount": itm.get("amount", 0),
                            "Assigned Ledger": itm.get("ledger", "Purchase")
                        })

                df_summary = pd.DataFrame(summary_rows)
                df_items_approved = pd.DataFrame(itemized_rows)

                st.dataframe(df_summary, use_container_width=True, height=280)

                excel_buf = io.BytesIO()
                with pd.ExcelWriter(excel_buf, engine='openpyxl') as writer:
                    df_summary.to_excel(writer, sheet_name="Invoice Summary", index=False)
                    df_items_approved.to_excel(writer, sheet_name="Item-Wise Ledgers", index=False)

                exp_c1, exp_c2, exp_c3 = st.columns([1, 1, 1])
                with exp_c1:
                    st.download_button(
                        label="📥 Download Excel Register",
                        data=excel_buf.getvalue(),
                        file_name="Approved_Purchase_Register.xlsx",
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        use_container_width=True
                    )
                with exp_c2:
                    xml_data = generate_tally_xml(approved_bills_list)
                    st.download_button(
                        label="📥 Download Tally XML Import",
                        data=xml_data,
                        file_name="Approved_Tally_Import.xml",
                        mime="application/xml",
                        use_container_width=True
                    )
                with exp_c3:
                    if st.button("🧹 Clear Register", type="secondary", use_container_width=True):
                        approved_bills_list = []
                        save_approved_bills(approved_bills_list)
                        st.rerun()

    # ========================================================
    # MODULE 2: BANK STATEMENTS
    # ========================================================
    elif st.session_state["active_main_module"] == "Bank":
        st.markdown(f"""
        <div class="app-panel">
            <h4 style="color: #0D2240; font-family:'Playfair Display',serif; font-weight: 700; margin-top: 0;">Bank Statement Reconciliation: {selected_client}</h4>
            <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 0;">
                Upload bank statements in Excel or CSV. The system cleans narration noise, matches known vendors/customers, and generates Tally Payment & Receipt XML.
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        bank_col1, bank_col2 = st.columns([2, 1])
        with bank_col1:
            uploaded_bank = st.file_uploader(
                "Select Bank Statement (Excel / CSV)",
                type=["xlsx", "xls", "csv"],
                key="bank_file_uploader"
            )
        with bank_col2:
            tally_bank_name = st.text_input("Tally Bank Account Ledger", value="HDFC Bank Current A/c")

        if uploaded_bank is not None:
            if st.session_state["bank_df_working"] is None:
                try:
                    if uploaded_bank.name.endswith(".csv"):
                        df_raw = pd.read_csv(uploaded_bank)
                    else:
                        df_raw = pd.read_excel(uploaded_bank)

                    clean_cols = {c: str(c).strip().lower() for c in df_raw.columns}
                    date_col = next((c for c, n in clean_cols.items() if "date" in n or "txn date" in n), None)
                    narration_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["narration", "description", "particulars", "remarks"])), None)
                    debit_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["debit", "withdrawal", "dr"])), None)
                    credit_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["credit", "deposit", "cr"])), None)

                    if not (date_col and narration_col):
                        st.error("Could not automatically locate 'Date' and 'Narration' columns. Please check your Excel structure.")
                    else:
                        parsed_rows = []
                        rules = load_bank_rules()
                        for _, row in df_raw.iterrows():
                            d_val = str(row.get(date_col, "")).split(" ")[0]
                            n_val = str(row.get(narration_col, "")).strip()
                            if not n_val or n_val.lower() == "nan":
                                continue

                            dr = float(row.get(debit_col, 0.0) or 0.0) if debit_col else 0.0
                            cr = float(row.get(credit_col, 0.0) or 0.0) if credit_col else 0.0

                            matched_ledger = match_learned_ledger(selected_client, n_val, rules, active_ledgers)
                            default_ledger = matched_ledger if matched_ledger else active_ledgers[0]

                            parsed_rows.append({
                                "Date": d_val,
                                "Narration": n_val,
                                "Debit / Withdrawal": dr,
                                "Credit / Deposit": cr,
                                "Assigned Ledger": default_ledger
                            })

                        st.session_state["bank_df_working"] = pd.DataFrame(parsed_rows)
                except Exception as e:
                    st.error(f"Error parsing bank statement: {e}")

        if st.session_state["bank_df_working"] is not None:
            st.markdown(f"#### Verified Transactions ({len(st.session_state['bank_df_working'])} Entries)")
            st.caption("Change any ledger in the table below. Saving will store the rule for future uploads.")

            edited_bank_df = st.data_editor(
                st.session_state["bank_df_working"],
                column_config={
                    "Date": st.column_config.TextColumn("Date", width="small"),
                    "Narration": st.column_config.TextColumn("Bank Transaction Narration", width="large"),
                    "Debit / Withdrawal": st.column_config.NumberColumn("Debit (₹)", format="₹%.2f"),
                    "Credit / Deposit": st.column_config.NumberColumn("Credit (₹)", format="₹%.2f"),
                    "Assigned Ledger": st.column_config.SelectboxColumn(
                        "Assigned Tally Ledger",
                        help="Select the expense, revenue, or party ledger",
                        width="medium",
                        options=active_ledgers,
                        required=True,
                    )
                },
                num_rows="dynamic",
                use_container_width=True
            )

            b_btn1, b_btn2, b_btn3 = st.columns([1, 1, 1])
            with b_btn1:
                if st.button("🧠 Memorize Counterparties", use_container_width=True):
                    rules = load_bank_rules()
                    if selected_client not in rules:
                        rules[selected_client] = {}
                    for _, row in edited_bank_df.iterrows():
                        cleaned_narr = clean_text(row["Narration"])
                        if cleaned_narr:
                            rules[selected_client][cleaned_narr] = row["Assigned Ledger"]
                    save_bank_rules(rules)
                    st.session_state["bank_df_working"] = edited_bank_df
                    st.toast("Bank counterparty rules saved!", icon="💾")
                    st.rerun()

            with b_btn2:
                bank_xml = generate_bank_tally_xml(edited_bank_df, tally_bank_name)
                st.download_button(
                    label="📥 Download Bank Tally XML",
                    data=bank_xml,
                    file_name=f"{selected_client}_Bank_Vouchers.xml",
                    mime="application/xml",
                    use_container_width=True
                )

            with b_btn3:
                if st.button("🗑️ Discard Statement", type="secondary", use_container_width=True):
                    st.session_state["bank_df_working"] = None
                    st.rerun()

    # ========================================================
    # MODULE 3: MASTER SETTINGS
    # ========================================================
    elif st.session_state["active_main_module"] == "Settings":
        st.markdown("""
        <div class="app-panel">
            <h4 style="color: #0D2240; font-family:'Playfair Display',serif; font-weight: 700; margin-top: 0;">Chart of Accounts & AI Memory</h4>
            <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 0;">
                Configure client ledgers and inspect memorized items or bank counterparty rules.
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        cfg_col1, cfg_col2 = st.columns([1, 1], gap="large")

        with cfg_col1:
            st.markdown("<div style='font-weight:700; color:#0D2240; margin-bottom:8px;'>➕ Add New Client Organization</div>", unsafe_allow_html=True)
            new_client_name = st.text_input("Organization Name")
            new_client_ledgers_raw = st.text_area(
                "Expense / Purchase Ledgers (One per line)",
                value="Purchase Account\nPackaging Supplies\nFreight Charges\nOffice Stationery\nBank Charges",
                height=150
            )
            if st.button("Save Organization", type="primary"):
                if new_client_name.strip():
                    ledgers_list = [l.strip() for l in new_client_ledgers_raw.split("\n") if l.strip()]
                    client_masters[new_client_name.strip()] = ledgers_list
                    save_client_masters(client_masters)
                    st.success(f"Saved '{new_client_name}'!")
                    st.rerun()

        with cfg_col2:
            st.markdown(f"<div style='font-weight:700; color:#0F172A; margin-bottom:8px;'>✏️ Edit Ledgers for: <b>{selected_client}</b></div>", unsafe_allow_html=True)
            current_ledgers_text = "\n".join(client_masters.get(selected_client, []))
            updated_text = st.text_area("Chart of Accounts", value=current_ledgers_text, height=150)
            
            s_c1, s_c2 = st.columns(2)
            with s_c1:
                if st.button("💾 Save Ledgers", use_container_width=True):
                    new_list = [l.strip() for l in updated_text.split("\n") if l.strip()]
                    client_masters[selected_client] = new_list
                    save_client_masters(client_masters)
                    st.success("Ledgers updated successfully!")
                    st.rerun()
            with s_c2:
                if st.button("🗑️ Delete Client", type="secondary", use_container_width=True):
                    if selected_client in client_masters:
                        del client_masters[selected_client]
                        save_client_masters(client_masters)
                        st.rerun()

        st.markdown("---")
        m_c1, m_c2 = st.columns(2, gap="large")
        with m_c1:
            st.markdown(f"#### 🧠 Memorized Purchase Items ({selected_client})")
            client_rules_view = item_rules.get(selected_client, {})
            if not client_rules_view:
                st.info("No item rules recorded yet.")
            else:
                rules_display = [{"Item Description": k, "Assigned Ledger": v} for k, v in client_rules_view.items()]
                st.dataframe(pd.DataFrame(rules_display), height=220, use_container_width=True)
                if st.button("Reset Item Rules Cache"):
                    item_rules[selected_client] = {}
                    save_item_rules(item_rules)
                    st.rerun()

        with m_c2:
            st.markdown(f"#### 🏛️ Memorized Bank Parties ({selected_client})")
            bank_rules_view = bank_rules.get(selected_client, {})
            if not bank_rules_view:
                st.info("No bank counterparty rules recorded yet.")
            else:
                bank_display = [{"Counterparty": k, "Assigned Ledger": v} for k, v in bank_rules_view.items()]
                st.dataframe(pd.DataFrame(bank_display), height=220, use_container_width=True)
                if st.button("Reset Bank Rules Cache"):
                    bank_rules[selected_client] = {}
                    save_bank_rules(bank_rules)
                    st.rerun()
