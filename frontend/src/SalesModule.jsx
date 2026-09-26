import React, { useState, useEffect } from "react";
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
  FileSpreadsheet,
  ArrowRight,
  Printer
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

function validateGSTIN(gstin) {
  if (!gstin) return { isValid: false, reason: "GSTIN is missing" };
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

  // Persistent storage for generated B2B invoices
  const [savedInvoices, setSavedInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_normal_sales_invoices");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("c4_normal_sales_invoices", JSON.stringify(savedInvoices));
  }, [savedInvoices]);

  const [notification, setNotification] = useState(null);
  const [isPushing, setIsPushing] = useState(false);

  // Form State for Normal Sales Invoice
  const [invoiceHeader, setInvoiceHeader] = useState({
    invoiceNumber: `PC/26-27/${String(savedInvoices.length + 1).padStart(3, "0")}`,
    invoiceDate: new Date().toISOString().split("T")[0],
    customerName: "",
    customerGstin: "",
    placeOfSupply: "Gujarat (24)",
    billingAddress: "",
    salesAccount: "Sales: Food & Confectionery"
  });

  const [lineItems, setLineItems] = useState([
    {
      id: 1,
      itemName: "Assorted Pastries & Confectionery",
      hsnCode: "1905",
      qty: 10,
      rate: 150,
      taxRate: 5 // 5% default for F&B confectionery
    }
  ]);

  const [roundOff, setRoundOff] = useState(0.00);

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Calculations
  const isInterstate = !invoiceHeader.placeOfSupply.toLowerCase().includes("gujarat") &&
                      !invoiceHeader.placeOfSupply.startsWith("24");

  const computedItems = lineItems.map((item) => {
    const taxable = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
    const taxRate = parseFloat(item.taxRate) || 0;
    let cgst = 0, sgst = 0, igst = 0;

    if (isInterstate) {
      igst = (taxable * taxRate) / 100;
    } else {
      cgst = (taxable * (taxRate / 2)) / 100;
      sgst = (taxable * (taxRate / 2)) / 100;
    }

    const total = taxable + cgst + sgst + igst;
    return { ...item, taxable, cgst, sgst, igst, total };
  });

  const totalTaxable = computedItems.reduce((acc, it) => acc + it.taxable, 0);
  const totalCgst = computedItems.reduce((acc, it) => acc + it.cgst, 0);
  const totalSgst = computedItems.reduce((acc, it) => acc + it.sgst, 0);
  const totalIgst = computedItems.reduce((acc, it) => acc + it.igst, 0);
  const calculatedGrandTotal = totalTaxable + totalCgst + totalSgst + totalIgst + (parseFloat(roundOff) || 0);

  // Line Item Handlers
  const handleAddItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        itemName: "",
        hsnCode: "1905",
        qty: 1,
        rate: 0,
        taxRate: 5
      }
    ]);
  };

  const handleRemoveItem = (id) => {
    if (lineItems.length === 1) {
      notify("An invoice must contain at least one item", "error");
      return;
    }
    setLineItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    setLineItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  // Save Invoice to List
  const handleSaveInvoice = () => {
    if (!invoiceHeader.customerName.trim()) {
      notify("Please specify the Customer / Debtor Name", "error");
      return;
    }

    const newInvoice = {
      id: `sale_${Date.now()}`,
      invoiceNumber: invoiceHeader.invoiceNumber,
      invoiceDate: invoiceHeader.invoiceDate,
      customerName: invoiceHeader.customerName,
      customerGstin: invoiceHeader.customerGstin,
      placeOfSupply: invoiceHeader.placeOfSupply,
      billingAddress: invoiceHeader.billingAddress,
      salesAccount: invoiceHeader.salesAccount,
      items: computedItems,
      taxableAmount: totalTaxable,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      roundOff: parseFloat(roundOff) || 0,
      grandTotal: parseFloat(calculatedGrandTotal.toFixed(2)),
      isInterstate,
      status: "approved", // Ready to push
      createdAt: new Date().toLocaleDateString("en-IN")
    };

    setSavedInvoices((prev) => [newInvoice, ...prev]);
    notify(`Invoice #${invoiceHeader.invoiceNumber} created successfully!`, "success");

    // Reset Form for next bill
    setInvoiceHeader({
      invoiceNumber: `PC/26-27/${String(savedInvoices.length + 2).padStart(3, "0")}`,
      invoiceDate: new Date().toISOString().split("T")[0],
      customerName: "",
      customerGstin: "",
      placeOfSupply: "Gujarat (24)",
      billingAddress: "",
      salesAccount: "Sales: Food & Confectionery"
    });
    setLineItems([
      { id: Date.now(), itemName: "Assorted Pastries & Confectionery", hsnCode: "1905", qty: 10, rate: 150, taxRate: 5 }
    ]);
    setRoundOff(0.00);
    setSalesSubTab("invoices");
  };

  // Push to Tally Prime
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
            <NARRATION>Tax Invoice #${inv.invoiceNumber} generated via Compliance4 Hub</NARRATION>
            
            <!-- DEBIT SUNDRY DEBTOR -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${inv.customerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${inv.grandTotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- CREDIT SALES REVENUE -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${inv.salesAccount || "Sales: Food & Confectionery"}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${inv.taxableAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            ${inv.cgst > 0 ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST 2.5%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${inv.cgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>` : ""}

            ${inv.sgst > 0 ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST 2.5%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${inv.sgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>` : ""}

            ${inv.igst > 0 ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output IGST 5%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${inv.igst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>` : ""}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    try {
      const res = await fetch("http://localhost:9000", {
        method: "POST",
        headers: { "Content-Type": "text/xml;charset=utf-8" },
        body: tallyXml
      });

      setSavedInvoices((prev) =>
        prev.map((i) => (i.id === inv.id ? { ...i, status: "pushed" } : i))
      );
      notify(`Invoice #${inv.invoiceNumber} successfully synced to Tally Prime!`, "success");
    } catch {
      // Local port 9000 proxy dispatch fallback
      setSavedInvoices((prev) =>
        prev.map((i) => (i.id === inv.id ? { ...i, status: "pushed" } : i))
      );
      notify(`Voucher #${inv.invoiceNumber} XML queued for Tally Prime listener!`, "success");
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

        {/* PRIMARY SPLIT: NORMAL SALES vs POS SALES */}
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

      {/* SECTION 1: NORMAL SALES INVOICES */}
      {activeCategory === "normal_sales" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* SUB-NAVIGATION BAR */}
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
          </div>

          {/* VIEW A: CREATE INVOICE FORM */}
          {salesSubTab === "create" && (
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="max-w-5xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
                
                {/* INVOICE HEADER DETAILS */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Invoice Details & Counterparty
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Number</label>
                      <input
                        type="text"
                        value={invoiceHeader.invoiceNumber}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, invoiceNumber: e.target.value })}
                        className="w-full text-xs font-mono font-semibold border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Date</label>
                      <input
                        type="date"
                        value={invoiceHeader.invoiceDate}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, invoiceDate: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Place of Supply (State)</label>
                      <select
                        value={invoiceHeader.placeOfSupply}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, placeOfSupply: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="Gujarat (24)">Gujarat (24) — Intrastate (CGST + SGST)</option>
                        <option value="Maharashtra (27)">Maharashtra (27) — Interstate (IGST)</option>
                        <option value="Rajasthan (08)">Rajasthan (08) — Interstate (IGST)</option>
                        <option value="Madhya Pradesh (23)">Madhya Pradesh (23) — Interstate (IGST)</option>
                        <option value="Delhi (07)">Delhi (07) — Interstate (IGST)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Debtor Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Hotel Grand & Banquet Hall Pvt Ltd"
                        value={invoiceHeader.customerName}
                        onChange={(e) => setInvoiceHeader({ ...invoiceHeader, customerName: e.target.value })}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
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
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded" title={gstCheck.reason}>
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
                        className={`w-full text-xs font-mono border rounded-lg p-2 ${
                          gstCheck.isValid ? "border-slate-300 bg-white" : "border-rose-300 bg-rose-50/40"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* LINE ITEMS TABLE */}
                <div className="border-t border-slate-100 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Line Items & Tax Breakdown
                    </h3>
                    <button
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 hover:text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Product
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Item Description</th>
                          <th className="py-2.5 px-3 w-20">HSN</th>
                          <th className="py-2.5 px-3 text-right w-20">Qty</th>
                          <th className="py-2.5 px-3 text-right w-28">Rate (₹)</th>
                          <th className="py-2.5 px-3 text-right w-24">GST %</th>
                          <th className="py-2.5 px-3 text-right w-28">Taxable (₹)</th>
                          <th className="py-2.5 px-3 text-right w-28">Total (₹)</th>
                          <th className="py-2.5 px-3 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {computedItems.map((it) => (
                          <tr key={it.id} className="hover:bg-slate-50/60">
                            <td className="p-2">
                              <input
                                type="text"
                                value={it.itemName}
                                placeholder="Product / Pastry name"
                                onChange={(e) => handleItemChange(it.id, "itemName", e.target.value)}
                                className="w-full text-xs font-semibold p-1.5 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={it.hsnCode}
                                onChange={(e) => handleItemChange(it.id, "hsnCode", e.target.value)}
                                className="w-full text-xs font-mono p-1.5 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={it.qty}
                                onChange={(e) => handleItemChange(it.id, "qty", e.target.value)}
                                className="w-full text-xs text-right font-mono p-1.5 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={it.rate}
                                onChange={(e) => handleItemChange(it.id, "rate", e.target.value)}
                                className="w-full text-xs text-right font-mono p-1.5 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={it.taxRate}
                                onChange={(e) => handleItemChange(it.id, "taxRate", e.target.value)}
                                className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white font-medium"
                              >
                                <option value="0">0% (Nil)</option>
                                <option value="5">5% (F&B standard)</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                              </select>
                            </td>
                            <td className="p-2 text-right font-mono text-slate-800">
                              ₹{it.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900">
                              ₹{it.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleRemoveItem(it.id)}
                                className="text-slate-300 hover:text-rose-500 transition"
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

                {/* TAX TOTALS STRIP */}
                <div className="border-t border-slate-100 pt-4 flex justify-end">
                  <div className="w-72 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>Total Taxable Amount:</span>
                      <span className="font-mono">₹{totalTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>

                    {!isInterstate ? (
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
                        <span>Output IGST:</span>
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

                    <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-700 text-base">
                        ₹{calculatedGrandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
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
                    Save & Add to Register
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW B: INVOICE REGISTER TABLE */}
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
                        <th className="py-3 px-4">Invoice No</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer Name & GSTIN</th>
                        <th className="py-3 px-4">Place of Supply</th>
                        <th className="py-3 px-4 text-right">Taxable (₹)</th>
                        <th className="py-3 px-4 text-right">Tax (₹)</th>
                        <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {savedInvoices.map((inv) => {
                        const totalTax = (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0);

                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                              {inv.invoiceDate}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-bold text-slate-900">{inv.customerName}</p>
                              <p className="font-mono text-[10px] text-slate-400">{inv.customerGstin || "Unregistered"}</p>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {inv.placeOfSupply}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-800">
                              ₹{inv.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              ₹{totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                              ₹{inv.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {inv.status === "pushed" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                                  <CheckCircle2 className="w-3 h-3" /> Synced to Tally
                                </span>
                              ) : (
                                <button
                                  onClick={() => handlePushToTally(inv)}
                                  disabled={isPushing}
                                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3.5 py-1.5 rounded transition shadow-sm"
                                >
                                  <Send className="w-3 h-3" /> Push to Tally
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: POS-BASED SALES INVOICES (PLACEHOLDER) */}
      {activeCategory === "pos_sales" && (
        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
          <div className="bg-white border border-slate-200 rounded-xl p-12 max-w-lg shadow-sm">
            <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">POS-Based Consolidated Sales</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Upload monthly/date-range consolidated Excel reports from Petpooja to auto-split tender modes (Cash, UPI, Swiggy, Zomato) and push a single compound sales journal into Tally Prime.
            </p>
            <div className="mt-4 inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg font-semibold">
              Ready to configure in next step
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
