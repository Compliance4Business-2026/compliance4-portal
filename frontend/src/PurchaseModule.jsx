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
  ArrowRight
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

export default function PurchaseModule({ activeClient = "Panasuria Confectionery" }) {
  const [activeBill, setActiveBill] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [toast, setToast] = useState(null);

  // 1. Memorized Item -> Ledger Rules from localStorage
  const [itemRules, setItemRules] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_purchase_item_rules");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Keep localStorage synchronized
  useEffect(() => {
    localStorage.setItem("c4_purchase_item_rules", JSON.stringify(itemRules));
  }, [itemRules]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 2. Upload Invoice & Extract via Gemini
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
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
      let matchedCount = 0;

      // Apply memorized rules to extracted line items
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
        showToast(`Invoice #${billData.supplier_invoice_no || billData.invoice_number} extracted!`);
      }
    } catch (err) {
      showToast(`Extraction failed: ${err.message}`, "error");
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  // 3. Handle Item Ledger Change & Learn for Future
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

    // Memorize mapping
    if (itemName) {
      const cleanKey = itemName.trim().toLowerCase();
      setItemRules((prev) => ({
        ...prev,
        [cleanKey]: newLedger
      }));
      showToast(`Memorized "${itemName}" → ${newLedger}`);
    }
  };

  // 4. Push Invoice to Tally Prime
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

      showToast(`Voucher #${activeBill.supplier_invoice_no || activeBill.invoice_number} synced to Tally Prime!`);
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
              Upload a vendor invoice (PDF, JPG, PNG) to extract data with Gemini AI and auto-map line item ledgers.
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* INVOICE SUMMARY CARD */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{activeBill.vendor_name || "Vendor Unknown"}</h3>
                    <p className="text-xs text-slate-400 font-mono">GSTIN: {activeBill.vendor_gstin || "N/A"}</p>
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

            {/* EXTRACTED ITEMS & LEDGER ASSIGNMENT TABLE */}
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
                  Ready to dispatch to Tally Prime Port 9000
                </span>
                <button
                  onClick={handlePushToTally}
                  disabled={pushing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {pushing ? "Pushing to Tally..." : "Push Voucher to Tally Prime"}
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
