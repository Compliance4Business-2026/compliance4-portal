"""
Compliance4 Business - Tally Prime Direct Bridge Client
Runs locally on the machine hosting Tally Prime (Default Port: 9000).
Receives JSON voucher payloads and executes direct XML injection.
"""

import sys
import json
import httpx
from datetime import datetime

TALLY_URL = "http://localhost:9000"

def generate_purchase_tally_xml(bill: dict, company_name: str) -> str:
    """Formats an approved purchase invoice into Tally Prime XML schema."""
    date_str = datetime.strptime(bill["invoice_date"], "%Y-%m-%d").strftime("%Y%m%d")
    
    lines_xml = ""
    # 1. Supplier / Sundry Creditor Credit Entry
    lines_xml += f"""
    <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>{bill["vendor_ledger"]}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>{bill["grand_total"]}</AMOUNT>
        <BILLALLOCATIONS.LIST>
            <NAME>{bill["invoice_number"]}</NAME>
            <BILLTYPE>New Ref</BILLTYPE>
            <AMOUNT>{bill["grand_total"]}</AMOUNT>
        </BILLALLOCATIONS.LIST>
    </ALLLEDGERENTRIES.LIST>
    """
    
    # 2. Line Item Debit Entries
    for itm in bill.get("items", []):
        lines_xml += f"""
        <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>{itm["ledger"]}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-{itm["amount"]}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        """

    # 3. Tax Ledgers (Debit)
    if bill.get("cgst", 0) > 0:
        lines_xml += f"""
        <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Input CGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-{bill["cgst"]}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Input SGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-{bill["sgst"]}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        """
    elif bill.get("igst", 0) > 0:
        lines_xml += f"""
        <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Input IGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-{bill["igst"]}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        """

    xml_envelope = f"""<ENVELOPE>
        <HEADER>
            <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
            <IMPORTDATA>
                <REQUESTDESC>
                    <REPORTNAME>Vouchers</REPORTNAME>
                    <STATICVARIABLES>
                        <SVCURRENTCOMPANY>{company_name}</SVCURRENTCOMPANY>
                    </STATICVARIABLES>
                </REQUESTDESC>
                <REQUESTDATA>
                    <TALLYMESSAGE xmlns:UDF="TallyUDF">
                        <VOUCHER VCHTYPE="Purchase" ACTION="Create">
                            <DATE>{date_str}</DATE>
                            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
                            <REFERENCE>{bill["invoice_number"]}</REFERENCE>
                            <PARTYLEDGERNAME>{bill["vendor_ledger"]}</PARTYLEDGERNAME>
                            <NARRATION>{bill.get("narration", "Imported via Compliance4 Portal")}</NARRATION>
                            {lines_xml}
                        </VOUCHER>
                    </TALLYMESSAGE>
                </REQUESTDATA>
            </IMPORTDATA>
        </BODY>
    </ENVELOPE>"""
    return xml_envelope

def generate_bank_tally_xml(txn: dict, bank_ledger_name: str, company_name: str) -> str:
    """Formats verified bank transaction into Payment/Receipt/Contra XML."""
    date_str = datetime.strptime(txn["date"], "%Y-%m-%d").strftime("%Y%m%d")
    vch_type = txn["type"] # Payment, Receipt, or Contra
    
    if vch_type == "Payment":
        amount = txn["debit"]
        party_positive = "Yes"
        party_amount = f"-{amount}"
        bank_positive = "No"
        bank_amount = f"{amount}"
    else: # Receipt
        amount = txn["credit"]
        party_positive = "No"
        party_amount = f"{amount}"
        bank_positive = "Yes"
        bank_amount = f"-{amount}"

    xml_envelope = f"""<ENVELOPE>
        <HEADER>
            <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
            <IMPORTDATA>
                <REQUESTDESC>
                    <REPORTNAME>Vouchers</REPORTNAME>
                    <STATICVARIABLES>
                        <SVCURRENTCOMPANY>{company_name}</SVCURRENTCOMPANY>
                    </STATICVARIABLES>
                </REQUESTDESC>
                <REQUESTDATA>
                    <TALLYMESSAGE xmlns:UDF="TallyUDF">
                        <VOUCHER VCHTYPE="{vch_type}" ACTION="Create">
                            <DATE>{date_str}</DATE>
                            <VOUCHERTYPENAME>{vch_type}</VOUCHERTYPENAME>
                            <NARRATION>{txn["narration"]}</NARRATION>
                            <ALLLEDGERENTRIES.LIST>
                                <LEDGERNAME>{txn["ledger"]}</LEDGERNAME>
                                <ISDEEMEDPOSITIVE>{party_positive}</ISDEEMEDPOSITIVE>
                                <AMOUNT>{party_amount}</AMOUNT>
                            </ALLLEDGERENTRIES.LIST>
                            <ALLLEDGERENTRIES.LIST>
                                <LEDGERNAME>{bank_ledger_name}</LEDGERNAME>
                                <ISDEEMEDPOSITIVE>{bank_positive}</ISDEEMEDPOSITIVE>
                                <AMOUNT>{bank_amount}</AMOUNT>
                            </ALLLEDGERENTRIES.LIST>
                        </VOUCHER>
                    </TALLYMESSAGE>
                </REQUESTDATA>
            </IMPORTDATA>
        </BODY>
    </ENVELOPE>"""
    return xml_envelope

def push_to_tally(xml_payload: str) -> bool:
    try:
        response = httpx.post(
            TALLY_URL, 
            content=xml_payload.encode("utf-8"), 
            headers={"Content-Type": "text/xml"},
            timeout=10.0
        )
        if "<CREATED>1</CREATED>" in response.text or "<ALTERED>1</ALTERED>" in response.text:
            print(">> Voucher Created in Tally successfully!")
            return True
        else:
            print(f">> Tally Rejected Payload:\n{response.text}")
            return False
    except httpx.ConnectError:
        print(">> Could not connect to Tally Prime. Check that Tally is running and port 9000 is open.")
        return False

if __name__ == "__main__":
    print("==================================================")
    print(" Compliance4 Business - Tally Prime Local Daemon ")
    print(" Listening on http://localhost:9000               ")
    print("==================================================")
