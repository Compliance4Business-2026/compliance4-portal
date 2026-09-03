import streamlit as st
import pandas as pd
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional
import io
import json
import os
from PIL import Image

# 1. Page Config & Custom Styling
st.set_page_config(
    page_title="Compliance4 Business - Smart Purchase Portal",
    page_icon="💼",
    layout="wide"
)

# Simple Team Password Gate
def check_password():
    def password_entered():
        correct_password = str(st.secrets.get("APP_PASSWORD", "Compliance4@2026")).strip()
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

# Master File for Clients & Ledgers
CLIENTS_FILE = "client_ledgers.json"

DEFAULT_CLIENTS = {
    "The Marx Ventures": [
        "Purchase: Beverages",
        "Purchase: Raw Materials",
        "Purchase: Food & Groceries",
        "Packaging Supplies",
        "Kitchen Consumables",
        "Freight & Delivery Inward"
    ],
    "Indbuy Global Pvt Ltd": [
        "Trading Goods Purchase",
        "Freight & Forwarding Charges",
        "Warehouse Storage Expense",
        "Office Supplies Expense",
        "Printing & Stationery"
    ],
    "Default Client": [
        "Purchase Account",
        "Office Supplies Expense",
        "Repairs & Maintenance",
        "Miscellaneous Expenses"
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

# Load Client Masters
client_masters = load_client_masters()

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

# 3. State Initialization
if "needs_review" not in st.session_state:
    st.session_state["needs_review"] = []
if "all_bills" not in st.session_state:
    st.session_state["all_bills"] = []
if "active_review_index" not in st.session_state:
    st.session_state["active_review_index"] = None

# 4. Multi-Ledger Tally XML Generator
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

            <!-- Vendor Total Credit -->
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
            xml += f"""            <!-- Debit Entry for {led_name} -->
            <ALLLEDGERENTRIES.LIST>
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

# 5. Sidebar Branding & Client Selection
if os.path.exists(LOGO_PATH):
    st.sidebar.image(LOGO_PATH, use_container_width=True)
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

# --- DETAIL REVIEW SCREEN ---
if st.session_state["active_review_index"] is not None:
    idx = st.session_state["active_review_index"]
    bill = st.session_state["needs_review"][idx]

    top_c1, top_c2 = st.columns([8, 2])
    with top_c1:
        if st.button("← Back to List"):
            st.session_state["active_review_index"] = None
            st.rerun()
    with top_c2:
        col_del, col_app = st.columns(2)
        with col_del:
            if st.button("🗑️ Delete Bill", type="secondary"):
                st.session_state["needs_review"].pop(idx)
                st.session_state["active_review_index"] = None
                st.rerun()
        with col_app:
            if st.button("✅ Approve", type="primary"):
                approved_entry = st.session_state["needs_review"].pop(idx)
                st.session_state["all_bills"].append(approved_entry)
                st.session_state["active_review_index"] = None
                st.success("Invoice Approved!")
                st.rerun()

    st.divider()

    col_left, col_right = st.columns([1, 1])

    with col_left:
        st.subheader(f"📄 {bill['file_name']}")
        if bill["mime_type"].startswith("image"):
            st.image(bill["file_bytes"], use_container_width=True)
        else:
            st.info("PDF document preview active")

    with col_right:
        st.subheader("Invoice Header & Tax Details")
        bill["vendor_name"] = st.text_input("Vendor Name", value=bill["vendor_name"])
        bill["billing_address"] = st.text_input("Billing Address", value=bill.get("billing_address", ""))
        
        r1_c1, r1_c2 = st.columns(2)
        with r1_c1:
            bill["gst_treatment"] = st.selectbox("GST Treatment", GST_TREATMENTS, index=0)
        with r1_c2:
            bill["vendor_gstin"] = st.text_input("GSTIN", value=bill["vendor_gstin"])

        r2_c1, r2_c2 = st.columns(2)
        with r2_c1:
            src_idx = STATES.index(bill["source_state"]) if bill["source_state"] in STATES else 0
            bill["source_state"] = st.selectbox("Source of Supply", STATES, index=src_idx)
        with r2_c2:
            dest_idx = STATES.index(bill["destination_state"]) if bill["destination_state"] in STATES else 0
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
                    help="Assign a client-specific debit ledger",
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

        bill["narration"] = st.text_area("Narration", value=f"Purchase from {bill['vendor_name']} via Inv #{bill['invoice_number']}")

        subtotal = sum([float(row.get("amount", 0.0)) for row in bill["items"]])
        grand_total = subtotal + bill["cgst"] + bill["sgst"] + bill["igst"]
        bill["subtotal"] = subtotal
        bill["grand_total"] = grand_total

        st.markdown(f"""
        <div style="background-color: #f0f2f6; padding: 15px; border-radius: 8px; margin-top: 10px;">
            <h4>Subtotal: ₹{subtotal:,.2f} | Total Tax: ₹{(bill['cgst']+bill['sgst']+bill['igst']):,.2f}</h4>
            <h2>Grand Total: ₹{grand_total:,.2f}</h2>
        </div>
        """, unsafe_allow_html=True)

# --- MAIN DASHBOARD TABS ---
else:
    st.markdown('<h1 style="color: #1a2a4b; margin-bottom: 0;">Compliance4 Business</h1><p style="color: #4a5568; font-size: 1.1rem; margin-top: -5px;">Automated Purchases & Tally Integration Portal</p>', unsafe_allow_html=True)

    tab_uploads, tab_review, tab_all, tab_settings = st.tabs([
        "📤 Bill Uploads",
        f"📝 Needs Review ({len(st.session_state['needs_review'])})",
        f"✅ All Bills ({len(st.session_state['all_bills'])})",
        "⚙️ Client Master Settings"
    ])

    # TAB 1: UPLOADS
    with tab_uploads:
        st.subheader(f"Upload Purchase Invoices for: {selected_client}")
        uploaded_files = st.file_uploader(
            "Upload Bills (PDF, JPG, PNG)",
            type=["pdf", "jpg", "jpeg", "png"],
            accept_multiple_files=True,
            key="bill_uploader"
        )

        # TAB 1: UPLOADS
    with tab_uploads:
        st.subheader(f"Upload Purchase Invoices for: {selected_client}")
        uploaded_files = st.file_uploader(
            "Upload Bills (PDF, JPG, PNG)",
            type=["pdf", "jpg", "jpeg", "png"],
            accept_multiple_files=True,
            key="bill_uploader"
        )

        if not api_key:
            st.warning("⚠️ Please provide a Gemini API Key in Streamlit Secrets or via the sidebar.")

        if uploaded_files and api_key:
            if st.button("🚀 Process Invoices for " + selected_client, type="primary"):
                client = genai.Client(api_key=api_key)
                progress = st.progress(0)
                status = st.empty()
                success_count = 0

                for idx, file in enumerate(uploaded_files):
                    status.text(f"Extracting ({idx + 1}/{len(uploaded_files)}): {file.name}...")
                    mime = "application/pdf" if file.name.lower().endswith(".pdf") else "image/jpeg"
                    file.seek(0)
                    file_bytes = file.read()

                    prompt = f"""
                    Extract invoice details accurately into structured format.
                    For each line item, assign the best matching accounting ledger strictly from this list of ledgers available for this client:
                    {', '.join(active_ledgers)}
                    """

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
                            bill_entry["file_name"] = file.name
                            bill_entry["file_bytes"] = file_bytes
                            bill_entry["mime_type"] = mime
                            bill_entry["gst_treatment"] = "Regular"
                            bill_entry["client_name"] = selected_client

                            st.session_state["needs_review"].append(bill_entry)
                            success_count += 1
                        else:
                            st.error(f"⚠️ Model returned an empty response for {file.name}")
                    except Exception as e:
                        st.error(f"❌ Failed to extract {file.name}: {e}")

                    progress.progress((idx + 1) / len(uploaded_files))

                if success_count > 0:
                    status.success(f"✅ Extracted {success_count} invoice(s)! Switch to the 'Needs Review' tab.")
                    st.rerun()
                else:
                    status.error("Extraction failed. Review the error details above.")
    # TAB 2: NEEDS REVIEW
    with tab_review:
        st.subheader("Invoices Pending Review & Ledger Verification")
        if not st.session_state["needs_review"]:
            st.info("No bills pending review. Upload invoices in the 'Bill Uploads' tab.")
        else:
            for idx, item in enumerate(st.session_state["needs_review"]):
                c1, c2, c3, c4 = st.columns([4, 2, 2, 2])
                with c1:
                    st.write(f"**{item['vendor_name']}**")
                    st.caption(f"Client: {item.get('client_name', 'General')} | {item['file_name']} | Inv #{item['invoice_number']}")
                with c2:
                    st.write(f"Date: **{item['invoice_date']}**")
                    st.caption(f"GSTIN: {item['vendor_gstin']}")
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
        if not st.session_state["all_bills"]:
            st.info("No approved bills yet. Approve bills from the 'Needs Review' tab.")
        else:
            summary_rows = []
            itemized_rows = []

            for b in st.session_state["all_bills"]:
                summary_rows.append({
                    "Client": b.get("client_name", ""),
                    "Vendor Name": b["vendor_name"],
                    "GSTIN": b["vendor_gstin"],
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

            exp_c1, exp_c2 = st.columns(2)
            with exp_c1:
                st.download_button(
                    label="📥 Download Approved Excel Register",
                    data=excel_buf.getvalue(),
                    file_name="Approved_Purchase_Register.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
            with exp_c2:
                xml_data = generate_tally_xml(st.session_state["all_bills"])
                st.download_button(
                    label="📥 Download Multi-Ledger Tally XML",
                    data=xml_data,
                    file_name="Approved_Tally_Import.xml",
                    mime="application/xml"
                )

    # TAB 4: CLIENT MASTER SETTINGS
    with tab_settings:
        st.subheader("⚙️ Manage Clients & Chart of Accounts")
        
        cfg_col1, cfg_col2 = st.columns([1, 1])

        with cfg_col1:
            st.markdown("#### Add New Client")
            new_client_name = st.text_input("New Client / Company Name")
            new_client_ledgers_raw = st.text_area(
                "Expense / Purchase Ledgers (One ledger per line)",
                value="Purchase Account\nPackaging Supplies\nFreight Charges\nOffice Stationery"
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
