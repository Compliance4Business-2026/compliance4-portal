import React, { useState, useEffect } from "react";
import { 
  Upload, 
  CheckCircle, 
  Send, 
  FileText, 
  AlertCircle, 
  Sparkles, 
  Building, 
  Calendar, 
  Hash, 
  Layers, 
  AlertTriangle, 
  ShieldCheck, 
  ShieldAlert 
} from "lucide-react";

const BACKEND_BASE = "https://compliance4-backend-1021821620394.asia-south1.run.app";

const DEFAULT_PURCHASE_LEDGERS = [
  "Purchase: General Goods",
  "Raw Material Purchases - Flour/Dairy",
  "Bakery Ingredients & Essentials",
  "Packaging Material Expenses",
  "Kitchen Consumables & Supplies",
  "Beverages & Syrups Stock",
  "Cleaning & Sanitation Supplies",
  "Repairs & Maintenance",
  "Printing & Stationery Expenses"
];

// Indian State Codes dictionary
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

// Modulo-36 GSTIN Checksum Validator
function validateGSTIN(gstin) {
  if (!gstin) return { isValid: false, reason: "GSTIN is missing" };
  const clean = gstin.trim().toUpperCase();
  
  if (clean.length !== 15) {
    return { isValid: false, reason: "Must be exactly 15 characters" };
  }

  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) {
    return { isValid: false, reason: "Invalid GSTIN structure or 14th character is not 'Z'" };
  }

  const stateCode = clean.substring(0, 2);
  const stateName = GST_STATE_CODES[stateCode];
  if (!stateName) {
    return { isValid: false, reason: `Invalid State Code: ${stateCode}` };
  }

  // Modulo-36 Checksum verification
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
  const actualCheckChar = clean[14];

  if (expectedCheckChar !== actualCheckChar) {
    return { 
      isValid: false, 
      reason: `Checksum failed (expected ${expectedCheckChar}, found ${actualCheckChar})`,
      stateName 
    };
  }

  return { isValid: true, stateName, stateCode };
}

export default function PurchaseModule({ activeClient = "Panasuria Confectionery" }) {
  const [activeBill, setActiveBill] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [toast, setToast] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [gstValidation, setGstValidation] = useState(null);

  // 1. Memorized Item -> Ledger Rules from localStorage
  const [itemRules, setItemRules] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_purchase_item_rules");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 2. Previously Synced / Processed Invoices for Duplicate Detection
  const [processedInvoices, setProcessedInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_processed_invoices");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("c4_purchase_item_rules", JSON.stringify(itemRules));
  }, [itemRules]);

  useEffect(() => {
    localStorage.setItem("c4_processed_invoices", JSON.stringify(processedInvoices));
  }, [processedInvoices]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 3. Upload & Extract Invoice
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setDuplicateWarning(null);
    setGstValidation(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", activeClient);

    try {
      const res = await fetch(`${BACKEND_BASE}/api/invoices/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server responded with status ${res.status}`);
      }

      const billData = await res.json();
      const invoiceNo = (billData.supplier_invoice_no || billData.invoice_number || "").trim().toUpperCase();
      const vendorGstin = (billData.vendor_gstin || "").trim().toUpperCase();
      const vendorName = (billData.vendor_name || "").trim().toLowerCase();

      // Check for Duplicates
      const duplicate = processedInvoices.find(
        (inv) =>
          inv.invoiceNo === invoiceNo &&
          (inv.vendorGstin === vendorGstin || inv.vendorName === vendorName)
      );

      if (duplicate) {
        setDuplicateWarning({
          invoiceNo,
          vendorName: billData.vendor_name,
          pushedAt: duplicate.date || "earlier session",
        });
      }

      // Check GSTIN Validity
      const validation = validateGSTIN(vendorGstin);
      setGstValidation(validation);

      // Apply Memorized Line Item Rules
      let matchedCount = 0;
      const itemsWithMemory = (billData.items || []).map((item) => {
        const cleanName = (item.item_name || "").trim().toLowerCase();
        const savedLedger = itemRules[cleanName];

        if (savedLedger) {
          matchedCount++;
          return {
            ...item,
            ledger: savedLedger,
            isAutoMatched: true
          };
        }

        return {
          ...item,
          ledger: "Purchase: General Goods",
          isAutoMatched: false
        };
      });

      const processedBill = {
        ...billData,
        items: itemsWithMemory,
        accounting_ledgers: [
          {
            ledger_name: itemsWithMemory[0]?.ledger || "Purchase: General Goods",
            amount: billData.taxable_amount || 0.0
          }
        ]
      };

      setActiveBill(processedBill);

      if (matchedCount > 0) {
        showToast(`Extracted bill with ${matchedCount} items auto-mapped from memory!`);
      } else {
        showToast(`Invoice #${invoiceNo || "N/A"} extracted successfully!`);
      }
    } catch (err) {
      showToast(`Extraction failed: ${err.message}`, "error");
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  // 4. Handle Item Ledger Change & Memorize
  const handleItemLedgerChange = (index, newLedger, itemName) => {
    if (!activeBill) return;

    const updatedItems = [...activeBill.items];
    updatedItems[index] = {
      ...updatedItems[index],
      ledger: newLedger,
      isAutoMatched: true
    };

    setActiveBill({
      ...activeBill,
      items: updatedItems,
      accounting_ledgers: [
        {
          ledger_name: newLedger,
          amount: activeBill.taxable_amount || 0.0
        }
      ]
    });

    if (itemName) {
      const cleanKey = itemName.trim().toLowerCase();
      setItemRules((prev) => ({
        ...prev,
        [cleanKey]: newLedger
      }));
      showToast(`Memorized "${itemName}" → ${newLedger}`);
    }
  };

  // 5. Push to Tally Prime & Record for Duplicate Check
  const handlePushToTally = async () => {
    if (!activeBill) return;

    setPushing(true);
    try {
      const res = await fetch(`${BACKEND_BASE}/api/tally/push-voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bill: activeBill,
          company_name: activeClient
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to push to Tally Prime");
      }

      // Record invoice to prevent future duplicate entry
      const invoiceNo = (activeBill.supplier_invoice_no || activeBill.invoice_number || "").trim().toUpperCase();
      const vendorGstin = (activeBill.vendor_gstin || "").trim().toUpperCase();
      const vendorName = (activeBill.vendor_name || "").trim().toLowerCase();

      setProcessedInvoices((prev) => [
        {
          invoiceNo,
          vendorGstin,
          vendorName,
          date: new Date().toLocaleDateString("en-IN")
        },
        ...prev
      ]);

      showToast(`Voucher #${invoiceNo} synced to Tally Prime!`);
      setDuplicateWarning(null);
    } catch (err) {
      showToast(`Tally push error: ${err.message}`, "error");
    } finally {
      setPushing(false);
    }
  };

  const memorizedRulesCount = Object.keys(itemRules).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Invoices</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-500 font-medium">{activeClient}</p>
            {memorizedRulesCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                <Sparkles className="w-2.5 h-2.5" />
                {memorizedRulesCount} Item Mappings Learned
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Extracting..." : "Upload Purchase Invoice"}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </header>

      {/* CONTENT AREA */}
      <div className="flex-1 p-8 overflow-y-auto">
        {!activeBill ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-700">No Purchase Invoice Loaded</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Upload a vendor invoice (PDF, JPG, PNG) to extract fields, validate GSTIN, and inspect for duplicate records.
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-5">
            {/* DUPLICATE INVOICE BANNER */}
            {duplicateWarning && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-amber-900 text-sm">Potential Duplicate Invoice Detected</p>
                  <p className="text-amber-800 mt-0.5">
                    Invoice <span className="font-mono font-bold">#{duplicateWarning.invoiceNo}</span> from{" "}
                    <span className="font-semibold">{duplicateWarning.vendorName}</span> was already pushed to Tally on{" "}
                    {duplicateWarning.pushedAt}. Double-check to avoid duplicate liability and ITC claims.
                  </p>
                </div>
              </div>
            )}

            {/* INVOICE SUMMARY CARD */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{activeBill.vendor_name || "Vendor Unknown"}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500 font-mono font-semibold">
                        GSTIN: {activeBill.vendor_gstin || "N/A"}
                      </span>

                      {/* GSTIN Verification Badge */}
                      {gstValidation && (
                        gstValidation.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Valid GSTIN ({gstValidation.stateName})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full" title={gstValidation.reason}>
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            Invalid GSTIN ({gstValidation.reason})
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span>Inv: {activeBill.supplier_invoice_no || activeBill.invoice_number || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Date: {activeBill.bill_date || activeBill.invoice_date || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* AMOUNTS STRIP */}
              <div className="grid grid-cols-4 gap-4 pt-4 text-center">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] uppercase font-semibold text-slate-400">Taxable Value</p>
                  <p className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                    ₹{Number(activeBill.taxable_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] uppercase font-semibold text-slate-400">CGST + SGST</p>
                  <p className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                    ₹{(Number(activeBill.cgst || 0) + Number(activeBill.sgst || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] uppercase font-semibold text-slate-400">IGST</p>
                  <p className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                    ₹{Number(activeBill.igst || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <p className="text-[10px] uppercase font-semibold text-emerald-600">Grand Total</p>
                  <p className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                    ₹{Number(activeBill.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* EXTRACTED ITEMS TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Extracted Line Items ({activeBill.items?.length || 0})
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400">
                  Selecting a ledger saves it automatically for subsequent invoices
                </p>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4 text-right">Qty</th>
                    <th className="py-3 px-4 text-right">Rate (₹)</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4">Expense Ledger (Tally Head)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(activeBill.items || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {item.item_name}
                        {item.isAutoMatched && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium border border-indigo-200">
                            <Sparkles className="w-2.5 h-2.5" /> Memorized
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">{item.qty || 1}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        ₹{Number(item.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900 font-bold">
                        ₹{Number(item.amount || (item.qty || 1) * (item.rate || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={item.ledger || "Purchase: General Goods"}
                          onChange={(e) => handleItemLedgerChange(idx, e.target.value, item.item_name)}
                          className={`border rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none transition w-full max-w-xs ${
                            item.isAutoMatched
                              ? "bg-indigo-50/60 border-indigo-200 text-indigo-900"
                              : "bg-white border-slate-200 text-slate-800"
                          }`}
                        >
                          {DEFAULT_PURCHASE_LEDGERS.map((ledgerOption) => (
                            <option key={ledgerOption} value={ledgerOption}>
                              {ledgerOption}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ACTION FOOTER */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  {duplicateWarning ? (
                    <span className="text-amber-700 font-semibold">⚠️ Duplicate detected — verify before pushing</span>
                  ) : (
                    "Ready to dispatch to Tally Prime Port 9000"
                  )}
                </span>
                <button
                  onClick={handlePushToTally}
                  disabled={pushing}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 text-white ${
                    duplicateWarning
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {pushing ? "Pushing to Tally..." : duplicateWarning ? "Push Anyway (Override)" : "Push Voucher to Tally Prime"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TOAST ALERTS */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition-all z-50 ${
            toast.type === "error" ? "bg-rose-600" : "bg-slate-900"
          }`}
        >
          {toast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
