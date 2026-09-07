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

# 2. Refined Professional Light Theme Styling
CUSTOM_CSS = """
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    /* Clean Light Background */
    .stApp {
        background-color: #F8FAFC;
    }
    
    /* Professional Light Sidebar */
    [data-testid="stSidebar"] {
        background-color: #FFFFFF !important;
        border-right: 1px solid #E2E8F0;
    }
    [data-testid="stSidebar"] * {
        color: #0F172A !important;
    }
    [data-testid="stSidebar"] .stSelectbox label, 
    [data-testid="stSidebar"] .stTextInput label {
        font-weight: 700 !important;
        color: #475569 !important;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
    }
    [data-testid="stSidebar"] div[data-baseweb="select"] > div {
        background-color: #F8FAFC !important;
        border: 1px solid #CBD5E1 !important;
        color: #0F172A !important;
    }

    /* Executive Hero Banner */
    .hero-container {
        background: linear-gradient(135deg, #0F2B48 0%, #173E65 60%, #1A5276 100%);
        padding: 22px 30px;
        border-radius: 14px;
        color: #FFFFFF;
        box-shadow: 0 8px 20px -4px rgba(15, 43, 72, 0.12);
        margin-bottom: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .hero-title {
        font-size: 1.65rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 0;
        color: #FFFFFF !important;
    }
    .hero-subtitle {
        font-size: 0.92rem;
        color: #93C5FD !important;
        margin-top: 3px;
        font-weight: 400;
    }
    .hero-badge {
        background: rgba(255, 255, 255, 0.14);
        backdrop-filter: blur(8px);
        padding: 8px 16px;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.25);
        font-weight: 600;
        font-size: 0.85rem;
        color: #FFFFFF !important;
    }

    /* Clean Elevated Tab Navigation */
    .stTabs [data-baseweb="tab-list"] {
        gap: 10px;
        background-color: transparent;
        border-bottom: 2px solid #E2E8F0;
        padding-bottom: 4px;
    }
    .stTabs [data-baseweb="tab"] {
        background: #FFFFFF;
        border: 1px solid #CBD5E1;
        border-radius: 8px 8px 0px 0px;
        padding: 10px 22px;
        font-weight: 700;
        font-size: 0.92rem;
        color: #475569;
        transition: all 0.2s ease;
    }
    .stTabs [data-baseweb="tab"]:hover {
        color: #0F2B48;
        background: #F1F5F9;
    }
    .stTabs [aria-selected="true"] {
        background: #0F2B48 !important;
        color: #FFFFFF !important;
        border-color: #0F2B48 !important;
    }

    /* Clean Card Containers */
    .content-box {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 22px 24px;
        margin-bottom: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .bill-card {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 10px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        transition: all 0.15s ease;
    }
    .bill-card:hover {
        border-color: #0F2B48;
        box-shadow: 0 4px 10px rgba(0,0,0,0.05);
    }

    /* Buttons */
    .stButton>button {
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.88rem;
        padding: 8px 18px;
    }
    .stButton>button[kind="primary"] {
        background-color: #0F2B48;
        border-color: #0F2B48;
    }
    .stButton>button[kind="primary"]:hover {
        background-color: #173E65;
        border-color: #173E65;
    }
</style>
"""
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

# Team Passcode Gate
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
        <div style="max-width: 400px; margin: 80px auto; background: #FFFFFF; padding: 36px; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🔐</div>
            <h3 style="color: #0F2B48; font-weight: 800; margin-bottom: 4px;">Compliance4 Portal</h3>
            <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 24px;">Enter office passcode to continue</p>
        </div>
        """, unsafe_allow_html=True)
        col_gate1, col_gate2, col_gate3 = st.columns([1.2, 1.6, 1.2])
        with col_gate2:
            st.text_input("Office Passcode", type="password", on_change=password_entered, key="password_input", label_visibility="collapsed", placeholder="Passcode...")
        return False
    elif not st.session_state["password_correct"]:
        st.markdown("""
        <div style="max-width: 400px; margin: 80px auto 0 auto; background: #FFFFFF; padding: 36px 36px 12px 36px; border-radius: 16px; border: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🔐</div>
            <h3 style="color: #0F2B48; font-weight: 800; margin-bottom: 4px;">Compliance4 Portal</h3>
            <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 16px;">Enter office passcode to continue</p>
        </div>
        """, unsafe_allow_html=True)
        col_gate1, col_gate2, col_gate3 = st.columns([1.2, 1.6, 1.2])
        with col_gate2:
            st.text_input("Office Passcode", type="password", on_change=password_entered, key="password_input", label_visibility="collapsed", placeholder="Passcode...")
            st.error("Incorrect passcode.")
        return False
    return True

if not check_password():
    st.stop()

LOGO_PATH = "logo.png"

# Persistent File Stores
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
        "Staff Welfare Expense"
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

def clean_text(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

def match_learned_ledger(client_name: str, item_desc: str, rules_dict: dict, valid_ledgers: list) -> Optional[str]:
    client_rules = rules_dict.get(client_name, {})
    if not client_rules:
        return None

    cleaned_query = clean_text(item_desc)
    if not cleaned_query:
        return None

    if cleaned_query in client_rules:
        matched = client_rules[cleaned_query]
        if matched in valid_ledgers:
            return matched

    best_ledger = None
    best_score = 0.0

    for learned_name, ledger_name in client_rules.items():
        if ledger_name not in valid_ledgers:
            continue
        if learned_name in cleaned_query or cleaned_query in learned_name:
            return ledger_name

        sim = SequenceMatcher(None, cleaned_query, learned_name).ratio()
        if sim > best_score and sim >= 0.80:
            best_score = sim
            best_ledger = ledger_name

    return best_ledger

def record_approval_learning(bill_dict: dict):
    client_name = bill_dict.get("client_name", "Default Client")
    rules = load_item_rules()
    if client_name not in rules:
        rules[client_name] = {}

    for item in bill_dict.get("items", []):
        desc = item.get("description", "")
        ledger = item.get("ledger", "")
        clean_desc = clean_text(desc)
        if clean_desc and ledger:
            rules[client_name][clean_desc] = ledger

    save_item_rules(rules)

client_masters = load_client_masters()
item_rules = load_item_rules()
bank_rules = load_bank_rules()

GST_TREATMENTS = ["Regular", "Composition", "Unregistered", "Overseas / Import"]
STATES = ["Gujarat", "Maharashtra", "Delhi", "Rajasthan", "Karnataka", "Tamil Nadu", "Other"]

# Pydantic Schema
class LineItem(BaseModel):
    description: str = Field(description="Description of goods/services")
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
    grand_total: float = Field(description="Grand invoice total")

if "active_review_index" not in st.session_state:
    st.session_state["active_review_index"] = None
if "bank_df_working" not in st.session_state:
    st.session_state["bank_df_working"] = None

pending_bills_list = load_pending_bills()
approved_bills_list = load_approved_bills()

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

        if b["cgst"] > 0:
            xml += f"""            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>CGST Input</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{b["cgst"]:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n"""
        if b["sgst"] > 0:
            xml += f"""            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>SGST Input</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{b["sgst"]:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n"""
        if b["igst"] > 0:
            xml += f"""            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>IGST Input</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{b["igst"]:.2f}</AMOUNT>
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

def process_single_bill(file_name, file_bytes, mime, client, ledgers_str, client_name, valid_ledgers, rules_dict):
    prompt = f"""
    Extract invoice details accurately into structured format.
    For each line item, assign the best matching accounting ledger strictly from this list of ledgers available for this client:
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
                bill_entry["file_base64"] = base64.b64encode(file_bytes).decode("utf-8")
                bill_entry["mime_type"] = mime
                bill_entry["gst_treatment"] = "Regular"
                bill_entry["client_name"] = client_name

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

# --- SIDEBAR (CLEAN WHITE/SLATE) ---
with st.sidebar:
    if os.path.exists(LOGO_PATH):
        st.image(LOGO_PATH, width=190)
    else:
        st.markdown("<h2 style='color:#0F2B48; font-weight:800; margin-top:0;'>Compliance4</h2>", unsafe_allow_html=True)
    
    st.caption("BUSINESS PROCESS OUTSOURCING")
    st.markdown("<hr style='margin: 12px 0 18px 0;'>", unsafe_allow_html=True)

    client_options = list(client_masters.keys())
    if not client_options:
        client_masters = DEFAULT_CLIENTS
        client_options = list(client_masters.keys())

    selected_client = st.selectbox("Active Client Account", options=client_options)
    active_ledgers = client_masters.get(selected_client, ["Purchase Account"])

    try:
        default_key = st.secrets.get("GEMINI_API_KEY", "")
    except Exception:
        default_key = ""

    api_key = default_key if default_key else st.text_input("Gemini API Key", type="password")

    st.markdown("<hr style='margin: 18px 0 14px 0;'>", unsafe_allow_html=True)
    
    current_client_rules = item_rules.get(selected_client, {})
    current_bank_rules = bank_rules.get(selected_client, {})
    
    st.markdown(f"""
    <div style="background: #F1F5F9; padding: 12px 14px; border-radius: 8px; border: 1px solid #E2E8F0;">
        <div style="font-size: 0.72rem; color: #475569; font-weight: 700; text-transform: uppercase;">AI Cache Status</div>
        <div style="font-size: 0.82rem; margin-top: 4px; color: #0F172A;">• <b>{len(current_client_rules)}</b> Invoice Items Memorized</div>
        <div style="font-size: 0.82rem; margin-top: 2px; color: #0F172A;">• <b>{len(current_bank_rules)}</b> Bank Parties Mapped</div>
    </div>
    """, unsafe_allow_html=True)

# Executive Top Banner
st.markdown(f"""
<div class="hero-container">
    <div>
        <h1 class="hero-title">Compliance4 Business</h1>
        <div class="hero-subtitle">Automated Accounting & Tally Integration Architecture</div>
    </div>
    <div class="hero-badge">🏢 {selected_client}</div>
</div>
""", unsafe_allow_html=True)

# --- DETAIL REVIEW WORKSPACE ---
if st.session_state["active_review_index"] is not None and st.session_state["active_review_index"] < len(pending_bills_list):
    idx = st.session_state["active_review_index"]
    bill = pending_bills_list[idx]

    c_nav1, c_nav2 = st.columns([7, 3])
    with c_nav1:
        if st.button("← Back to Invoice Queue", type="secondary"):
            st.session_state["active_review_index"] = None
            st.rerun()
    with c_nav2:
        btn_del, btn_app = st.columns(2)
        with btn_del:
            if st.button("🗑️ Reject Bill", type="secondary", use_container_width=True):
                pending_bills_list.pop(idx)
                save_pending_bills(pending_bills_list)
                st.session_state["active_review_index"] = None
                st.rerun()
        with btn_app:
            if st.button("✅ Approve & Save", type="primary", use_container_width=True):
                approved_entry = pending_bills_list.pop(idx)
                record_approval_learning(approved_entry)
                approved_bills_list.append(approved_entry)
                save_pending_bills(pending_bills_list)
                save_approved_bills(approved_bills_list)
                st.session_state["active_review_index"] = None
                st.toast("Invoice approved and memorized!", icon="✨")
                st.rerun()

    st.markdown("---")
    col_preview, col_form = st.columns([1, 1.1], gap="large")

    with col_preview:
        st.markdown(f"""
        <div class="content-box">
            <div style="font-weight: 700; color: #0F172A;">📄 Document Preview: {bill['file_name']}</div>
        </div>
        """, unsafe_allow_html=True)
        if bill.get("file_base64"):
            img_bytes = base64.b64decode(bill["file_base64"])
            if bill.get("mime_type", "").startswith("image"):
                st.image(img_bytes, use_container_width=True)
            else:
                st.info("PDF document preview active")

    with col_form:
        st.markdown("""
        <div class="content-box">
            <div style="font-weight: 700; color: #0F172A;">Invoice Header & GST Controls</div>
        </div>
        """, unsafe_allow_html=True)

        bill["vendor_name"] = st.text_input("Vendor / Supplier Name", value=bill["vendor_name"])
        bill["billing_address"] = st.text_input("Billing Address", value=bill.get("billing_address", ""))
        
        r1_c1, r1_c2 = st.columns(2)
        with r1_c1:
            curr_gst = bill.get("gst_treatment", "Regular")
            gst_idx = GST_TREATMENTS.index(curr_gst) if curr_gst in GST_TREATMENTS else 0
            bill["gst_treatment"] = st.selectbox("GST Treatment", GST_TREATMENTS, index=gst_idx)
        with r1_c2:
            bill["vendor_gstin"] = st.text_input("Vendor GSTIN", value=bill.get("vendor_gstin", ""))

        r2_c1, r2_c2 = st.columns(2)
        with r2_c1:
            src_idx = STATES.index(bill["source_state"]) if bill.get("source_state") in STATES else 0
            bill["source_state"] = st.selectbox("Source State (Supplier)", STATES, index=src_idx)
        with r2_c2:
            dest_idx = STATES.index(bill["destination_state"]) if bill.get("destination_state") in STATES else 0
            bill["destination_state"] = st.selectbox("Place of Supply (POS)", STATES, index=dest_idx)

        st.markdown("<div style='font-weight: 700; color: #0F172A; margin: 16px 0 8px 0;'>Line Items & Ledger Assignment</div>", unsafe_allow_html=True)

        df_items = pd.DataFrame(bill["items"])
        if "ledger" not in df_items.columns:
            df_items["ledger"] = active_ledgers[0]
        else:
            df_items["ledger"] = df_items["ledger"].apply(
                lambda x: x if x in active_ledgers else active_ledgers[0]
            )

        edited_df = st.data_editor(
            df_items,
            column_config={
                "description": "Item Description",
                "hsn_code": "HSN",
                "qty": st.column_config.NumberColumn("Qty", min_value=0, format="%.2f"),
                "rate": st.column_config.NumberColumn("Rate", format="₹%.2f"),
                "amount": st.column_config.NumberColumn("Taxable (₹)", format="₹%.2f"),
                "ledger": st.column_config.SelectboxColumn(
                    "Tally Purchase Ledger",
                    help="Confirm or adjust the expense ledger for this item",
                    width="medium",
                    options=active_ledgers,
                    required=True,
                )
            },
            num_rows="dynamic",
            use_container_width=True
        )
        bill["items"] = edited_df.to_dict(orient="records")

        st.markdown("<div style='font-weight: 700; color: #0F172A; margin: 16px 0 8px 0;'>Tax Breakdown</div>", unsafe_allow_html=True)
        t_c1, t_c2, t_c3 = st.columns(3)
        with t_c1:
            bill["cgst"] = st.number_input("CGST (₹)", value=float(bill["cgst"]), step=1.0)
        with t_c2:
            bill["sgst"] = st.number_input("SGST (₹)", value=float(bill["sgst"]), step=1.0)
        with t_c3:
            bill["igst"] = st.number_input("IGST (₹)", value=float(bill["igst"]), step=1.0)

        bill["narration"] = st.text_area(
            "Voucher Narration",
            value=bill.get("narration", f"Purchase from {bill['vendor_name']} via Inv #{bill['invoice_number']}")
        )

        subtotal = sum([float(row.get("amount", 0.0)) for row in bill["items"]])
        grand_total = subtotal + bill["cgst"] + bill["sgst"] + bill["igst"]
        bill["subtotal"] = subtotal
        bill["grand_total"] = grand_total

        pending_bills_list[idx] = bill
        save_pending_bills(pending_bills_list)

        st.markdown(f"""
        <div style="background: #F1F5F9; border: 1px solid #CBD5E1; padding: 18px 24px; border-radius: 12px; margin-top: 16px;">
            <div style="display: flex; justify-content: space-between; font-weight: 600; color: #475569; font-size: 0.95rem;">
                <span>Taxable Subtotal: ₹{subtotal:,.2f}</span>
                <span>GST Total: ₹{(bill['cgst']+bill['sgst']+bill['igst']):,.2f}</span>
            </div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #0F172A; margin-top: 8px;">Grand Total: ₹{grand_total:,.2f}</div>
        </div>
        """, unsafe_allow_html=True)

# --- MAIN DASHBOARD: MODULARIZED SECTIONS ---
else:
    if st.session_state["active_review_index"] is not None:
        st.session_state["active_review_index"] = None

    # PRIMARY HIGH-LEVEL MODULES
    mod_purchase, mod_bank, mod_settings = st.tabs([
        "🧾 Purchase Invoices Module",
        "🏦 Bank Statement Module",
        "⚙️ Master Settings"
    ])

    # ==========================================
    # MODULE 1: PURCHASE INVOICES
    # ==========================================
    with mod_purchase:
        p_sub_upload, p_sub_review, p_sub_approved = st.tabs([
            "📤 Upload Invoices",
            f"📝 Needs Review ({len(pending_bills_list)})",
            f"✅ Approved Vouchers ({len(approved_bills_list)})"
        ])

        # SUB-TAB 1: UPLOAD
        with p_sub_upload:
            st.markdown(f"""
            <div class="content-box">
                <h4 style="color: #0F172A; font-weight: 700; margin-top: 0;">Upload Purchase Documents: {selected_client}</h4>
                <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 0;">
                    Upload purchase bills (PDF, JPG, PNG). The system extracts items and auto-assigns memorized ledgers.
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
                    status_placeholder.info("⚡ Extracting line items and matching learned ledgers...")

                    prepared_files = []
                    for f in uploaded_files:
                        f.seek(0)
                        mime, optimized_bytes = optimize_file(f.name, f.read())
                        prepared_files.append((f.name, optimized_bytes, mime))

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
                                client,
                                ledgers_str,
                                selected_client,
                                active_ledgers,
                                fresh_rules
                            )
                            for fname, fbytes, fmime in prepared_files
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

        # SUB-TAB 2: NEEDS REVIEW
        with p_sub_review:
            if not pending_bills_list:
                st.markdown("""
                <div style="background: #FFFFFF; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 40px; text-align: center;">
                    <div style="font-size: 2rem; margin-bottom: 6px;">🎉</div>
                    <h4 style="color: #0F172A; font-weight: 700; margin-bottom: 4px;">Queue Completely Cleared</h4>
                    <p style="color: #64748B; font-size: 0.88rem; margin: 0;">No purchase bills currently awaiting review.</p>
                </div>
                """, unsafe_allow_html=True)
            else:
                for idx, item in enumerate(pending_bills_list):
                    st.markdown(f"""
                    <div class="bill-card">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div style="font-size: 1.05rem; font-weight: 700; color: #0F172A;">{item['vendor_name']}</div>
                                <div style="font-size: 0.82rem; color: #64748B; margin-top: 3px;">
                                    <b>Invoice:</b> #{item['invoice_number']} &nbsp;|&nbsp; <b>Date:</b> {item['invoice_date']} &nbsp;|&nbsp; <b>GSTIN:</b> {item.get('vendor_gstin', 'N/A')}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.25rem; font-weight: 800; color: #0F2B48;">₹{item['grand_total']:,.2f}</div>
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

        # SUB-TAB 3: APPROVED ARCHIVE
        with p_sub_approved:
            if not approved_bills_list:
                st.info("No approved purchase vouchers present yet.")
            else:
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

                st.write("")
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

    # ==========================================
    # MODULE 2: BANK STATEMENTS
    # ==========================================
    with mod_bank:
        st.markdown(f"""
        <div class="content-box">
            <h4 style="color: #0F172A; font-weight: 700; margin-top: 0;">Bank Statement Reconciliation: {selected_client}</h4>
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

    # ==========================================
    # MODULE 3: MASTER SETTINGS
    # ==========================================
    with mod_settings:
        st.markdown("""
        <div class="content-box">
            <h4 style="color: #0F172A; font-weight: 700; margin-top: 0;">Chart of Accounts & AI Memory</h4>
            <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 0;">
                Configure client ledgers and inspect memorized items or bank counterparty rules.
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        cfg_col1, cfg_col2 = st.columns([1, 1], gap="large")

        with cfg_col1:
            st.markdown("<div style='font-weight:700; color:#0F172A; margin-bottom:8px;'>➕ Add New Client Organization</div>", unsafe_allow_html=True)
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
            st.markdown(f"#### 🏦 Memorized Bank Parties ({selected_client})")
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
