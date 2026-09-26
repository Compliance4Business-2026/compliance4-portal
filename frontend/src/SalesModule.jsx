import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  Send, 
  CheckCircle2, 
  FileText, 
  AlertCircle, 
  ShieldCheck, 
  ShieldAlert, 
  Printer, 
  FileSpreadsheet, 
  X, 
  UserPlus, 
  PackagePlus, 
  Percent,
  Globe
} from "lucide-react";

const COUNTRY_OPTIONS = [
  "India",
  "United States",
  "United Arab Emirates",
  "United Kingdom",
  "Canada",
  "Australia",
  "Singapore",
  "Germany",
  "France",
  "Russia",
  "Saudi Arabia",
  "Qatar",
  "Oman",
  "Kuwait",
  "Bahrain",
  "Other"
];

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

function numberToWords(num) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n) {
    if (n === 0) return "";
    if (n < 20) return a[n] + " ";
    if (n < 100) return b[Math.floor(n / 10)] + " " + a[n % 10] + " ";
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred " + inWords(n % 100);
    if (n < 100000) return inWords(Math.floor(n / 1000)) + "Thousand " + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + "Lakh " + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + "Crore " + inWords(n % 10000000);
  }

  const rounded = Math.round(num);
  if (rounded === 0) return "ZERO RUPEES ONLY";
  return (inWords(rounded).trim() + " Rupees Only").toUpperCase();
}

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
  const [activeCategory, setActiveCategory] = useState("normal_sales");
  const [salesSubTab, setSalesSubTab] = useState("create");

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
      return c ? JSON.parse(c) : [];
    } catch {
      return [];
    }
  });

  const [itemCatalog, setItemCatalog] = useState(() => {
    try {
      const it = localStorage.getItem("c4_items_catalog");
      return it ? JSON.parse(it) : [];
    } catch {
      return [];
    }
  });

  const getActiveVendorProfile = () => {
  try {
    const profiles = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
    return profiles[activeClient] || {
      companyName: activeClient,
      gstin: "24AABCP1234F1Z9",
      address: "",
      phone: "",
      email: "",
      bankName: "HDFC Bank",
      accountNo: "",
      ifscCode: ""
    };
  } catch {
    return { companyName: activeClient };
  }
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

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState(null);

  const [invoiceType, setInvoiceType] = useState("Tax Invoice");
  const [lutNumber, setLutNumber] = useState("");
  const [hasConsignee, setHasConsignee] = useState(false);

  const [invoiceHeader, setInvoiceHeader] = useState({
    invoiceNumber: `PC/26-27/${String(savedInvoices.length + 1).padStart(3, "0")}`,
    invoiceDate: new Date().toISOString().split("T")[0],
    poNumber: "",
    customerId: "",
    customerName: "",
    customerGstin: "",
    customerCountry: "India",
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
      itemName: "",
      hsnCode: "",
      uom: "Boxes",
      qty: "",
      rate: "",
      discountPercent: 0,
      taxRate: 5
    }
  ]);

  const [newCust, setNewCust] = useState({
    country: "India",
    gstin: "",
    name: "",
    address: "",
    pincode: "",
    state: "Gujarat",
    phone: "",
    email: "",
    discountPercent: 0
  });

  const [newItem, setNewItem] = useState({
    itemName: "", hsnCode: "", uom: "Boxes", taxRate: 5, priceExcl: "", priceIncl: ""
  });

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // COUNTRY CHANGE HANDLER FOR CUSTOMER CREATION
  const handleCustCountryChange = (selectedCountry) => {
    if (selectedCountry !== "India") {
      setNewCust(prev => ({
        ...prev,
        country: selectedCountry,
        gstin: "", // Blank out GSTIN
        state: ""  // Blank out State
      }));
    } else {
      setNewCust(prev => ({
        ...prev,
        country: "India",
        state: "Gujarat"
      }));
    }
  };

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
    const created = { ...newCust, id: `cust_${Date.now()}` };
    setCustomers(prev => [created, ...prev]);
    setShowAddCustomerModal(false);
    selectCustomer(created);
    notify(`Customer "${created.name}" created!`, "success");
    setNewCust({
      country: "India", gstin: "", name: "", address: "", pincode: "", state: "Gujarat", phone: "", email: "", discountPercent: 0
    });
  };

  const selectCustomer = (c) => {
    const isForeign = c.country && c.country !== "India";
    const pos = isForeign ? "Other Territory / Export (97)" : `${c.state || "Gujarat"} (${validateGSTIN(c.gstin)?.stateCode || "24"})`;

    setInvoiceHeader(prev => ({
      ...prev,
      customerId: c.id,
      customerName: c.name,
      customerGstin: isForeign ? "" : (c.gstin || ""),
      customerCountry: c.country || "India",
      placeOfSupply: pos,
      billingAddress: c.address ? `${c.address}, ${c.pincode || ""}` : "",
      customerPhone: c.phone || "",
      customerEmail: c.email || "",
      discountPercent: parseFloat(c.discountPercent) || 0
    }));

    if (isForeign) {
      setInvoiceType("Export Invoice");
    }

    if (parseFloat(c.discountPercent) > 0) {
      setLines(prev => prev.map(l => ({ ...l, discountPercent: parseFloat(c.discountPercent) })));
    }
  };

  const handlePriceExclChange = (val, taxRate) => {
    const excl = parseFloat(val) || 0;
    const incl = excl + (excl * (parseFloat(taxRate) || 0)) / 100;
    setNewItem(prev => ({ ...prev, priceExcl: val, priceIncl: excl > 0 ? parseFloat(incl.toFixed(2)) : "" }));
  };

  const handlePriceInclChange = (val, taxRate) => {
    const incl = parseFloat(val) || 0;
    const t = parseFloat(taxRate) || 0;
    const excl = incl / (1 + t / 100);
    setNewItem(prev => ({ ...prev, priceIncl: val, priceExcl: incl > 0 ? parseFloat(excl.toFixed(2)) : "" }));
  };

  const handleSaveItemModal = () => {
    if (!newItem.itemName.trim()) {
      notify("Item Name is required", "error");
      return;
    }
    const created = { ...newItem, id: `item_${Date.now()}` };
    setItemCatalog(prev => [created, ...prev]);
    setShowAddItemModal(false);
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
    notify(`Item "${created.itemName}" saved to Catalog!`, "success");
    setNewItem({ itemName: "", hsnCode: "", uom: "Boxes", taxRate: 5, priceExcl: "", priceIncl: "" });
  };

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

  const rawSubTotal = totalTaxable + totalCgst + totalSgst + totalIgst;
  const roundedGrandTotal = Math.round(rawSubTotal);
  const autoRoundOff = parseFloat((roundedGrandTotal - rawSubTotal).toFixed(2));

  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: Date.now(),
        itemName: "",
        hsnCode: "",
        uom: "Boxes",
        qty: "",
        rate: "",
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
      poNumber: invoiceHeader.poNumber || "",
      invoiceDate: invoiceHeader.invoiceDate,
      customerName: invoiceHeader.customerName,
      customerGstin: invoiceHeader.customerGstin,
      customerCountry: invoiceHeader.customerCountry,
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
      roundOff: autoRoundOff,
      grandTotal: roundedGrandTotal,
      isInterstate,
      vendorProfile,
      status: "approved",
      createdAt: new Date().toLocaleDateString("en-IN")
    };

    setSavedInvoices(prev => [newInv, ...prev]);
    notify(`Invoice #${invoiceHeader.invoiceNumber} recorded successfully!`, "success");

    setSelectedInvoiceForPrint(newInv);
    setShowPrintModal(true);

    setInvoiceHeader({
      invoiceNumber: `PC/26-27/${String(savedInvoices.length + 2).padStart(3, "0")}`,
      invoiceDate: new Date().toISOString().split("T")[0],
      poNumber: "",
      customerId: "",
      customerName: "",
      customerGstin: "",
      customerCountry: "India",
      placeOfSupply: "Gujarat (24)",
      billingAddress: "",
      customerPhone: "",
      customerEmail: "",
      discountPercent: 0,
      consigneeName: "",
      consigneeAddress: "",
      consigneeGstin: ""
    });
    setLines([
      { id: Date.now(), itemName: "", hsnCode: "", uom: "Boxes", qty: "", rate: "", discountPercent: 0, taxRate: 5 }
    ]);
    setHasConsignee(false);
    setSalesSubTab("invoices");
  };

  // TRUE FULL-PAGE A4 SIZING (EXACT TO REFERENCE)
  const triggerFullPagePrint = (invoice) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    const isExport = invoice.invoiceType === "Export Invoice";
    const headerTitle = isExport ? "EXPORT INVOICE" : invoice.invoiceType ? invoice.invoiceType.toUpperCase() : "TAX INVOICE";

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${headerTitle} - ${invoice.invoiceNumber}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          * {
            box-sizing: border-box;
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
            color: #000;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: #fff;
          }
          .a4-container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            border: 1.5px solid #2b6cb0;
          }
          .border-b { border-bottom: 1.5px solid #2b6cb0; }
          .border-r { border-right: 1.5px solid #2b6cb0; }
          .border-t { border-top: 1.5px solid #2b6cb0; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .font-black { font-weight: 900; }

          .two-col {
            display: flex;
            width: 100%;
          }
          .col-half {
            width: 50%;
          }
          .table-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          table.items-table {
            width: 100%;
            border-collapse: collapse;
            flex: 1;
          }
          table.items-table th {
            background-color: #f7fafc;
            border-bottom: 1.5px solid #2b6cb0;
            border-right: 1px solid #2b6cb0;
            padding: 5px 4px;
            font-size: 9.5px;
            font-weight: bold;
            color: #1a202c;
          }
          table.items-table td {
            border-right: 1px solid #2b6cb0;
            padding: 4px 6px;
            font-size: 10px;
            vertical-align: top;
          }
          table.items-table th:last-child, table.items-table td:last-child {
            border-right: none;
          }
          .fill-remaining-space {
            height: 100%;
          }
        </style>
      </head>
      <body>
        <div class="a4-container">
          
          <!-- TOP SELLER HEADER -->
          <div class="two-col border-b" style="padding: 10px 14px; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 44px; height: 44px; background: #2b6cb0; color: #fff; font-weight: 900; font-size: 20px; display: flex; align-items: center; justify-content: center; border-radius: 4px;">
                C4
              </div>
              <div>
                <div style="font-size: 16px; font-weight: 900; color: #1a202c; text-transform: uppercase;">${invoice.vendorProfile?.companyName || "Panasuria Confectionery"}</div>
                <div style="font-size: 9.5px; color: #4a5568; margin-top: 1px;">${invoice.vendorProfile?.address || ""}</div>
                <div style="font-size: 9.5px; margin-top: 2px;"><strong>GSTIN:</strong> ${invoice.vendorProfile?.gstin || ""}</div>
              </div>
            </div>
            <div style="text-align: right; font-size: 9.5px; line-height: 1.4;">
              <div><strong>Name :</strong> ${invoice.vendorProfile?.companyName || "Panasuria Confectionery"}</div>
              <div><strong>Phone :</strong> ${invoice.vendorProfile?.phone || ""}</div>
              <div><strong>Email :</strong> ${invoice.vendorProfile?.email || ""}</div>
              <div><strong>PAN :</strong> ${invoice.vendorProfile?.pan || "AABCP1234F"}</div>
            </div>
          </div>

          <!-- GSTIN / LUT / TITLE BANNER -->
          <div class="two-col border-b" style="background: #f7fafc; padding: 4px 10px; font-size: 9px; font-weight: bold; justify-content: space-between;">
            <div>GSTIN : ${invoice.vendorProfile?.gstin || ""} ${invoice.lutNumber ? `| LUT NO : ${invoice.lutNumber}` : ""}</div>
            <div style="color: #2b6cb0; font-weight: 900;">${headerTitle}</div>
            <div>ORIGINAL FOR RECIPIENT</div>
          </div>

          ${invoice.lutNumber ? `
            <div style="background: #ebf8ff; color: #2b6cb0; font-size: 8.5px; text-align: center; font-weight: bold; padding: 3px 0; border-bottom: 1.5px solid #2b6cb0;">
              Supply Meant For Export Under Bond or Letter of Undertaking without Payment of Integrated Tax (IGST)
            </div>
          ` : ""}

          <!-- 4-BOX BUYER & CONSIGNEE INFO -->
          <div class="two-col border-b">
            <!-- BUYER -->
            <div class="col-half border-r" style="padding: 6px 10px; font-size: 9.5px; line-height: 1.35;">
              <div style="font-weight: 900; font-size: 9px; text-transform: uppercase; color: #4a5568; margin-bottom: 3px;">Details of Buyer | Billed to :</div>
              <div style="display: flex;"><span style="width: 70px; font-weight: bold;">Name</span>: <span style="font-weight: 900; text-transform: uppercase;">${invoice.customerName}</span></div>
              <div style="display: flex;"><span style="width: 70px; font-weight: bold;">Address</span>: <span>${invoice.billingAddress || "-"}</span></div>
              <div style="display: flex;"><span style="width: 70px; font-weight: bold;">Country</span>: <span>${invoice.customerCountry || "India"}</span></div>
              <div style="display: flex;"><span style="width: 70px; font-weight: bold;">Phone</span>: <span>${invoice.customerPhone || "-"}</span></div>
              ${invoice.customerGstin ? `<div style="display: flex;"><span style="width: 70px; font-weight: bold;">GSTIN</span>: <span style="font-weight: bold;">${invoice.customerGstin}</span></div>` : ""}
              <div style="display: flex;"><span style="width: 70px; font-weight: bold;">Place of Supply</span>: <span>${invoice.placeOfSupply}</span></div>
            </div>

            <!-- CONSIGNEE & INVOICE META -->
            <div class="col-half" style="display: flex; flex-direction: column;">
              <div class="two-col border-b" style="background: #f7fafc; padding: 4px 8px; font-size: 9.5px;">
                <div style="width: 50%;"><strong>Invoice No.</strong> : <span style="font-weight: 900;">${invoice.invoiceNumber}</span></div>
                <div style="width: 50%;"><strong>Invoice Date</strong> : <span>${invoice.invoiceDate}</span></div>
              </div>
              ${invoice.poNumber ? `
                <div style="padding: 3px 8px; font-size: 9.5px; border-bottom: 1px solid #2b6cb0; background: #fff;">
                  <strong>Purchase Order (PO) No.</strong> : <span style="font-weight: bold;">${invoice.poNumber}</span>
                </div>
              ` : ""}
              <div style="padding: 6px 10px; font-size: 9.5px; line-height: 1.35; flex: 1;">
                <div style="font-weight: 900; font-size: 9px; text-transform: uppercase; color: #4a5568; margin-bottom: 3px;">Details of Consignee | Shipped to :</div>
                <div style="display: flex;"><span style="width: 65px; font-weight: bold;">Name</span>: <span>${invoice.hasConsignee ? invoice.consigneeName : invoice.customerName}</span></div>
                <div style="display: flex;"><span style="width: 65px; font-weight: bold;">Address</span>: <span>${invoice.hasConsignee ? invoice.consigneeAddress : invoice.billingAddress}</span></div>
                ${invoice.consigneeGstin ? `<div style="display: flex;"><span style="width: 65px; font-weight: bold;">GSTIN</span>: <span>${invoice.consigneeGstin}</span></div>` : ""}
              </div>
            </div>
          </div>

          <!-- FULL-HEIGHT EXPANDING ITEMS TABLE -->
          <div class="table-wrapper">
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 30px;">Sr.<br/>No.</th>
                  <th style="text-align: left;">Name of Product / Service</th>
                  <th style="width: 65px;">HSN / SAC</th>
                  <th style="width: 45px; text-align: right;">Qty</th>
                  <th style="width: 45px;">UOM</th>
                  <th style="width: 65px; text-align: right;">Rate (₹)</th>
                  <th style="width: 45px; text-align: right;">Disc %</th>
                  <th style="width: 75px; text-align: right;">Taxable (₹)</th>
                  <th style="width: 85px; text-align: right;">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.items?.map((it, idx) => `
                  <tr>
                    <td class="text-center" style="color: #666;">${idx + 1}</td>
                    <td class="font-bold">${it.itemName}</td>
                    <td class="text-center">${it.hsnCode || "-"}</td>
                    <td class="text-right font-bold">${it.qty || 0}</td>
                    <td class="text-center">${it.uom || "PCs"}</td>
                    <td class="text-right">${Number(it.rate || 0).toFixed(2)}</td>
                    <td class="text-right">${it.discountPercent || 0}%</td>
                    <td class="text-right">${Number(it.taxable || 0).toFixed(2)}</td>
                    <td class="text-right font-bold">${Number(it.total || 0).toFixed(2)}</td>
                  </tr>
                `).join("")}
                <tr class="fill-remaining-space">
                  <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t font-black" style="background: #f7fafc;">
                  <td colspan="3" class="text-right font-bold" style="padding: 4px 6px;">Total</td>
                  <td class="text-right font-black" style="padding: 4px 6px;">${invoice.totalQuantity || 0}</td>
                  <td></td>
                  <td colspan="3" class="text-right font-bold" style="padding: 4px 6px;">Taxable Total:</td>
                  <td class="text-right font-black" style="padding: 4px 6px;">₹${Number(invoice.taxableAmount || 0).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- WORDS & STATUTORY TOTALS -->
          <div class="two-col border-t border-b">
            <div class="col-half border-r" style="padding: 6px 10px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 8.5px; font-weight: 900; color: #4a5568; text-transform: uppercase;">Total in words :</div>
                <div style="font-size: 10px; font-weight: 900; margin-top: 3px; line-height: 1.35;">${numberToWords(invoice.grandTotal)}</div>
              </div>
              <div style="margin-top: 8px;">
                <div style="background: #ebf8ff; border: 1px solid #bee3f8; padding: 4px 8px; font-size: 8.5px; font-weight: 900; color: #2b6cb0; text-align: center; margin-bottom: 4px;">
                  Bank Details
                </div>
                <div style="font-size: 9.5px; line-height: 1.35;">
                  <div><strong>Name</strong> : ${invoice.vendorProfile?.bankName || "HDFC Bank"}</div>
                  <div><strong>Branch</strong> : ${invoice.vendorProfile?.branch || ""}</div>
                  <div><strong>Acc. Name</strong> : ${invoice.vendorProfile?.companyName || ""}</div>
                  <div><strong>Acc. Number</strong> : <strong style="font-size: 10.5px;">${invoice.vendorProfile?.accountNo || ""}</strong></div>
                  <div><strong>IFSC Code</strong> : <strong>${invoice.vendorProfile?.ifscCode || ""}</strong></div>
                </div>
              </div>
            </div>

            <div class="col-half" style="padding: 6px 10px;">
              <table style="width: 100%; font-size: 10px; border-collapse: collapse; line-height: 1.5;">
                <tr>
                  <td>Total Taxable Value :</td>
                  <td class="text-right font-bold">₹${Number(invoice.taxableAmount || 0).toFixed(2)}</td>
                </tr>
                ${invoice.cgst > 0 ? `
                  <tr>
                    <td>CGST :</td>
                    <td class="text-right font-bold">₹${Number(invoice.cgst).toFixed(2)}</td>
                  </tr>
                ` : ""}
                ${invoice.sgst > 0 ? `
                  <tr>
                    <td>SGST :</td>
                    <td class="text-right font-bold">₹${Number(invoice.sgst).toFixed(2)}</td>
                  </tr>
                ` : ""}
                ${invoice.igst > 0 ? `
                  <tr>
                    <td>IGST :</td>
                    <td class="text-right font-bold">₹${Number(invoice.igst).toFixed(2)}</td>
                  </tr>
                ` : ""}
                <tr>
                  <td>Round Off (+/-) :</td>
                  <td class="text-right font-bold">${Number(invoice.roundOff || 0) >= 0 ? "+" : ""}${Number(invoice.roundOff || 0).toFixed(2)}</td>
                </tr>
                <tr style="border-top: 1.5px solid #2b6cb0; background: #ebf8ff;">
                  <td style="font-size: 12px; font-weight: 900; padding: 4px 0;">Total Amount (₹) :</td>
                  <td class="text-right font-black" style="font-size: 13.5px; padding: 4px 0;">₹${Number(invoice.grandTotal || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td colspan="2" class="text-right" style="font-size: 8px; color: #718096;">(E & O.E.)</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- TERMS & SIGNATURE -->
          <div class="two-col" style="min-height: 85px;">
            <div class="col-half border-r" style="padding: 6px 10px; font-size: 8.5px; color: #4a5568;">
              <div style="font-weight: 900; text-transform: uppercase; color: #2d3748; margin-bottom: 3px;">Terms and Conditions :</div>
              <div style="white-space: pre-line; line-height: 1.35;">${invoice.vendorProfile?.terms || ""}</div>
            </div>
            <div class="col-half" style="padding: 6px 10px; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
              <div style="font-size: 8px; color: #718096;">Certified that the particulars given above are true and correct.</div>
              <div style="font-size: 10px; font-weight: bold; margin-top: 2px;">For ${invoice.vendorProfile?.companyName || "Panasuria Confectionery"}</div>
              <div style="margin-top: 35px; font-size: 9px; font-weight: 900; text-transform: uppercase; border-top: 1px solid #cbd5e0; padding-top: 2px;">
                Authorised Signatory
              </div>
            </div>
          </div>

        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 2500);
    }, 400);
  };

  const gstCheck = validateGSTIN(invoiceHeader.customerGstin);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sales & Revenue Center</h2>
          <p className="text-xs text-slate-500 font-medium">{activeClient}</p>
        </div>

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
                
                {/* DOCUMENT TYPE */}
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

                {/* NUMBER, DATE, PO NO, PLACE OF SUPPLY */}
                <div className="grid grid-cols-4 gap-4">
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Order (PO) No.</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-89210 (Optional)"
                      value={invoiceHeader.poNumber}
                      onChange={(e) => setInvoiceHeader({ ...invoiceHeader, poNumber: e.target.value })}
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2"
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
                      <option value="Uttar Pradesh (09)">Uttar Pradesh (09) — Interstate (IGST)</option>
                      <option value="Madhya Pradesh (23)">Madhya Pradesh (23) — Interstate (IGST)</option>
                      <option value="Other Territory / Export (97)">Other Territory / Export (97)</option>
                    </select>
                  </div>
                </div>

                {/* CUSTOMER SECTION */}
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
                            {c.name} ({c.country || "India"}) {c.discountPercent > 0 ? `(${c.discountPercent}% Off)` : ""}
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
                        {invoiceHeader.customerCountry !== "India" ? (
                          <span className="text-[10px] font-semibold text-slate-400">N/A (Export)</span>
                        ) : (
                          invoiceHeader.customerGstin && (
                            gstCheck.isValid ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" /> {gstCheck.stateName}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                                <ShieldAlert className="w-2.5 h-2.5 text-rose-600" /> Invalid
                              </span>
                            )
                          )
                        )}
                      </div>
                      <input
                        type="text"
                        disabled={invoiceHeader.customerCountry !== "India"}
                        placeholder={invoiceHeader.customerCountry !== "India" ? "Not Applicable" : "24ABCDE1234F1Z5"}
                        value={invoiceHeader.customerGstin}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, customerGstin: e.target.value.toUpperCase() })}
                        className={`w-full text-xs font-mono border rounded-lg p-2 ${
                          invoiceHeader.customerCountry !== "India" ? "bg-slate-100 text-slate-400 border-slate-200" : "border-slate-300"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">Country</label>
                      <input
                        type="text"
                        value={invoiceHeader.customerCountry}
                        disabled
                        className="w-full text-xs border border-slate-200 bg-slate-50 font-semibold rounded-lg p-2 text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Customer Discount (%)</label>
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

                  {/* CONSIGNEE TOGGLE */}
                  <div className="pt-1">
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
                              placeholder="e.g. Indbuy Receiving Warehouse"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Consignee GSTIN (Optional)</label>
                            <input
                              type="text"
                              value={invoiceHeader.consigneeGstin}
                              onChange={(e) => setInvoiceHeader({ ...invoiceHeader, consigneeGstin: e.target.value.toUpperCase() })}
                              className="w-full text-xs font-mono border border-slate-300 rounded p-1.5 bg-white"
                              placeholder="09ABCDE1234F1Z5"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Delivery / Shipping Address</label>
                            <input
                              type="text"
                              value={invoiceHeader.consigneeAddress}
                              onChange={(e) => setInvoiceHeader({ ...invoiceHeader, consigneeAddress: e.target.value })}
                              className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                              placeholder="Complete shipping address"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* LINE ITEMS */}
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

                {/* BOTTOM SUMMARY STRIP */}
                <div className="border-t border-slate-100 pt-6 grid grid-cols-2 gap-8">
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
                        <span>Auto Round Off (+/-):</span>
                        <span className="font-mono font-semibold text-slate-700">
                          {autoRoundOff >= 0 ? `+₹${autoRoundOff.toFixed(2)}` : `-₹${Math.abs(autoRoundOff).toFixed(2)}`}
                        </span>
                      </div>

                      <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-base font-bold text-slate-900">
                        <span>Grand Total (Rounded):</span>
                        <span className="font-mono text-emerald-700 text-lg">
                          ₹{roundedGrandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

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
                        <th className="py-3 px-4">PO No.</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer Name & Country</th>
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
                          <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                            {inv.poNumber || "-"}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {inv.invoiceDate}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900">{inv.customerName}</p>
                            <p className="font-mono text-[10px] text-slate-400">
                              {inv.customerCountry !== "India" ? `${inv.customerCountry} (Export)` : (inv.customerGstin || "Unregistered")}
                            </p>
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

      {/* POS CONSOLIDATED SALES PLACEHOLDER */}
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

      {/* MODAL 1: ADD NEW CUSTOMER WITH COUNTRY SELECTION */}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Country</label>
                  <select
                    value={newCust.country}
                    onChange={(e) => handleCustCountryChange(e.target.value)}
                    className="w-full text-xs font-semibold p-2 border border-slate-300 rounded bg-white"
                  >
                    {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer GSTIN</label>
                  <input
                    type="text"
                    disabled={newCust.country !== "India"}
                    placeholder={newCust.country !== "India" ? "Not Applicable" : "24ABCDE1234F1Z5"}
                    value={newCust.gstin}
                    onChange={(e) => handleCustGstinChange(e.target.value)}
                    className={`w-full text-xs font-mono font-semibold border rounded p-2 ${
                      newCust.country !== "India" ? "bg-slate-100 text-slate-400 border-slate-200" : "border-slate-300"
                    }`}
                  />
                </div>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pincode / Postal Code</label>
                  <input
                    type="text"
                    value={newCust.pincode}
                    onChange={(e) => setNewCust({ ...newCust, pincode: e.target.value })}
                    className="w-full text-xs font-mono border border-slate-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State / Province</label>
                  <input
                    type="text"
                    disabled={newCust.country !== "India"}
                    placeholder={newCust.country !== "India" ? "Not Applicable" : "Gujarat"}
                    value={newCust.state}
                    onChange={(e) => setNewCust({ ...newCust, state: e.target.value })}
                    className={`w-full text-xs border rounded p-2 font-medium ${
                      newCust.country !== "India" ? "bg-slate-100 text-slate-400 border-slate-200" : "border-slate-300"
                    }`}
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

      {/* MODAL 2: ADD NEW PRODUCT TO CATALOG */}
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

      {/* MODAL 3: INVOICE PREVIEW WITH A4 FULL-PAGE DISPATCH */}
      {showPrintModal && selectedInvoiceForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <button
            onClick={() => setShowPrintModal(false)}
            className="fixed top-4 right-6 z-[60] bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 p-2.5 rounded-full shadow-2xl border border-slate-200 transition"
            title="Close Preview (Esc)"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 my-6 text-slate-900 font-sans">
            <div className="flex items-center justify-between border-b pb-4 mb-5">
              <div>
                <span className="font-bold text-sm text-slate-900">Invoice: #{selectedInvoiceForPrint.invoiceNumber}</span>
                <span className="text-xs text-slate-400 ml-2">({selectedInvoiceForPrint.invoiceType})</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => triggerFullPagePrint(selectedInvoiceForPrint)}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition shadow-md"
                >
                  <Printer className="w-4 h-4" /> Print / Save Full-Page A4 PDF
                </button>
              </div>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="border border-slate-300 p-4 rounded-lg text-xs space-y-3 bg-white">
              <div className="text-center font-black text-sm tracking-wider uppercase border-b pb-2 text-blue-900">
                {selectedInvoiceForPrint.invoiceType}
              </div>

              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{selectedInvoiceForPrint.vendorProfile?.companyName}</h3>
                  <p className="text-[11px] text-slate-500">{selectedInvoiceForPrint.vendorProfile?.address}</p>
                  <p className="text-[11px] font-mono font-bold mt-1">GSTIN: {selectedInvoiceForPrint.vendorProfile?.gstin}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold">#{selectedInvoiceForPrint.invoiceNumber}</p>
                  <p className="text-[11px] text-slate-500">Date: {selectedInvoiceForPrint.invoiceDate}</p>
                  {selectedInvoiceForPrint.poNumber && (
                    <p className="text-[11px] font-mono text-indigo-700">PO: {selectedInvoiceForPrint.poNumber}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b pb-3">
                <div>
                  <p className="font-bold text-[10px] text-slate-400 uppercase">Billed To</p>
                  <p className="font-bold text-slate-900">{selectedInvoiceForPrint.customerName}</p>
                  <p className="text-[11px] text-slate-600">{selectedInvoiceForPrint.billingAddress}</p>
                  <p className="text-[11px] font-semibold text-slate-600">Country: {selectedInvoiceForPrint.customerCountry || "India"}</p>
                  {selectedInvoiceForPrint.customerGstin && (
                    <p className="text-[11px] font-mono">GSTIN: {selectedInvoiceForPrint.customerGstin}</p>
                  )}
                </div>
                <div>
                  <p className="font-bold text-[10px] text-slate-400 uppercase">Shipped To</p>
                  <p className="font-bold text-slate-900">
                    {selectedInvoiceForPrint.hasConsignee ? selectedInvoiceForPrint.consigneeName : selectedInvoiceForPrint.customerName}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {selectedInvoiceForPrint.hasConsignee ? selectedInvoiceForPrint.consigneeAddress : selectedInvoiceForPrint.billingAddress}
                  </p>
                </div>
              </div>

              <table className="w-full text-left text-[11px] border border-slate-200">
                <thead className="bg-slate-50 border-b font-bold uppercase text-[9px]">
                  <tr>
                    <th className="p-1.5 border-r">Item</th>
                    <th className="p-1.5 border-r text-center">HSN</th>
                    <th className="p-1.5 border-r text-right">Qty</th>
                    <th className="p-1.5 border-r text-center">UOM</th>
                    <th className="p-1.5 border-r text-right">Rate</th>
                    <th className="p-1.5 border-r text-right">Disc%</th>
                    <th className="p-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoiceForPrint.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-1.5 border-r font-semibold">{it.itemName}</td>
                      <td className="p-1.5 border-r text-center font-mono">{it.hsnCode}</td>
                      <td className="p-1.5 border-r text-right font-mono font-bold">{it.qty}</td>
                      <td className="p-1.5 border-r text-center">{it.uom}</td>
                      <td className="p-1.5 border-r text-right font-mono">₹{it.rate}</td>
                      <td className="p-1.5 border-r text-right font-mono">{it.discountPercent}%</td>
                      <td className="p-1.5 text-right font-mono font-bold">₹{it.total?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-slate-50 font-bold">
                    <td colSpan="2" className="p-1.5 text-right">Total:</td>
                    <td className="p-1.5 text-right font-mono font-black">{selectedInvoiceForPrint.totalQuantity}</td>
                    <td colSpan="3" className="p-1.5 text-right">Grand Total:</td>
                    <td className="p-1.5 text-right font-mono font-black text-emerald-700">₹{selectedInvoiceForPrint.grandTotal?.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => triggerFullPagePrint(selectedInvoiceForPrint)}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Invoice
                </button>
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
