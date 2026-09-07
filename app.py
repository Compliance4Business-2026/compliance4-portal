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

# 1. Page Config & Custom Styling
st.set_page_config(
    page_title="Compliance4 Business - Smart Accounting Portal",
    page_icon="💼",
    layout="wide"
)

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
        st.markdown("### 🔒 Compliance4 Business - Team Login")
        st.text_input("Enter Office Passcode", type="password", on_change=password_entered, key="password_input")
        return False
    elif not st.session_state["password_correct"]:
        st.markdown("### 🔒 Compliance4 Business - Team Login")
        st.text_input("Enter Office Passcode", type="password", on_change=password_entered, key="password_input")
        st.error("Incorrect passcode. Please try again.")
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

# 2. Pydantic Extraction Schema
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

# 3. Active States
if "active_review_index" not in st.session_state:
    st.session_state["active_review_index"] = None
if "bank_df_working" not in st.session_state:
    st.session_state["bank_df_working"] = None

pending_bills_list = load_pending_bills()
approved_bills_list = load_approved_bills()

# 4. Multi-Ledger Purchase Tally XML Generator
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

# 5. Bank Statements Tally XML Generator (Payments & Receipts)
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

        # Withdrawal / Payment Voucher
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

        # Deposit / Receipt Voucher
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

# 6. Sidebar Branding & Client Selection
if os.path.exists(LOGO_PATH):
    st.sidebar.image(LOGO_PATH, width=180)
else:
    st.sidebar.title("Compliance4 Business")

st.sidebar.markdown("---")

try:
    default_key = st.secrets.get("GEMINI_API_KEY", "")
except Exception:
    default_key = ""

api_key = default_key if default_key else st.sidebar.text_input("Enter Gemini API Key", type="password")

client_options = list(client_masters.keys())
if not client_options:
    client_masters = DEFAULT_CLIENTS
    client_options = list(client_masters.keys())

selected_client = st.sidebar.selectbox("🏢 Active Client / Company", options=client_options)
active_ledgers = client_masters.get(selected_client, ["Purchase Account"])

current_client_rules = item_rules.get(selected_client, {})
st.sidebar.caption(f"🧠 Learned Item Rules: **{len(current_client_rules)} items**")
current_bank_rules = bank_rules.get(selected_client, {})
st.sidebar.caption(f"🧠 Learned Bank Rules: **{len(current_bank_rules)} counterparties**")

# --- DETAIL REVIEW SCREEN (PURCHASES) ---
if st.session_state["active_review_index"] is not None and st.session_state["active_review_index"] < len(pending_bills_list):
    idx = st.session_state["active_review_index"]
    bill = pending_bills_list[idx]

    top_c1, top_c2 = st.columns([8, 2])
    with top_c1:
        if st.button("← Back to Pending List"):
            st.session_state["active_review_index"] = None
            st.rerun()
    with top_c2:
        col_del, col_app = st.columns(2)
        with col_del:
            if st.button("🗑️ Delete Bill", type="secondary"):
                pending_bills_list.pop(idx)
                save_pending_bills(pending_bills_list)
                st.session_state["active_review_index"] = None
                st.rerun()
        with col_app:
            if st.button("✅ Approve", type="primary"):
                approved_entry = pending_bills_list.pop(idx)
                record_approval_learning(approved_entry)
                approved_bills_list.append(approved_entry)
                save_pending_bills(pending_bills_list)
                save_approved_bills(approved_bills_list)
                st.session_state["active_review_index"] = None
                st.success("Invoice Approved & Memory Updated!")
                st.rerun()

    st.divider()

    col_left, col_right = st.columns([1, 1])

    with col_left:
        st.subheader(f"📄 {bill['file_name']}")
        if bill.get("file_base64"):
            img_bytes = base64.b64decode(bill["file_base64"])
            if bill.get("mime_type", "").startswith("image"):
                st.image(img_bytes, width=450)
            else:
                st.info("PDF document preview active")

    with col_right:
        st.subheader("Invoice Header & Tax Details")
        bill["vendor_name"] = st.text_input("Vendor Name", value=bill["vendor_name"])
        bill["billing_address"] = st.text_input("Billing Address", value=bill.get("billing_address", ""))
        
        r1_c1, r1_c2 = st.columns(2)
        with r1_c1:
            curr_gst = bill.get("gst_treatment", "Regular")
            gst_idx = GST_TREATMENTS.index(curr_gst) if curr_gst in GST_TREATMENTS else 0
            bill["gst_treatment"] = st.selectbox("GST Treatment", GST_TREATMENTS, index=gst_idx)
        with r1_c2:
            bill["vendor_gstin"] = st.text_input("GSTIN", value=bill.get("vendor_gstin", ""))

        r2_c1, r2_c2 = st.columns(2)
        with r2_c1:
            src_idx = STATES.index(bill["source_state"]) if bill.get("source_state") in STATES else 0
            bill["source_state"] = st.selectbox("Source of Supply", STATES, index=src_idx)
        with r2_c2:
            dest_idx = STATES.index(bill["destination_state"]) if bill.get("destination_state") in STATES else 0
            bill["destination_state"] = st.selectbox("Destination of Supply", STATES, index=dest_idx)

        st.subheader(f"Item Details ({selected_client} Ledgers)")

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
                "hsn_code": "HSN/SAC",
                "qty": st.column_config.NumberColumn("Qty", min_value=0, format="%.2f"),
                "rate": st.column_config.NumberColumn("Unit Rate", format="₹%.2f"),
                "amount": st.column_config.NumberColumn("Amount", format="₹%.2f"),
                "ledger": st.column_config.SelectboxColumn(
                    f"{selected_client} Ledger",
                    help="Assign a client-specific debit ledger (Approve to memorize)",
                    width="medium",
                    options=active_ledgers,
                    required=True,
                )
            },
            num_rows="dynamic",
            use_container_width=True
        )
        bill["items"] = edited_df.to_dict(orient="records")

        st.subheader("Taxes & Totals")
        t_c1, t_c2, t_c3 = st.columns(3)
        with t_c1:
            bill["cgst"] = st.number_input("CGST (₹)", value=float(bill["cgst"]), step=1.0)
        with t_c2:
            bill["sgst"] = st.number_input("SGST (₹)", value=float(bill["sgst"]), step=1.0)
        with t_c3:
            bill["igst"] = st.number_input("IGST (₹)", value=float(bill["igst"]), step=1.0)

        bill["narration"] = st.text_area(
            "Narration",
            value=bill.get("narration", f"Purchase from {bill['vendor_name']} via Inv #{bill['invoice_number']}")
        )

        subtotal = sum([float(row.get("amount", 0.0)) for row in bill["items"]])
        grand_total = subtotal + bill["cgst"] + bill["sgst"] + bill["igst"]
        bill["subtotal"] = subtotal
        bill["grand_total"] = grand_total

        pending_bills_list[idx] = bill
        save_pending_bills(pending_bills_list)

        st.markdown(f"""
        <div style="background-color: #f0f2f6; padding: 15px; border-radius: 8px; margin-top: 10px;">
            <h4>Subtotal: ₹{subtotal:,.2f} | Total Tax: ₹{(bill['cgst']+bill['sgst']+bill['igst']):,.2f}</h4>
            <h2>Grand Total: ₹{grand_total:,.2f}</h2>
        </div>
        """, unsafe_allow_html=True)

# --- MAIN DASHBOARD TABS ---
else:
    if st.session_state["active_review_index"] is not None:
        st.session_state["active_review_index"] = None

    st.markdown('<h1 style="color: #1a2a4b; margin-bottom: 0;">Compliance4 Business</h1><p style="color: #4a5568; font-size: 1.1rem; margin-top: -5px;">Automated Purchases & Bank Integration Portal</p>', unsafe_allow_html=True)

    tab_uploads, tab_review, tab_all, tab_bank, tab_settings = st.tabs([
        "📤 Bill Uploads",
        f"📝 Needs Review ({len(pending_bills_list)})",
        f"✅ All Bills ({len(approved_bills_list)})",
        "🏦 Bank Statement Coding",
        "⚙️ Client Master Settings"
    ])

    # TAB 1: UPLOADS
    with tab_uploads:
        st.subheader(f"Upload Purchase Invoices for: {selected_client}")
        uploaded_files = st.file_uploader(
            "Upload Bills (PDF, JPG, PNG)",
            type=["pdf", "jpg", "jpeg", "png"],
            accept_multiple_files=True,
            key="bill_uploader_field"
        )

        if not api_key:
            st.warning("⚠️ Please provide a Gemini API Key in Streamlit Secrets or sidebar.")

        if uploaded_files and api_key:
            if st.button("🚀 Process Invoices for " + selected_client, type="primary"):
                client = genai.Client(api_key=api_key)
                progress_bar = st.progress(0)
                status_placeholder = st.empty()
                status_placeholder.text("Extracting invoice data & applying learned rules...")

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
                    status_placeholder.success(f"✅ Added {len(newly_extracted)} invoice(s) to 'Needs Review'!")
                    time.sleep(1)
                    st.rerun()

    # TAB 2: NEEDS REVIEW
    with tab_review:
        st.subheader("Invoices Pending Review & Ledger Verification")
        if not pending_bills_list:
            st.info("No bills pending review. Invoices uploaded at the office will appear here automatically.")
        else:
            for idx, item in enumerate(pending_bills_list):
                c1, c2, c3, c4 = st.columns([4, 2, 2, 2])
                with c1:
                    st.write(f"**{item['vendor_name']}**")
                    st.caption(f"Client: {item.get('client_name', 'General')} | {item['file_name']} | Inv #{item['invoice_number']}")
                with c2:
                    st.write(f"Date: **{item['invoice_date']}**")
                    st.caption(f"GSTIN: {item.get('vendor_gstin', '')}")
                with c3:
                    st.write(f"Subtotal: ₹{item['subtotal']:,.2f}")
                    st.caption(f"Total: ₹{item['grand_total']:,.2f}")
                with c4:
                    if st.button("🔍 Review & Edit", key=f"rev_{idx}"):
                        st.session_state["active_review_index"] = idx
                        st.rerun()
                st.divider()

    # TAB 3: ALL BILLS (APPROVED)
    with tab_all:
        st.subheader("Approved Invoices (Ready for Tally / Excel Export)")
        if not approved_bills_list:
            st.info("No approved bills yet. Approved bills will sync here in real time.")
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

            st.dataframe(df_summary, use_container_width=True)

            excel_buf = io.BytesIO()
            with pd.ExcelWriter(excel_buf, engine='openpyxl') as writer:
                df_summary.to_excel(writer, sheet_name="Invoice Summary", index=False)
                df_items_approved.to_excel(writer, sheet_name="Item-Wise Ledgers", index=False)

            exp_c1, exp_c2, exp_c3 = st.columns(3)
            with exp_c1:
                st.download_button(
                    label="📥 Download Approved Excel Register",
                    data=excel_buf.getvalue(),
                    file_name="Approved_Purchase_Register.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
            with exp_c2:
                xml_data = generate_tally_xml(approved_bills_list)
                st.download_button(
                    label="📥 Download Multi-Ledger Tally XML",
                    data=xml_data,
                    file_name="Approved_Tally_Import.xml",
                    mime="application/xml"
                )
            with exp_c3:
                if st.button("🧹 Clear Exported Bills"):
                    approved_bills_list = []
                    save_approved_bills(approved_bills_list)
                    st.success("Approved register cleared for next batch!")
                    st.rerun()

    # TAB 4: BANK STATEMENT CODING MODULE
    with tab_bank:
        st.subheader(f"🏦 Smart Bank Statement Coding: {selected_client}")
        
        bank_col1, bank_col2 = st.columns([2, 1])
        with bank_col1:
            uploaded_bank = st.file_uploader(
                "Upload Bank Statement (Excel or CSV format)",
                type=["xlsx", "xls", "csv"],
                key="bank_file_uploader"
            )
        with bank_col2:
            tally_bank_name = st.text_input("Tally Bank Ledger Name", value="HDFC Bank Current A/c")

        if uploaded_bank is not None:
            if st.session_state["bank_df_working"] is None:
                try:
                    if uploaded_bank.name.endswith(".csv"):
                        df_raw = pd.read_csv(uploaded_bank)
                    else:
                        df_raw = pd.read_excel(uploaded_bank)

                    # Normalize column headers
                    clean_cols = {c: str(c).strip().lower() for c in df_raw.columns}
                    date_col = next((c for c, n in clean_cols.items() if "date" in n or "txn date" in n), None)
                    narration_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["narration", "description", "particulars", "remarks"])), None)
                    debit_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["debit", "withdrawal", "dr"])), None)
                    credit_col = next((c for c, n in clean_cols.items() if any(k in n for k in ["credit", "deposit", "cr"])), None)

                    if not (date_col and narration_col):
                        st.error("Could not automatically locate 'Date' and 'Narration' columns. Please check your Excel format.")
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

                            # Auto-match from bank memory
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
                    st.error(f"Error reading bank file: {e}")

        if st.session_state["bank_df_working"] is not None:
            st.markdown(f"#### Review & Select Ledgers ({len(st.session_state['bank_df_working'])} Transactions)")
            st.caption("Change any ledger in the dropdown below. Once saved, the engine memorizes the counterparty automatically.")

            edited_bank_df = st.data_editor(
                st.session_state["bank_df_working"],
                column_config={
                    "Date": st.column_config.TextColumn("Date", width="small"),
                    "Narration": st.column_config.TextColumn("Bank Narration", width="large"),
                    "Debit / Withdrawal": st.column_config.NumberColumn("Debit (₹)", format="₹%.2f"),
                    "Credit / Deposit": st.column_config.NumberColumn("Credit (₹)", format="₹%.2f"),
                    "Assigned Ledger": st.column_config.SelectboxColumn(
                        f"{selected_client} Ledger",
                        help="Select Tally expense, party, or revenue ledger",
                        width="medium",
                        options=active_ledgers,
                        required=True,
                    )
                },
                num_rows="dynamic",
                use_container_width=True
            )

            btn_col1, btn_col2, btn_col3 = st.columns([2, 2, 2])
            with btn_col1:
                if st.button("🧠 Save Mappings to Memory"):
                    rules = load_bank_rules()
                    if selected_client not in rules:
                        rules[selected_client] = {}
                    for _, row in edited_bank_df.iterrows():
                        cleaned_narr = clean_text(row["Narration"])
                        if cleaned_narr:
                            rules[selected_client][cleaned_narr] = row["Assigned Ledger"]
                    save_bank_rules(rules)
                    st.session_state["bank_df_working"] = edited_bank_df
                    st.success("Bank rules memorized successfully!")
                    st.rerun()

            with btn_col2:
                bank_xml = generate_bank_tally_xml(edited_bank_df, tally_bank_name)
                st.download_button(
                    label="📥 Download Bank Tally XML",
                    data=bank_xml,
                    file_name=f"{selected_client}_Bank_Vouchers.xml",
                    mime="application/xml"
                )

            with btn_col3:
                if st.button("🗑️ Reset Bank Statement"):
                    st.session_state["bank_df_working"] = None
                    st.rerun()

    # TAB 5: CLIENT MASTER SETTINGS & MEMORY
    with tab_settings:
        st.subheader("⚙️ Manage Clients & Chart of Accounts")
        
        cfg_col1, cfg_col2 = st.columns([1, 1])

        with cfg_col1:
            st.markdown("#### Add New Client")
            new_client_name = st.text_input("New Client / Company Name")
            new_client_ledgers_raw = st.text_area(
                "Expense / Purchase Ledgers (One ledger per line)",
                value="Purchase Account\nPackaging Supplies\nFreight Charges\nOffice Stationery\nBank Charges"
            )
            if st.button("➕ Add / Update Client"):
                if new_client_name.strip():
                    ledgers_list = [l.strip() for l in new_client_ledgers_raw.split("\n") if l.strip()]
                    client_masters[new_client_name.strip()] = ledgers_list
                    save_client_masters(client_masters)
                    st.success(f"Saved master ledgers for '{new_client_name}'!")
                    st.rerun()

        with cfg_col2:
            st.markdown(f"#### Existing Ledgers for: **{selected_client}**")
            current_ledgers_text = "\n".join(client_masters.get(selected_client, []))
            updated_text = st.text_area("Edit Current Client Ledgers", value=current_ledgers_text, height=180)
            
            b_c1, b_c2 = st.columns(2)
            with b_c1:
                if st.button("💾 Save Changes"):
                    new_list = [l.strip() for l in updated_text.split("\n") if l.strip()]
                    client_masters[selected_client] = new_list
                    save_client_masters(client_masters)
                    st.success("Ledgers updated successfully!")
                    st.rerun()
            with b_c2:
                if st.button("🗑️ Delete Selected Company", type="secondary"):
                    if selected_client in client_masters:
                        del client_masters[selected_client]
                        save_client_masters(client_masters)
                        st.warning(f"Deleted '{selected_client}'.")
                        st.rerun()

        st.divider()
        m_c1, m_c2 = st.columns(2)
        with m_c1:
            st.markdown(f"#### 🧠 Item Memory: **{selected_client}**")
            client_rules_view = item_rules.get(selected_client, {})
            if not client_rules_view:
                st.info("No invoice items memorized yet.")
            else:
                rules_display = [{"Item": k, "Ledger": v} for k, v in client_rules_view.items()]
                st.dataframe(pd.DataFrame(rules_display), height=200, use_container_width=True)
                if st.button("🧹 Reset Invoice Memory"):
                    item_rules[selected_client] = {}
                    save_item_rules(item_rules)
                    st.rerun()

        with m_c2:
            st.markdown(f"#### 🏦 Bank Memory: **{selected_client}**")
            bank_rules_view = bank_rules.get(selected_client, {})
            if not bank_rules_view:
                st.info("No bank narrations memorized yet.")
            else:
                bank_display = [{"Counterparty / Narration": k, "Ledger": v} for k, v in bank_rules_view.items()]
                st.dataframe(pd.DataFrame(bank_display), height=200, use_container_width=True)
                if st.button("🧹 Reset Bank Memory"):
                    bank_rules[selected_client] = {}
                    save_bank_rules(bank_rules)
                    st.rerun()
