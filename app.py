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
from streamlit_gsheets import GSheetsConnection

# 1. Page Config
st.set_page_config(
    page_title="Compliance4 Business | Accounting Portal",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="expanded"
)

IMAGE_STORAGE_DIR = "invoice_images"
os.makedirs(IMAGE_STORAGE_DIR, exist_ok=True)

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

# 4. Chart of Accounts & Cloud Persistence
try:
    conn = st.connection("gsheets", type=GSheetsConnection)
except Exception:
    conn = None

DEFAULT_CLIENTS = {
    "The Marx Ventures": [
        "HDFC Bank A/c - 8050",
        "ICICI Bank - 0026",
        "Bank In Transit - Amex",
        "Bank In Transit - VISA/Rupee/Master",
        "Cash in Hand",
        "UPI and Cards Receipts",
        "UPI Collection",
        "Salary Payable",
        "Blinkit",
        "Swiggy Limited",
        "Zomato Limited",
        "Amazon",
        "SADABAHAR ENTERPRISE",
        "SAHIB FINE FOODS",
        "JAIN DAIRY PRODUCTS",
        "AVOFRESH",
        "HEARTY MART ENTERPRISE PVT LTD",
        "CZAR COFFEE LLP",
        "GOLOKA DAIRY PRODUCTS PVT LTD",
        "SMA HOSPITALITY SOLUTION",
        "RHP 4GLOBAL",
        "NILKANTH COLD PRODUCTS",
        "SAMVAR TRADERS",
        "Prepaid FSSAI Licenses",
        "TDS Payable - Salaries (192)",
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
        "Salary & Wages",
        "Miscellaneous Expenses",
        "Miscellaneous Exp"
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

@st.cache_data(ttl=10, show_spinner=False)
def _cached_read_gsheet():
    if conn is None:
        return pd.DataFrame(columns=["key", "data"])
    try:
        df = conn.read(worksheet="app_data", ttl="10s")
        if df is None or df.empty or "key" not in df.columns:
            return pd.DataFrame(columns=["key", "data"])
        df = df.dropna(subset=["key"]).copy()
        df["key"] = df["key"].astype(str).str.strip()
        df["data"] = df["data"].astype(str)
        return df
    except Exception:
        return pd.DataFrame(columns=["key", "data"])

def _get_gsheet_df():
    return _cached_read_gsheet()

def _read_store(key: str, default_val):
    try:
        df = _get_gsheet_df()
        row = df[df["key"] == key]
        if not row.empty:
            raw_json = row.iloc[0]["data"].strip()
            if raw_json and raw_json != "nan":
                return json.loads(raw_json)
        
        chunk_rows = df[df["key"].str.startswith(f"{key}_part_")].sort_values("key")
        if not chunk_rows.empty:
            combined_json = "".join([str(x) for x in chunk_rows["data"].values])
            return json.loads(combined_json)
    except Exception:
        pass

    if os.path.exists(f"{key}.json"):
        try:
            with open(f"{key}.json", "r") as f:
                return json.load(f)
        except Exception:
            return default_val
    return default_val

def _write_store(key: str, val):
    try:
        with open(f"{key}.json", "w") as f:
            json.dump(val, f, indent=4)
    except Exception:
        pass

    if conn is not None:
        for attempt in range(2):
            try:
                _cached_read_gsheet.clear()
                df = _cached_read_gsheet()
                json_str = json.dumps(val)

                df = df[(df["key"] != key) & (~df["key"].str.startswith(f"{key}_part_"))].copy()

                CHUNK_SIZE = 35000
                if len(json_str) <= CHUNK_SIZE:
                    new_row = pd.DataFrame([{"key": key, "data": json_str}])
                    df = pd.concat([df, new_row], ignore_index=True)
                else:
                    chunks = [json_str[i:i + CHUNK_SIZE] for i in range(0, len(json_str), CHUNK_SIZE)]
                    new_rows = []
                    for c_idx, c_text in enumerate(chunks):
                        new_rows.append({"key": f"{key}_part_{c_idx:02d}", "data": c_text})
                    df = pd.concat([df, pd.DataFrame(new_rows)], ignore_index=True)

                conn.update(worksheet="app_data", data=df)
                _cached_read_gsheet.clear()
                break
            except Exception as e:
                if "429" in str(e) and attempt == 0:
                    time.sleep(2)
                    continue

def load_client_masters():
    res = _read_store("client_ledgers", DEFAULT_CLIENTS)
    if not res:
        return DEFAULT_CLIENTS
    for c_name, d_leds in DEFAULT_CLIENTS.items():
        if c_name in res:
            existing = set(res[c_name])
            for dl in d_leds:
                if dl not in existing:
                    res[c_name].append(dl)
        else:
            res[c_name] = d_leds
    return res

def save_client_masters(data):
    _write_store("client_ledgers", data)

def load_pending_bills():
    return _read_store("pending_bills", [])

def save_pending_bills(bills):
    _write_store("pending_bills", bills)

def load_approved_bills():
    return _read_store("approved_bills", [])

def save_approved_bills(bills):
    _write_store("approved_bills", bills)

def load_item_rules():
    return _read_store("item_ledger_rules", {})

def save_item_rules(rules):
    _write_store("item_ledger_rules", rules)

def load_bank_rules():
    return _read_store("bank_ledger_rules", {})

def save_bank_rules(rules):
    _write_store("bank_ledger_rules", rules)

def load_cloud_bank_statement(client_name: str):
    return _read_store(f"active_stmt_{client_name}", [])

def save_cloud_bank_statement(client_name: str, records: list):
    _write_store(f"active_stmt_{client_name}", records)

# 5. Precision Bank Counterparty Extractor
STOP_WORDS = {
    "1ltr", "1 ltr", "ltr", "500g", "1kg", "kg", "gm", "ml", 
    "pkt", "pcs", "box", "can", "tin", "nos", "no", "unit", 
    "pack", "bottle", "bottles", "jar", "jars"
}

BLANK_LEDGER_LABEL = "-- Select Ledger --"

def clean_text(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    tokens = [t for t in text.split() if t not in STOP_WORDS]
    return " ".join(tokens).strip()

def extract_pure_counterparty(narration: str) -> str:
    text = str(narration).strip()
    if not text or text.lower() == "nan":
        return ""

    if "/" in text:
        parts = [p.strip() for p in text.split("/") if p.strip()]
        meaningful = [p for p in parts if not re.match(r'^[0-9]+$', p) and len(p) > 2 and not re.match(r'^[a-z]{4}[0-9]+$', p.lower())]
        if meaningful:
            cand = meaningful[-1]
            if len(cand) > 2 and not cand.lower().startswith("inf") and not cand.lower().startswith("neft"):
                return clean_text(cand)

    t = text.lower()
    t = re.sub(r'\b(upi|neft|rtgs|imps|pos|ach|nach|inb|mb|chq|e-pay|rev-upi|dr|cr|trf)\b', ' ', t)
    t = re.sub(r'/[0-9a-z_-]+', ' ', t)
    t = re.sub(r'\b[0-9]{5,}\b', ' ', t)
    t = re.sub(r'\b[a-z]{4}[0-9]{6,}\b', ' ', t)
    t = re.sub(r'@[a-z]+', ' ', t)
    t = re.sub(r'[^a-z0-9\s]', ' ', t)
    tokens = [tok for tok in t.split() if tok not in STOP_WORDS and len(tok) > 2]
    return " ".join(tokens).strip()

def compute_file_hash(raw_bytes: bytes) -> str:
    return hashlib.md5(raw_bytes).hexdigest()

def match_learned_ledger(client_name: str, query_string: str, rules_dict: dict, valid_ledgers: list, is_bank: bool = False) -> Optional[str]:
    client_rules = rules_dict.get(client_name, {})
    if not client_rules:
        return None

    cleaned_query = extract_pure_counterparty(query_string) if is_bank else clean_text(query_string)
    if not cleaned_query:
        return None

    clean_valid_map = {l.strip().lower(): l for l in valid_ledgers}

    if cleaned_query in client_rules:
        target_led = client_rules[cleaned_query].strip()
        if target_led.lower() in clean_valid_map:
            return clean_valid_map[target_led.lower()]
        return target_led

    query_tokens = set(cleaned_query.split())
    best_ledger = None
    best_score = 0.0

    for learned_name, ledger_name in client_rules.items():
        clean_target = learned_name.strip().lower()
        target_tokens = set(clean_target.split())
        if not target_tokens:
            continue

        if target_tokens.issubset(query_tokens) or query_tokens.issubset(target_tokens):
            score = len(target_tokens.intersection(query_tokens)) / max(len(target_tokens), len(query_tokens))
            if score > best_score and score >= 0.85:
                best_score = score
                best_ledger = ledger_name.strip()

    if best_ledger:
        if best_ledger.lower() in clean_valid_map:
            return clean_valid_map[best_ledger.lower()]
        return best_ledger

    return None

def record_approval_learning(bill_dict: dict):
    client_name = bill_dict.get("client_name", "Default Client")
    rules = load_item_rules()
    if client_name not in rules:
        rules[client_name] = {}

    for item in bill_dict.get("items", []):
        desc = item.get("description", "")
        ledger = item.get("ledger", "").strip()
        clean_desc = clean_text(desc)
        if clean_desc and ledger and ledger != BLANK_LEDGER_LABEL:
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
    st.session_state["active_main_module"] = "Bank"
if "zoom_level" not in st.session_state:
    st.session_state["zoom_level"] = 100

pending_bills_list = load_pending_bills()
approved_bills_list = load_approved_bills()

# 7. XML Generators
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
            xml += f"""            <ALLLEDGERENTRIES.LIST>
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

        round_off_val = round(float(b.get("round_off", 0.0)), 2)
        if round_off_val != 0.0:
            if round_off_val > 0:
                xml += f"""            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Round Off</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{round_off_val:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n"""
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
        elif len(clean_date) == 8 and "/" in raw_date:
            p = raw_date.split("/")
            if len(p[0]) == 2:
                clean_date = f"{p[2]}{p[1]}{p[0]}"
        elif len(clean_date) != 8:
            clean_date = time.strftime("%Y%m%d")

        narration = str(row.get("Narration", "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        assigned_ledger = str(row.get("Assigned Ledger", "Suspense Account"))
        if assigned_ledger == BLANK_LEDGER_LABEL:
            assigned_ledger = "Suspense Account"

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
            with Image.open(io.BytesIO(raw_bytes)) as img:
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                img.thumbnail((1200, 1200), Image.Resampling.BILINEAR)
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=75, optimize=True)
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
                bill_entry["mime_type"] = mime
                bill_entry["gst_treatment"] = "Regular"
                bill_entry["client_name"] = client_name

                saved_rel_path = os.path.join(IMAGE_STORAGE_DIR, f"{file_hash[:12]}_{file_name}")
                with open(saved_rel_path, "wb") as f_out:
                    f_out.write(file_bytes)
                bill_entry["saved_image_path"] = saved_rel_path

                calc_expected = bill_entry["subtotal"] + bill_entry["cgst"] + bill_entry["sgst"] + bill_entry["igst"]
                if bill_entry.get("round_off", 0.0) == 0.0 and abs(bill_entry["grand_total"] - calc_expected) > 0.001:
                    bill_entry["round_off"] = round(bill_entry["grand_total"] - calc_expected, 2)

                for itm in bill_entry.get("items", []):
                    learned_ledger = match_learned_ledger(
                        client_name,
                        itm.get("description", ""),
                        rules_dict,
                        valid_ledgers,
                        is_bank=False
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

# 10. Detail Review Workspace
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

        img_path = bill.get("saved_image_path", "")
        if img_path and os.path.exists(img_path):
            with open(img_path, "rb") as f_img:
                b64_data = base64.b64encode(f_img.read()).decode("utf-8")
            img_data_uri = f"data:{bill.get('mime_type', 'image/jpeg')};base64,{b64_data}"
            st.markdown(f"""
            <div class="zoom-container">
                <img src="{img_data_uri}" style="width: {st.session_state['zoom_level']}%; max-width: none; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);" />
            </div>
            """, unsafe_allow_html=True)
        elif bill.get("file_base64"):
            img_data_uri = f"data:{bill.get('mime_type', 'image/jpeg')};base64,{bill['file_base64']}"
            st.markdown(f"""
            <div class="zoom-container">
                <img src="{img_data_uri}" style="width: {st.session_state['zoom_level']}%; max-width: none; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);" />
            </div>
            """, unsafe_allow_html=True)
        else:
            st.info("Document preview active (PDF or disk file).")

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
                    re_matched = match_learned_ledger(selected_client, itm.get("description", ""), item_rules, active_ledgers, is_bank=False)
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
                v_round_off = st.number_input("Round-Off (₹)", value=float(bill.get("round_off", 0.0)), step=0.01, format="%.2f", help="Paisa adjustment to match printed invoice total")

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
                img_to_del = bill.get("saved_image_path", "")
                if img_to_del and os.path.exists(img_to_del):
                    try:
                        os.remove(img_to_del)
                    except Exception:
                        pass

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

# 11. Main Dashboard Interface
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
                    Upload purchase bills (PDF, JPG, PNG). Files are compressed to optimize RAM usage, and duplicate files are skipped before AI extraction.
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
                        st.info(f"🛡️ Skipped {len(skipped_duplicates)} identical file(s) already in the database: {', '.join(skipped_duplicates)}")

                    if not prepared_files:
                        if skipped_duplicates:
                            st.warning("All uploaded files were already processed previously.")
                    else:
                        ledgers_str = ", ".join(active_ledgers)
                        completed_count = 0
                        total_files = len(prepared_files)
                        newly_extracted = []

                        fresh_rules = load_item_rules()
                        max_workers = min(2, total_files)

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
    # MODULE 2: BANK STATEMENTS (STABLE IN-PLACE EDITING)
    # ========================================================
    elif st.session_state["active_main_module"] == "Bank":
        st.markdown(f"""
        <div class="app-panel">
            <h4 style="color: #0D2240; font-family:'Playfair Display',serif; font-weight: 700; margin-top: 0;">Bank Statement Reconciliation: {selected_client}</h4>
            <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 0;">
                Edit continuously without page jumping. Selected ledgers register on the first click and remain steady.
            </p>
        </div>
        """, unsafe_allow_html=True)

        rules = load_bank_rules()
        clean_active_ledgers = [l.strip() for l in active_ledgers]

        # Fetch cloud statement if working dataframe is empty
        if st.session_state["bank_df_working"] is None:
            cloud_records = load_cloud_bank_statement(selected_client)
            if cloud_records:
                for r in cloud_records:
                    curr = r.get("Assigned Ledger", BLANK_LEDGER_LABEL)
                    if not curr or curr == BLANK_LEDGER_LABEL:
                        m_led = match_learned_ledger(selected_client, r.get("Narration", ""), rules, clean_active_ledgers, is_bank=True)
                        if m_led:
                            r["Assigned Ledger"] = m_led
                st.session_state["bank_df_working"] = pd.DataFrame(cloud_records)

        bank_col1, bank_col2 = st.columns([2, 1])
        with bank_col1:
            uploaded_bank = st.file_uploader(
                "Select Bank Statement (Excel / CSV)",
                type=["xlsx", "xls", "csv"],
                key="bank_file_uploader"
            )
        with bank_col2:
            tally_bank_name = st.text_input("Tally Bank Account Ledger", value="ICICI Bank")

        if uploaded_bank is not None:
            try:
                if uploaded_bank.name.endswith(".csv"):
                    df_raw = pd.read_csv(uploaded_bank)
                else:
                    df_raw = pd.read_excel(uploaded_bank)

                def find_header_df(df_in):
                    for r_idx in range(min(15, len(df_in))):
                        row_vals = [str(x).lower().strip() for x in df_in.iloc[r_idx].values]
                        if any("date" in v for v in row_vals) and any(any(k in v for k in ["description", "particulars", "narration", "remarks"]) for v in row_vals):
                            df_in.columns = df_in.iloc[r_idx]
                            return df_in.iloc[r_idx + 1:].reset_index(drop=True)
                    return df_in

                test_cols = [str(c).lower().strip() for c in df_raw.columns]
                if not (any("date" in c for c in test_cols) and any(any(k in c for k in ["description", "particulars", "narration", "remarks"]) for c in test_cols)):
                    df_raw = find_header_df(df_raw)

                clean_cols = {c: str(c).strip().lower() for c in df_raw.columns}

                date_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["value date", "txn date", "transaction date", "date"])), None)
                narration_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["description", "narration", "particulars", "remarks"])), None)
                indicator_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["cr/dr", "dr/cr", "cr / dr", "dr / cr", "type"])), None)
                txn_amount_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["transaction amount", "txn amount", "amount(inr)", "amount (inr)"]) and "balance" not in n), None)
                debit_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["debit", "withdrawal", "dr amount"]) and c != indicator_col), None)
                credit_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["credit", "deposit", "cr amount"]) and c != indicator_col), None)

                if not (date_col and narration_col):
                    st.error("Could not automatically locate 'Date' and 'Description / Narration' columns. Please check your file layout.")
                else:
                    parsed_rows = []

                    def parse_num(val):
                        if pd.isna(val):
                            return 0.0
                        s = str(val).replace(",", "").strip()
                        s = re.sub(r'[^0-9.-]', '', s)
                        try:
                            return float(s) if s else 0.0
                        except Exception:
                            return 0.0

                    for _, row in df_raw.iterrows():
                        d_val = str(row.get(date_col, "")).split(" ")[0].strip()
                        n_val = str(row.get(narration_col, "")).strip()
                        if not n_val or n_val.lower() == "nan":
                            continue

                        dr = 0.0
                        cr = 0.0

                        if indicator_col and txn_amount_col:
                            ind = str(row.get(indicator_col, "")).strip().upper()
                            amt = parse_num(row.get(txn_amount_col, 0.0))
                            if "DR" in ind:
                                dr = amt
                            elif "CR" in ind:
                                cr = amt
                        else:
                            if debit_col:
                                dr = parse_num(row.get(debit_col, 0.0))
                            if credit_col:
                                cr = parse_num(row.get(credit_col, 0.0))

                        if dr == 0.0 and cr == 0.0:
                            continue

                        matched_ledger = match_learned_ledger(selected_client, n_val, rules, clean_active_ledgers, is_bank=True)
                        default_ledger = matched_ledger if matched_ledger else BLANK_LEDGER_LABEL

                        parsed_rows.append({
                            "Date": d_val,
                            "Narration": n_val,
                            "Debit / Withdrawal": dr,
                            "Credit / Deposit": cr,
                            "Assigned Ledger": default_ledger
                        })

                    if not parsed_rows:
                        st.warning("No transactions found in this document.")
                    else:
                        st.session_state["bank_df_working"] = pd.DataFrame(parsed_rows)
                        save_cloud_bank_statement(selected_client, parsed_rows)
                        st.toast("Bank statement synced to Google Sheets for all PCs!", icon="☁️")
            except Exception as e:
                st.error(f"Error parsing bank statement: {e}")

        if st.session_state["bank_df_working"] is not None:
            working_df = st.session_state["bank_df_working"]

            # Compute exhaustive dropdown options
            unique_in_df = [str(x) for x in working_df["Assigned Ledger"].unique() if x and x != BLANK_LEDGER_LABEL]
            merged_options = [BLANK_LEDGER_LABEL] + list(dict.fromkeys(clean_active_ledgers + unique_in_df))

            total_count = len(working_df)
            pending_count = (working_df["Assigned Ledger"] == BLANK_LEDGER_LABEL).sum()
            assigned_count = total_count - pending_count

            st.markdown(f"#### Verified Transactions ({total_count} Entries — {assigned_count} Categorized, {pending_count} Pending)")

            # View Filter to reduce scrolling without premature disappearance
            v_col1, v_col2 = st.columns([2.2, 1.8])
            with v_col1:
                filter_view = st.selectbox(
                    "Display Focus",
                    options=[
                        f"All Transactions ({total_count})",
                        f"Unassigned Only ({pending_count})"
                    ],
                    index=0,
                    key="bank_view_focus"
                )
            with v_col2:
                st.caption("⚡ Direct in-place editing. Click 'Memorize & Auto-Fill' below to apply matching rules.")

            if "Unassigned Only" in filter_view:
                view_subset = working_df[working_df["Assigned Ledger"] == BLANK_LEDGER_LABEL].copy()
            else:
                view_subset = working_df.copy()

            # Render Stable Grid (No key modification, no automatic reruns on keystroke)
            edited_grid_output = st.data_editor(
                view_subset,
                key="bank_stable_editor_v1",
                column_config={
                    "Date": st.column_config.TextColumn("Date", width="small", disabled=True),
                    "Narration": st.column_config.TextColumn("Bank Transaction Narration", width="large", disabled=True),
                    "Debit / Withdrawal": st.column_config.NumberColumn("Debit (₹)", format="₹%.2f", disabled=True),
                    "Credit / Deposit": st.column_config.NumberColumn("Credit (₹)", format="₹%.2f", disabled=True),
                    "Assigned Ledger": st.column_config.SelectboxColumn(
                        "Assigned Tally Ledger",
                        help="Select ledger. Click 'Memorize & Auto-Fill' to sync across identical counterparties.",
                        width="medium",
                        options=merged_options,
                        required=True,
                    )
                },
                num_rows="fixed",
                use_container_width=True
            )

            # Apply in-place edits from the visible view into master working_df
            for r_idx in range(len(edited_grid_output)):
                orig_index = edited_grid_output.index[r_idx]
                new_assigned = edited_grid_output.iloc[r_idx]["Assigned Ledger"]
                working_df.at[orig_index, "Assigned Ledger"] = new_assigned

            st.session_state["bank_df_working"] = working_df

            st.write("")
            b_btn1, b_btn2, b_btn3, b_btn4 = st.columns([1.5, 1.2, 1.2, 1])

            with b_btn1:
                if st.button("🧠 Memorize & Auto-Fill Matching", type="primary", use_container_width=True, help="Learns your selected ledgers and auto-fills all identical counterparties across the statement"):
                    current_df = st.session_state["bank_df_working"].copy()
                    if selected_client not in rules:
                        rules[selected_client] = {}

                    # Learn from all assigned rows
                    for _, row in current_df.iterrows():
                        l_val = row["Assigned Ledger"]
                        if l_val != BLANK_LEDGER_LABEL:
                            c_key = extract_pure_counterparty(row["Narration"])
                            if c_key:
                                rules[selected_client][c_key] = l_val

                    # Propagate strictly to identical counterparties
                    auto_filled_count = 0
                    for j in range(len(current_df)):
                        if current_df.at[j, "Assigned Ledger"] == BLANK_LEDGER_LABEL:
                            row_key = extract_pure_counterparty(current_df.at[j, "Narration"])
                            if row_key and row_key in rules[selected_client]:
                                current_df.at[j, "Assigned Ledger"] = rules[selected_client][row_key]
                                auto_filled_count += 1

                    save_bank_rules(rules)
                    save_cloud_bank_statement(selected_client, current_df.to_dict(orient="records"))
                    st.session_state["bank_df_working"] = current_df
                    st.toast(f"Rules saved! Auto-filled {auto_filled_count} matching entries.", icon="✨")
                    st.rerun()

            with b_btn2:
                if st.button("💾 Save Verified Rules", use_container_width=True):
                    current_df = st.session_state["bank_df_working"]
                    if selected_client not in rules:
                        rules[selected_client] = {}

                    for _, row in current_df.iterrows():
                        l_val = row["Assigned Ledger"]
                        if l_val != BLANK_LEDGER_LABEL:
                            c_key = extract_pure_counterparty(row["Narration"])
                            if c_key:
                                rules[selected_client][c_key] = l_val

                    save_bank_rules(rules)
                    save_cloud_bank_statement(selected_client, current_df.to_dict(orient="records"))
                    st.toast("Current progress saved to Google Sheets!", icon="💾")

            with b_btn3:
                bank_xml = generate_bank_tally_xml(st.session_state["bank_df_working"], tally_bank_name)
                st.download_button(
                    label="📥 Download Bank Tally XML",
                    data=bank_xml,
                    file_name=f"{selected_client}_Bank_Vouchers.xml",
                    mime="application/xml",
                    use_container_width=True
                )

            with b_btn4:
                if st.button("🗑️ Discard Statement", type="secondary", use_container_width=True):
                    st.session_state["bank_df_working"] = None
                    save_cloud_bank_statement(selected_client, [])
                    st.toast("Statement cleared.", icon="🗑️")
                    st.rerun()

    # ========================================================
    # MODULE 3: MASTER SETTINGS
    # ========================================================
    elif st.session_state["active_main_module"] == "Settings":
        st.markdown("""
        <div class="app-panel">
            <h4 style="color: #0D2240; font-family:'Playfair Display',serif; font-weight: 700; margin-top: 0;">Chart of Accounts & Cloud Database</h4>
            <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 0;">
                Configure client ledgers and inspect memorized items or bank counterparty rules saved in your Google Sheet database.
            </p>
        </div>
        """, unsafe_allow_html=True)

        if st.button("☁️ Test Google Sheets Connection"):
            try:
                test_df = _get_gsheet_df()
                st.success(f"Connection OK! Connected to Google Sheets ({len(test_df)} database records found).")
            except Exception as e:
                st.error(f"Connection Error: {e}")

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
                    st.success(f"Saved '{new_client_name}' to Google Sheets!")
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
                    st.success("Ledgers updated and synced to Google Sheets!")
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
