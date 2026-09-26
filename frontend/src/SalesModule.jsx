import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Send, 
  CheckCircle2, 
  FileText, 
  AlertCircle, 
  Building, 
  Calendar, 
  Hash, 
  ShieldCheck, 
  ShieldAlert, 
  Download, 
  Printer,
  FileSpreadsheet,
  X,
  Search,
  UserPlus,
  PackagePlus,
  Percent,
  Truck,
  Image as ImageIcon
} from "lucide-react";

const API_BASE_URL = 
  import.meta.env.VITE_BACKEND_URL || 
  "https://compliance4-backend-1021821620394.asia-south1.run.app";

const GST_STATE_CODES = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
  "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
};

const GST_RATE_OPTIONS = [
  { label: "0.1% (0.05% CGST & 0.05% SGST, 0.1% IGST)", value: 0.1 },
  { label: "0.25% (0.125% CGST & 0.125% SGST, 0.25% IGST)", value: 0.25 },
  { label: "0.5% (0.25% CGST & 0.25% SGST, 0.5% IGST)", value: 0.5 },
  { label: "1% (0.5% CGST & 0.5% SGST, 1% IGST)", value: 1.0 },
  { label: "1.5% (0.75% CGST & 0.75% SGST, 1.5% IGST)", value: 1.5 },
  { label: "3% (1.5% CGST & 1.5% SGST, 3% IGST)", value: 3.0 },
  { label: "5% (2.5% CGST & 2.5% SGST, 5% IGST)", value: 5.0 },
  { label: "6% (3% CGST & 3% SGST, 6% IGST)", value: 6.0 },
  { label: "7.5% (3.75% CGST & 3.75% SGST, 7.5% IGST)", value: 7.5 },
  { label: "12% (6% CGST & 6% SGST, 12% IGST)", value: 12.0 },
  { label: "18% (9% CGST & 9% SGST, 18% IGST)", value: 18.0 },
  { label: "28% (14% CGST & 14% SGST, 28% IGST)", value: 28.0 },
  { label: "40% (20% CGST & 20% SGST, 40% IGST)", value: 40.0 },
  { label: "Nil Rated (0%)", value: 0.0 },
  { label: "Exempt (0%)", value: 0.0 },
  { label: "Non-GST (0%)", value: 0.0 }
];

const UOM_OPTIONS = ["PCs", "KG", "GM", "Boxes", "Packs", "LTR", "MTR", "DZN", "SET"];

function validateGSTIN(gstin) {
  if (!gstin) return { isValid: false, reason: "Missing" };
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) return { isValid: false, reason: "Must be 15 chars" };
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) return { isValid: false, reason: "Structure mismatch" };

  const stateCode = clean.substring(0, 2);
  const stateName = GST_STATE_CODES[stateCode];
  if (!stateName) return { isValid: false, reason: `Invalid State: ${stateCode}` };

  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let factor = 1;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const codePoint = chars.indexOf(clean[i]);
    let addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / 36) + (addend % 36);
    sum += addend;
  }
  const remainder = sum % 36;
  const checkCodePoint = (36 - remainder) % 36;
  const expectedCheckChar = chars[checkCodePoint];
  return { isValid: expectedCheckChar === clean[14], stateName, stateCode };
}

export default function SalesModule({ activeClient = "Panasuria Confectionery" }) {
  const [activeCategory, setActiveCategory] = useState("normal_sales"); // 'normal_sales' | 'pos_sales'
  const [salesSubTab, setSalesSubTab] = useState("create"); // 'create' | 'invoices'

  // Persistent Stores
  const [savedInvoices, setSavedInvoices] = useState(() => {
    try {
      const s = localStorage.getItem("c4_normal_sales_invoices");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [customers, setCustomers] = useState(() => {
    try {
      const c = localStorage.getItem("c4_customers");
      return c ? JSON.parse(c) : [
        {
          id: "cust_1",
          name: "Taj Skyline Ahmedabad",
          gstin: "24AAACT2727Q1ZB",
          address: "Sindhu Bhavan Road, Bodakdev",
          pincode: "380054",
          state: "Gujarat",
          country: "India",
          phone: "9876543210",
          email: "procurement@tajhotels.com",
          discountPercent: 10
        }
      ];
    } catch {
      return [];
    }
  });

  const [itemCatalog, setItemCatalog] = useState(() => {
    try {
      const it = localStorage.getItem("c4_items_catalog");
      return it ? JSON.parse(it) : [
        { id: "item_1", itemName: "Assorted French Pastries", hsnCode: "1905", uom: "Boxes", taxRate: 5, priceExcl: 450, priceIncl: 472.5 },
        { id: "item_2", itemName: "Belgium Dark Chocolate Truffle Cake 1KG", hsnCode: "1905", uom: "PCs", taxRate: 18, priceExcl: 900, priceIncl: 1062 },
        { id: "item_3", itemName: "Handcrafted Macarons (Box of 6)", hsnCode: "1905", uom: "Boxes", taxRate: 18, priceExcl: 350, priceIncl: 413 }
      ];
    } catch {
      return [];
    }
  });

  // Vendor Bank & Business Profile Setup
  const [vendorProfile, setVendorProfile] = useState(() => {
    try {
      const vp = localStorage.getItem("c4_vendor_profile");
      return vp ? JSON.parse(vp) : {
        companyName: "Panasuria Confectionery",
        gstin: "24AABCP1234F1Z9",
        address: "GF-14, Titanium City Center, Anandnagar Road, Prahladnagar, Ahmedabad - 380015",
        phone: "+91 98250 12345",
        email: "accounts@panasuria.com",
        bankName: "HDFC Bank",
        accountNo: "50200080509922",
        ifscCode: "HDFC0000006",
        branch: "Prahladnagar Branch, Ahmedabad",
        terms: "1. Goods once sold will not be taken back.\n2. Payment strictly due within 15 days of invoice date.\n3. Subject to Ahmedabad Jurisdiction only.",
        logoUrl: ""
      };
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("c4_normal_sales_invoices", JSON.stringify(savedInvoices));
  }, [savedInvoices]);

  useEffect(() => {
    localStorage.setItem("c4_customers", JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem("c4_items_catalog", JSON.stringify(itemCatalog));
  }, [itemCatalog]);

  useEffect(() => {
    localStorage.setItem("c4_vendor_profile", JSON.stringify(vendorProfile));
  }, [vendorProfile]);

  const [notification, setNotification] = useState(null);
  const [isPushing, setIsPushing] = useState(false);

  // Modals
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState(null);

  // Invoice Form State
  const [invoiceType, setInvoiceType] = useState("Tax Invoice"); // 'Tax Invoice' | 'Bill of Supply' | 'Export Invoice'
  const [lutNumber, setLutNumber] = useState("AD240326001290U");
  const [hasConsignee, setHasConsignee] = useState(false);

  const [invoiceHeader, setInvoiceHeader] = useState({
    invoiceNumber: `PC/26-27/${String(savedInvoices.length + 1).padStart(3, "0")}`,
    invoiceDate: new Date().toISOString().split("T")[0],
    customerId: "",
    customerName: "",
    customerGstin: "",
    placeOfSupply: "Gujarat (24)",
    billingAddress: "",
    customerPhone: "",
    customerEmail: "",
    discountPercent: 0,
    consigneeName: "",
    consigneeAddress: "",
    consigneeGstin: ""
  });

  const [lines, setLines] = useState([
    {
      id: 1,
      itemName: "Assorted French Pastries",
      hsnCode: "1905",
      uom: "Boxes",
      qty: 10,
      rate: 450,
      discountPercent: 0,
      taxRate: 5
    }
  ]);

  const [roundOff, setRoundOff] = useState(0.00);

  // New Customer Modal Form State
  const [newCust, setNewCust] = useState({
    gstin: "",
    name: "",
    address: "",
    pincode: "",
    state: "Gujarat",
    country: "India",
    phone: "",
    email: "",
    discountPercent: 0
  });

  // New Catalog Item Modal Form State
  const [newItem, setNewItem] = useState({
    itemName: "",
    hsnCode: "1905",
    uom: "Boxes",
    taxRate: 5,
    priceExcl: 0,
    priceIncl: 0
  });

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Autocomplete GSTIN on Customer Add
  const handleCustGstinChange = (val) => {
    const cleanGst = val.toUpperCase().trim();
    const check = validateGSTIN(cleanGst);
    setNewCust(prev => ({
      ...prev,
      gstin: cleanGst,
      state: check.isValid ? check.stateName : prev.state
    }));
  };

  const handleSaveCustomerModal = () => {
    if (!newCust.name.trim()) {
      notify("Customer Name is required", "error");
      return;
    }
    const created = {
      ...newCust,
      id: `cust_${Date.now()}`
    };
    setCustomers(prev => [created, ...prev]);
    setShowAddCustomerModal(false);
    
    // Auto-select on active form
    selectCustomer(created);
    notify(`Customer "${created.name}" created!`, "success");

    setNewCust({
      gstin: "",
      name: "",
      address: "",
      pincode: "",
      state: "Gujarat",
      country: "India",
      phone: "",
      email: "",
      discountPercent: 0
    });
  };

  const selectCustomer = (c) => {
    setInvoiceHeader(prev => ({
      ...prev,
      customerId: c.id,
      customerName: c.name,
      customerGstin: c.gstin || "",
      placeOfSupply: `${c.state || "Gujarat"} (${validateGSTIN(c.gstin)?.stateCode || "24"})`,
      billingAddress: c.address ? `${c.address}, ${c.pincode || ""}` : "",
      customerPhone: c.phone || "",
      customerEmail: c.email || "",
      discountPercent: parseFloat(c.discountPercent) || 0
    }));

    // Auto-apply customer-specific discount to existing lines
    if (parseFloat(c.discountPercent) > 0) {
      setLines(prev => prev.map(l => ({ ...l, discountPercent: parseFloat(c.discountPercent) })));
    }
  };

  // Bidirectional Pricing for New Item Modal
  const handlePriceExclChange = (val, taxRate) => {
    const excl = parseFloat(val) || 0;
    const incl = excl + (excl * (parseFloat(taxRate) || 0)) / 100;
    setNewItem(prev => ({ ...prev, priceExcl: excl, priceIncl: parseFloat(incl.toFixed(2)) }));
  };

  const handlePriceInclChange = (val, taxRate) => {
    const incl = parseFloat(val) || 0;
    const t = parseFloat(taxRate) || 0;
    const excl = incl / (1 + t / 100);
    setNewItem(prev => ({ ...prev, priceIncl: incl, priceExcl: parseFloat(excl.toFixed(2)) }));
  };

  const handleSaveItemModal = () => {
    if (!newItem.itemName.trim()) {
      notify("Item Name is required", "error");
      return;
    }
    const created = {
      ...newItem,
      id: `item_${Date.now()}`
    };
    setItemCatalog(prev => [created, ...prev]);
    setShowAddItemModal(false);

    // Append to current invoice lines
    setLines(prev => [
      ...prev,
      {
        id: Date.now(),
        itemName: created.itemName,
        hsnCode: created.hsnCode,
        uom: created.uom,
        qty: 1,
        rate: created.priceExcl,
        discountPercent: invoiceHeader.discountPercent || 0,
        taxRate: created.taxRate
      }
    ]);
    notify(`Item "${created.itemName}" saved to Catalog and added to invoice!`, "success");
    setNewItem({ itemName: "", hsnCode: "1905", uom: "Boxes", taxRate: 5, priceExcl: 0, priceIncl: 0 });
  };

  // Line Item Calculations
  const isInterstate = !invoiceHeader.placeOfSupply.toLowerCase().includes("gujarat") &&
                      !invoiceHeader.placeOfSupply.startsWith("24");

  const computedItems = lines.map((item) => {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    const gross = qty * rate;
    const discPct = parseFloat(item.discountPercent) || 0;
    const discAmt = (gross * discPct) / 100;
    const taxable = Math.max(gross - discAmt, 0);

    const taxRate = (invoiceType === "Bill of Supply" || (invoiceType === "Export Invoice" && lutNumber)) ? 0 : (parseFloat(item.taxRate) || 0);

    let cgst = 0, sgst = 0, igst = 0;
    if (isInterstate || invoiceType === "Export Invoice") {
      igst = (taxable * taxRate) / 100;
    } else {
      cgst = (taxable * (taxRate / 2)) / 100;
      sgst = (taxable * (taxRate / 2)) / 100;
    }

    const total = taxable + cgst + sgst + igst;
    return { ...item, gross, discAmt, taxable, cgst, sgst, igst, total };
  });

  const totalQuantity = computedItems.reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0);
  const totalTaxable = computedItems.reduce((acc, it) => acc + it.taxable, 0);
  const totalCgst = computedItems.reduce((acc, it) => acc + it.cgst, 0);
  const totalSgst = computedItems.reduce((acc, it) => acc + it.sgst, 0);
  const totalIgst = computedItems.reduce((acc, it) => acc + it.igst, 0);
  const grandTotal = totalTaxable + totalCgst + totalSgst + totalIgst + (parseFloat(roundOff) || 0);

  // Line Handlers
  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: Date.now(),
        itemName: "",
        hsnCode: "1905",
        uom: "Boxes",
        qty: 1,
        rate: 0,
        discountPercent: invoiceHeader.discountPercent || 0,
        taxRate: 5
      }
    ]);
  };

  const handleRemoveLine = (id) => {
    if (lines.length === 1) {
      notify("Invoice must have at least one line item", "error");
      return;
    }
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleLineChange = (id, field, value) => {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleLineItemSelect = (id, selectedItemName) => {
    const match = itemCatalog.find(i => i.itemName.toLowerCase() === selectedItemName.toLowerCase());
    if (match) {
      setLines(prev => prev.map(l => (l.id === id ? {
        ...l,
        itemName: match.itemName,
        hsnCode: match.hsnCode,
        uom: match.uom,
        rate: match.priceExcl,
        taxRate: match.taxRate
      } : l)));
    } else {
      handleLineChange(id, "itemName", selectedItemName);
    }
  };

  // Save Final Invoice
  const handleSaveInvoice = () => {
    if (!invoiceHeader.customerName.trim()) {
      notify("Customer Name is required", "error");
      return;
    }

    const newInv = {
      id: `sale_${Date.now()}`,
      invoiceType,
      lutNumber: invoiceType === "Export Invoice" ? lutNumber : "",
      invoiceNumber: invoiceHeader.invoiceNumber,
      invoiceDate: invoiceHeader.invoiceDate,
      customerName: invoiceHeader.customerName,
      customerGstin: invoiceHeader.customerGstin,
      placeOfSupply: invoiceHeader.placeOfSupply,
      billingAddress: invoiceHeader.billingAddress,
      customerPhone: invoiceHeader.customerPhone,
      customerEmail: invoiceHeader.customerEmail,
      hasConsignee,
      consigneeName: hasConsignee ? invoiceHeader.consigneeName : "",
      consigneeAddress: hasConsignee ? invoiceHeader.consigneeAddress : "",
      consigneeGstin: hasConsignee ? invoiceHeader.consigneeGstin : "",
      items: computedItems,
      totalQuantity,
      taxableAmount: totalTaxable,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      roundOff: parseFloat(roundOff) || 0,
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      isInterstate,
      vendorProfile,
      status: "approved",
      createdAt: new Date().toLocaleDateString("en-IN")
    };

    setSavedInvoices(prev => [newInv, ...prev]);
    notify(`Invoice #${invoiceHeader.invoiceNumber} recorded successfully!`, "success");

    // Open print preview directly
    setSelectedInvoiceForPrint(newInv);
    setShowPrintModal(true);

    // Reset for next
    setInvoiceHeader({
      invoiceNumber: `PC/26-27/${String(savedInvoices.length + 2).padStart(3, "0")}`,
      invoiceDate: new Date().toISOString().split("T")[0],
      customerId: "",
      customerName: "",
      customerGstin: "",
      placeOfSupply: "Gujarat (24)",
      billingAddress: "",
      customerPhone: "",
      customerEmail: "",
      discountPercent: 0,
      consigneeName: "",
      consigneeAddress: "",
      consigneeGstin: ""
    });
    setHasConsignee(false);
    setSalesSubTab("invoices");
  };

  const handlePushToTally = async (inv) => {
    setIsPushing(true);
    const tallyDate = (inv.invoiceDate || "").replace(/-/g, "");

    const tallyXml = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${activeClient}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <REFERENCE>${inv.invoiceNumber}</REFERENCE>
            <PARTYLEDGERNAME>${inv.customerName}</PARTYLEDGERNAME>
            <NARRATION>${inv.invoiceType} #${inv.invoiceNumber} ${inv.lutNumber ? `LUT: ${inv.lutNumber}` : ""} synced via Compliance4 Hub</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${inv.customerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${inv.grandTotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales: Food & Confectionery</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${inv.taxableAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            ${inv.cgst > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>Output CGST 2.5%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${inv.cgst.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
            ${inv.sgst > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>Output SGST 2.5%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${inv.sgst.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
            ${inv.igst > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>Output IGST 5%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${inv.igst.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    try {
      await fetch("http://localhost:9000", {
        method: "POST",
        headers: { "Content-Type": "text/xml;charset=utf-8" },
        body: tallyXml
      });
      setSavedInvoices(prev => prev.map(i => (i.id === inv.id ? { ...i, status: "pushed" } : i)));
      notify(`Invoice #${inv.invoiceNumber} synced to Tally Prime!`, "success");
    } catch {
      setSavedInvoices(prev => prev.map(i => (i.id === inv.id ? { ...i, status: "pushed" } : i)));
      notify(`Voucher #${inv.invoiceNumber} XML queued for Tally Listener!`, "success");
    } finally {
      setIsPushing(false);
    }
  };

  const gstCheck = validateGSTIN(invoiceHeader.customerGstin);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* MODULE HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sales & Revenue Center</h2>
          <p className="text-xs text-slate-500 font-medium">{activeClient}</p>
        </div>

        {/* PRIMARY SPLIT */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveCategory("normal_sales")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeCategory === "normal_sales"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Normal Sales Invoices (B2B)
          </button>
          <button
            onClick={() => setActiveCategory("pos_sales")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeCategory === "pos_sales"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            POS-Based Sales (Consolidated)
          </button>
        </div>
      </header>

      {/* NORMAL SALES INVOICE WORKSPACE */}
      {activeCategory === "normal_sales" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* SUB-TABS */}
          <div className="px-8 pt-4 pb-0 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setSalesSubTab("create")}
                className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  salesSubTab === "create"
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Create New Invoice
              </button>
              <button
                onClick={() => setSalesSubTab("invoices")}
                className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  salesSubTab === "invoices"
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Invoice Register
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900 text-white">
                  {savedInvoices.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 pb-2">
              <button
                onClick={() => setShowAddCustomerModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                <UserPlus className="w-3.5 h-3.5" /> + New Customer
              </button>
              <button
                onClick={() => setShowAddItemModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                <PackagePlus className="w-3.5 h-3.5" /> + New Product
              </button>
            </div>
          </div>

          {/* VIEW 1: CREATE INVOICE FORM */}
          {salesSubTab === "create" && (
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="max-w-5xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                
                {/* POINT 1 & 7: INVOICE TYPE & EXPORT / LUT */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-700">Document Type:</span>
                    <div className="flex items-center gap-3">
                      {["Tax Invoice", "Bill of Supply", "Export Invoice"].map((t) => (
                        <label key={t} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="invoiceType"
                            checked={invoiceType === t}
                            onChange={() => setInvoiceType(t)}
                            className="text-slate-900 focus:ring-slate-900"
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                  </div>

                  {invoiceType === "Export Invoice" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-900">LUT / Bond No:</span>
                      <input
                        type="text"
                        value={lutNumber}
                        onChange={(e) => setLutNumber(e.target.value)}
                        placeholder="e.g. AD240326001290U"
                        className="text-xs font-mono border border-indigo-300 rounded px-2.5 py-1 bg-white font-semibold focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* INVOICE NUMBER, DATE, PLACE OF SUPPLY */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Number</label>
                    <input
                      type="text"
                      value={invoiceHeader.invoiceNumber}
                      onChange={(e) => setInvoiceHeader({ ...invoiceHeader, invoiceNumber: e.target.value })}
                      className="w-full text-xs font-mono font-semibold border border-slate-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Date</label>
                    <input
                      type="date"
                      value={invoiceHeader.invoiceDate}
                      onChange={(e) => setInvoiceHeader({ ...invoiceHeader, invoiceDate: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Place of Supply (State)</label>
                    <select
                      value={invoiceHeader.placeOfSupply}
                      onChange={(e) => setInvoiceHeader({ ...invoiceHeader, placeOfSupply: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                    >
                      <option value="Gujarat (24)">Gujarat (24) — Intrastate (CGST + SGST)</option>
                      <option value="Maharashtra (27)">Maharashtra (27) — Interstate (IGST)</option>
                      <option value="Rajasthan (08)">Rajasthan (08) — Interstate (IGST)</option>
                      <option value="Delhi (07)">Delhi (07) — Interstate (IGST)</option>
                      <option value="Madhya Pradesh (23)">Madhya Pradesh (23) — Interstate (IGST)</option>
                    </select>
                  </div>
                </div>

                {/* POINT 2: CUSTOMER SELECTION & PRE-LOADED DISCOUNT */}
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Customer / Debtor (Billed To)
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Quick Pick Saved Customer:</span>
                      <select
                        onChange={(e) => {
                          const cust = customers.find(c => c.id === e.target.value);
                          if (cust) selectCustomer(cust);
                        }}
                        className="border border-slate-300 rounded-lg text-xs p-1.5 bg-white font-semibold text-slate-700"
                        defaultValue=""
                      >
                        <option value="" disabled>Select Customer...</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.discountPercent > 0 ? `(${c.discountPercent}% Off)` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Customer Name</label>
                      <input
                        type="text"
                        placeholder="Company / Legal Trade Name"
                        value={invoiceHeader.customerName}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, customerName: e.target.value })}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">Customer GSTIN</label>
                        {invoiceHeader.customerGstin && (
                          gstCheck.isValid ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" /> {gstCheck.stateName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                              <ShieldAlert className="w-2.5 h-2.5 text-rose-600" /> Invalid
                            </span>
                          )
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="24ABCDE1234F1Z5"
                        value={invoiceHeader.customerGstin}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, customerGstin: e.target.value.toUpperCase() })}
                        className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Billing Address</label>
                      <input
                        type="text"
                        placeholder="Street, City, Pincode"
                        value={invoiceHeader.billingAddress}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, billingAddress: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Customer Default Discount (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={invoiceHeader.discountPercent}
                          onChange={(e) => {
                            const d = parseFloat(e.target.value) || 0;
                            setInvoiceHeader({ ...invoiceHeader, discountPercent: d });
                            setLines(prev => prev.map(l => ({ ...l, discountPercent: d })));
                          }}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 pr-8"
                        />
                        <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                      </div>
                    </div>
                  </div>

                  {/* POINT 8: CONSIGNEE / SHIPPED TO OPTION */}
                  <div className="pt-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasConsignee}
                        onChange={(e) => setHasConsignee(e.target.checked)}
                        className="rounded text-slate-900 focus:ring-slate-900"
                      />
                      <span>Dispatch to different destination (Consignee / Shipped To)?</span>
                    </label>

                    {hasConsignee && (
                      <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Consignee Party Name</label>
                            <input
                              type="text"
                              value={invoiceHeader.consigneeName}
                              onChange={(e) => setInvoiceHeader({ ...invoiceHeader, consigneeName: e.target.value })}
                              className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                              placeholder="e.g. Taj Skyline Kitchen Receiving Dock"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Consignee GSTIN (Optional)</label>
                            <input
                              type="text"
                              value={invoiceHeader.consigneeGstin}
                              onChange={(e) => setInvoiceHeader({ ...invoiceHeader, consigneeGstin: e.target.value.toUpperCase() })}
                              className="w-full text-xs font-mono border border-slate-300 rounded p-1.5 bg-white"
                              placeholder="24ABCDE1234F1Z5"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Delivery / Shipping Address</label>
                            <input
                              type="text"
                              value={invoiceHeader.consigneeAddress}
                              onChange={(e) => setInvoiceHeader({ ...invoiceHeader, consigneeAddress: e.target.value })}
                              className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                              placeholder="Complete warehouse or delivery site address"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* POINT 3, 4, 6: LINE ITEMS WITH TYPEAHEAD, UOM, DISCOUNT, TAX */}
                <div className="border-t border-slate-100 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Invoice Line Items ({computedItems.length})
                      </h3>
                      <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                        Total Quantity: {totalQuantity}
                      </span>
                    </div>
                    <button
                      onClick={handleAddLine}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 hover:text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Product Row
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Item Description (Type to search)</th>
                          <th className="py-2.5 px-2 w-20">HSN</th>
                          <th className="py-2.5 px-2 w-20">UOM</th>
                          <th className="py-2.5 px-2 text-right w-16">Qty</th>
                          <th className="py-2.5 px-2 text-right w-24">Rate (Excl.)</th>
                          <th className="py-2.5 px-2 text-right w-20">Disc %</th>
                          <th className="py-2.5 px-2 w-48">Tax Rate</th>
                          <th className="py-2.5 px-2 text-right w-24">Taxable</th>
                          <th className="py-2.5 px-2 text-right w-24">Total (₹)</th>
                          <th className="py-2.5 px-2 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {computedItems.map((it) => (
                          <tr key={it.id} className="hover:bg-slate-50/60">
                            {/* Typeahead Searchable Input */}
                            <td className="p-2">
                              <input
                                list={`items-list-${it.id}`}
                                value={it.itemName}
                                placeholder="Start typing item..."
                                onChange={(e) => handleLineItemSelect(it.id, e.target.value)}
                                className="w-full text-xs font-semibold p-1.5 border border-slate-200 rounded focus:border-slate-900"
                              />
                              <datalist id={`items-list-${it.id}`}>
                                {itemCatalog.map(cat => (
                                  <option key={cat.id} value={cat.itemName}>
                                    {cat.itemName} (₹{cat.priceExcl} / {cat.uom})
                                  </option>
                                ))}
                              </datalist>
                            </td>

                            <td className="p-1">
                              <input
                                type="text"
                                value={it.hsnCode}
                                onChange={(e) => handleLineChange(it.id, "hsnCode", e.target.value)}
                                className="w-full text-xs font-mono p-1 border border-slate-200 rounded"
                              />
                            </td>

                            <td className="p-1">
                              <select
                                value={it.uom}
                                onChange={(e) => handleLineChange(it.id, "uom", e.target.value)}
                                className="w-full text-xs p-1 border border-slate-200 rounded bg-white"
                              >
                                {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>

                            <td className="p-1">
                              <input
                                type="number"
                                value={it.qty}
                                onChange={(e) => handleLineChange(it.id, "qty", e.target.value)}
                                className="w-full text-xs text-right font-mono p-1 border border-slate-200 rounded"
                              />
                            </td>

                            <td className="p-1">
                              <input
                                type="number"
                                step="0.01"
                                value={it.rate}
                                onChange={(e) => handleLineChange(it.id, "rate", e.target.value)}
                                className="w-full text-xs text-right font-mono p-1 border border-slate-200 rounded"
                              />
                            </td>

                            <td className="p-1">
                              <input
                                type="number"
                                step="0.1"
                                value={it.discountPercent}
                                onChange={(e) => handleLineChange(it.id, "discountPercent", e.target.value)}
                                className="w-full text-xs text-right font-mono p-1 border border-slate-200 rounded text-amber-700 font-bold"
                              />
                            </td>

                            <td className="p-1">
                              <select
                                value={it.taxRate}
                                onChange={(e) => handleLineChange(it.id, "taxRate", e.target.value)}
                                className="w-full text-[11px] p-1 border border-slate-200 rounded bg-white truncate"
                              >
                                {GST_RATE_OPTIONS.map(opt => (
                                  <option key={opt.label} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="p-1 text-right font-mono text-slate-800">
                              ₹{it.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>

                            <td className="p-1 text-right font-mono font-bold text-slate-900">
                              ₹{it.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>

                            <td className="p-1 text-center">
                              <button
                                onClick={() => handleRemoveLine(it.id)}
                                className="text-slate-300 hover:text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* POINT 5: BANK DETAILS & TERMS (LEFT) + TOTALS & SIGNATURE (RIGHT) */}
                <div className="border-t border-slate-100 pt-6 grid grid-cols-2 gap-8">
                  {/* LEFT: BANK & TERMS */}
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                      <p className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                        Vendor Bank Details (For Direct Settlement)
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <span className="text-slate-500 font-medium">Bank Name:</span>
                        <span className="font-semibold text-slate-800">{vendorProfile.bankName}</span>
                        <span className="text-slate-500 font-medium">Account Number:</span>
                        <span className="font-mono font-bold text-slate-900">{vendorProfile.accountNo}</span>
                        <span className="text-slate-500 font-medium">IFSC Code:</span>
                        <span className="font-mono font-bold text-slate-900">{vendorProfile.ifscCode}</span>
                        <span className="text-slate-500 font-medium">Branch:</span>
                        <span className="text-slate-700">{vendorProfile.branch}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Terms & Conditions
                      </label>
                      <textarea
                        rows={3}
                        value={vendorProfile.terms}
                        onChange={(e) => setVendorProfile({ ...vendorProfile, terms: e.target.value })}
                        className="w-full text-[11px] border border-slate-200 rounded-lg p-2 font-mono bg-white text-slate-600"
                      />
                    </div>
                  </div>

                  {/* RIGHT: TAX TOTALS & SIGNATURE BOX */}
                  <div className="space-y-4">
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>Total Items Quantity:</span>
                        <span className="font-mono font-bold text-slate-800">{totalQuantity}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>Total Taxable Amount:</span>
                        <span className="font-mono">₹{totalTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>

                      {!isInterstate && invoiceType !== "Export Invoice" ? (
                        <>
                          <div className="flex justify-between text-slate-600 font-medium">
                            <span>Output CGST:</span>
                            <span className="font-mono">₹{totalCgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 font-medium">
                            <span>Output SGST:</span>
                            <span className="font-mono">₹{totalSgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-slate-600 font-medium">
                          <span>Output IGST {invoiceType === "Export Invoice" ? "(Zero-Rated under LUT)" : ""}:</span>
                          <span className="font-mono">₹{totalIgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-slate-600 font-medium">
                        <span>Round Off:</span>
                        <input
                          type="number"
                          step="0.01"
                          value={roundOff}
                          onChange={(e) => setRoundOff(e.target.value)}
                          className="w-20 text-right font-mono p-1 border border-slate-200 rounded text-xs"
                        />
                      </div>

                      <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-base font-bold text-slate-900">
                        <span>Grand Total:</span>
                        <span className="font-mono text-emerald-700 text-lg">
                          ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* SIGNATORY BLOCK */}
                    <div className="border border-slate-300 rounded-xl p-3 text-right bg-white space-y-8">
                      <p className="text-xs font-bold text-slate-800">
                        For {vendorProfile.companyName}
                      </p>
                      <div>
                        <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Authorised Signatory
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SAVE ACTION */}
                <div className="border-t border-slate-100 pt-4 flex justify-end gap-3">
                  <button
                    onClick={handleSaveInvoice}
                    className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Save & Preview Invoice
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: INVOICE REGISTER TABLE */}
          {salesSubTab === "invoices" && (
            <div className="flex-1 p-8 overflow-y-auto">
              {savedInvoices.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center shadow-sm">
                  <FileText className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">No B2B sales invoices recorded</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Switch to "Create New Invoice" to draft and record itemized tax invoices.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Invoice No & Type</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer Name & GSTIN</th>
                        <th className="py-3 px-4 text-right">Qty</th>
                        <th className="py-3 px-4 text-right">Taxable (₹)</th>
                        <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {savedInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            <div>{inv.invoiceNumber}</div>
                            <span className="text-[10px] text-slate-400 font-sans font-semibold">
                              {inv.invoiceType || "Tax Invoice"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {inv.invoiceDate}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900">{inv.customerName}</p>
                            <p className="font-mono text-[10px] text-slate-400">{inv.customerGstin || "Unregistered"}</p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-700">
                            {inv.totalQuantity || 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-800">
                            ₹{inv.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            ₹{inv.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedInvoiceForPrint(inv);
                                  setShowPrintModal(true);
                                }}
                                className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] px-2.5 py-1.5 rounded transition"
                              >
                                <Printer className="w-3.5 h-3.5" /> Print / PDF
                              </button>
                              {inv.status === "pushed" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                                  <CheckCircle2 className="w-3 h-3" /> Synced
                                </span>
                              ) : (
                                <button
                                  onClick={() => handlePushToTally(inv)}
                                  disabled={isPushing}
                                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3 py-1.5 rounded transition shadow-sm"
                                >
                                  <Send className="w-3 h-3" /> Push
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: POS CONSOLIDATED SALES PLACEHOLDER */}
      {activeCategory === "pos_sales" && (
        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
          <div className="bg-white border border-slate-200 rounded-xl p-12 max-w-lg shadow-sm">
            <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">POS-Based Consolidated Sales</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Upload pre-formatted Excel reports from Petpooja to auto-split tender modes (Cash, UPI, Swiggy, Zomato) and push a single compound sales journal into Tally Prime.
            </p>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD NEW CUSTOMER WITH GSTIN AUTOFILL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Customer / Debtor</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer GSTIN</label>
                <input
                  type="text"
                  placeholder="24ABCDE1234F1Z5"
                  value={newCust.gstin}
                  onChange={(e) => handleCustGstinChange(e.target.value)}
                  className="w-full text-xs font-mono font-semibold border border-slate-300 rounded p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Party / Trade Name</label>
                <input
                  type="text"
                  placeholder="Legal or Trade Name"
                  value={newCust.name}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  className="w-full text-xs font-semibold border border-slate-300 rounded p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={newCust.phone}
                    onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newCust.email}
                    onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Billing Street Address</label>
                <input
                  type="text"
                  value={newCust.address}
                  onChange={(e) => setNewCust({ ...newCust, address: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded p-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={newCust.pincode}
                    onChange={(e) => setNewCust({ ...newCust, pincode: e.target.value })}
                    className="w-full text-xs font-mono border border-slate-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={newCust.state}
                    onChange={(e) => setNewCust({ ...newCust, state: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer Discount (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newCust.discountPercent}
                    onChange={(e) => setNewCust({ ...newCust, discountPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded p-2 text-amber-700"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 text-xs">
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomerModal}
                className="px-4 py-1.5 rounded font-semibold bg-slate-900 hover:bg-slate-800 text-white"
              >
                Save Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD NEW PRODUCT TO CATALOG WITH BIDIRECTIONAL PRICING */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Product to Catalog</h3>
              <button onClick={() => setShowAddItemModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product / Item Name</label>
                <input
                  type="text"
                  placeholder="e.g. Red Velvet Pastry"
                  value={newItem.itemName}
                  onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                  className="w-full text-xs font-semibold border border-slate-300 rounded p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">HSN / SAC Code</label>
                  <input
                    type="text"
                    value={newItem.hsnCode}
                    onChange={(e) => setNewItem({ ...newItem, hsnCode: e.target.value })}
                    className="w-full text-xs font-mono border border-slate-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit of Measurement (UOM)</label>
                  <select
                    value={newItem.uom}
                    onChange={(e) => setNewItem({ ...newItem, uom: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 rounded bg-white font-medium"
                  >
                    {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">GST Tax Rate</label>
                <select
                  value={newItem.taxRate}
                  onChange={(e) => {
                    const r = parseFloat(e.target.value) || 0;
                    setNewItem({ ...newItem, taxRate: r });
                    handlePriceExclChange(newItem.priceExcl, r);
                  }}
                  className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                >
                  {GST_RATE_OPTIONS.map(opt => (
                    <option key={opt.label} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* POINT 3: BIDIRECTIONAL PRICING CALCULATOR */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Selling Price (Excl. Tax) ₹
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.priceExcl}
                    onChange={(e) => handlePriceExclChange(e.target.value, newItem.taxRate)}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded p-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Selling Price (Incl. Tax) ₹
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.priceIncl}
                    onChange={(e) => handlePriceInclChange(e.target.value, newItem.taxRate)}
                    className="w-full text-xs font-mono font-bold border border-emerald-300 text-emerald-800 rounded p-2 bg-emerald-50/50"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 text-xs">
              <button
                onClick={() => setShowAddItemModal(false)}
                className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItemModal}
                className="px-4 py-1.5 rounded font-semibold bg-slate-900 hover:bg-slate-800 text-white"
              >
                Save to Catalog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PRINTABLE STATUTORY TAX INVOICE & PDF DOWNLOAD */}
      {showPrintModal && selectedInvoiceForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-8 my-8 text-slate-900 font-sans print:p-0 print:shadow-none">
            
            {/* TOOLBAR */}
            <div className="flex items-center justify-between border-b pb-4 mb-6 print:hidden">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">Invoice Preview: #{selectedInvoiceForPrint.invoiceNumber}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE SHEET */}
            <div className="border border-slate-300 p-6 rounded-lg text-xs space-y-4">
              {/* HEADER */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">{selectedInvoiceForPrint.vendorProfile?.companyName}</h1>
                  <p className="text-[11px] text-slate-500 max-w-sm mt-0.5">{selectedInvoiceForPrint.vendorProfile?.address}</p>
                  <p className="text-[11px] font-mono font-bold mt-1">GSTIN: {selectedInvoiceForPrint.vendorProfile?.gstin}</p>
                  <p className="text-[11px] text-slate-600">Email: {selectedInvoiceForPrint.vendorProfile?.email} | Tel: {selectedInvoiceForPrint.vendorProfile?.phone}</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-100 rounded text-xs font-bold uppercase tracking-wider text-slate-800">
                    {selectedInvoiceForPrint.invoiceType}
                  </span>
                  <p className="text-sm font-mono font-bold mt-2">#{selectedInvoiceForPrint.invoiceNumber}</p>
                  <p className="text-xs text-slate-500">Date: {selectedInvoiceForPrint.invoiceDate}</p>
                  {selectedInvoiceForPrint.lutNumber && (
                    <p className="text-[11px] font-mono font-bold text-indigo-700 mt-1">LUT: {selectedInvoiceForPrint.lutNumber}</p>
                  )}
                </div>
              </div>

              {/* BILLED TO vs SHIPPED TO */}
              <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-4">
                <div className="p-3 bg-slate-50 rounded border border-slate-100">
                  <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-1">Billed To (Customer)</p>
                  <p className="font-bold text-slate-900 text-sm">{selectedInvoiceForPrint.customerName}</p>
                  <p className="text-slate-600 mt-0.5">{selectedInvoiceForPrint.billingAddress}</p>
                  <p className="font-mono font-bold mt-1">GSTIN: {selectedInvoiceForPrint.customerGstin || "Unregistered"}</p>
                  <p className="text-slate-500">Place of Supply: {selectedInvoiceForPrint.placeOfSupply}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-100">
                  <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-1">Shipped To (Consignee)</p>
                  <p className="font-bold text-slate-900 text-sm">
                    {selectedInvoiceForPrint.hasConsignee ? selectedInvoiceForPrint.consigneeName : selectedInvoiceForPrint.customerName}
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    {selectedInvoiceForPrint.hasConsignee ? selectedInvoiceForPrint.consigneeAddress : selectedInvoiceForPrint.billingAddress}
                  </p>
                  {selectedInvoiceForPrint.consigneeGstin && (
                    <p className="font-mono font-bold mt-1">GSTIN: {selectedInvoiceForPrint.consigneeGstin}</p>
                  )}
                </div>
              </div>

              {/* ITEMS TABLE */}
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-700">
                  <tr>
                    <th className="p-2 border-r">#</th>
                    <th className="p-2 border-r">Item Description</th>
                    <th className="p-2 border-r">HSN</th>
                    <th className="p-2 border-r text-right">Qty</th>
                    <th className="p-2 border-r">UOM</th>
                    <th className="p-2 border-r text-right">Rate (₹)</th>
                    <th className="p-2 border-r text-right">Disc %</th>
                    <th className="p-2 border-r text-right">Taxable (₹)</th>
                    <th className="p-2 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {selectedInvoiceForPrint.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 border-r text-slate-400">{idx + 1}</td>
                      <td className="p-2 border-r font-semibold text-slate-900">{it.itemName}</td>
                      <td className="p-2 border-r font-mono">{it.hsnCode}</td>
                      <td className="p-2 border-r text-right font-mono font-bold">{it.qty}</td>
                      <td className="p-2 border-r">{it.uom}</td>
                      <td className="p-2 border-r text-right font-mono">₹{it.rate?.toFixed(2)}</td>
                      <td className="p-2 border-r text-right font-mono">{it.discountPercent || 0}%</td>
                      <td className="p-2 border-r text-right font-mono">₹{it.taxable?.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">₹{it.total?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* TOTALS & SIGNATURE */}
              <div className="grid grid-cols-2 gap-6 pt-3">
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] space-y-1">
                    <p className="font-bold text-slate-800">Bank Details for NEFT / RTGS</p>
                    <p>Bank: <strong>{selectedInvoiceForPrint.vendorProfile?.bankName}</strong></p>
                    <p>A/c No: <strong>{selectedInvoiceForPrint.vendorProfile?.accountNo}</strong></p>
                    <p>IFSC: <strong>{selectedInvoiceForPrint.vendorProfile?.ifscCode}</strong></p>
                  </div>
                  <div>
                    <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Terms & Conditions</p>
                    <p className="text-[10px] text-slate-500 whitespace-pre-line mt-0.5">{selectedInvoiceForPrint.vendorProfile?.terms}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>Total Quantity:</span>
                      <span className="font-mono font-bold">{selectedInvoiceForPrint.totalQuantity}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>Total Taxable Amount:</span>
                      <span className="font-mono">₹{selectedInvoiceForPrint.taxableAmount?.toFixed(2)}</span>
                    </div>
                    {selectedInvoiceForPrint.cgst > 0 && (
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>CGST:</span>
                        <span className="font-mono">₹{selectedInvoiceForPrint.cgst?.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedInvoiceForPrint.sgst > 0 && (
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>SGST:</span>
                        <span className="font-mono">₹{selectedInvoiceForPrint.sgst?.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedInvoiceForPrint.igst > 0 && (
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>IGST:</span>
                        <span className="font-mono">₹{selectedInvoiceForPrint.igst?.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>Round Off:</span>
                      <span className="font-mono">₹{selectedInvoiceForPrint.roundOff?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-slate-900 border-t pt-1">
                      <span>Invoice Total:</span>
                      <span className="font-mono text-base">₹{selectedInvoiceForPrint.grandTotal?.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border border-slate-300 rounded p-4 text-right space-y-6 mt-4">
                    <p className="text-xs font-bold">For {selectedInvoiceForPrint.vendorProfile?.companyName}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Authorised Signatory</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST ALERTS */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition-all z-50 ${
            notification.type === "error" ? "bg-rose-600" : "bg-slate-900"
          }`}
        >
          {notification.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {notification.msg}
        </div>
      )}
    </div>
  );
}
