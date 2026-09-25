import React, { useState, useEffect } from "react";
import { 
  Upload, 
  CheckCircle, 
  Send, 
  FileText, 
  AlertCircle, 
  Sparkles,
  Trash2,
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

function validateGSTIN(gstin) {
  if (!gstin) return { isValid: false, reason: "GSTIN missing" };
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

export default function PurchaseModule({ activeClient = "Panasuria Confectionery" }) {
  const [bills, setBills] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_purchase_bills");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [itemRules, setItemRules] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_purchase_item_rules");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeTab, setActiveTab] = useState("needs_review");
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    localStorage.setItem("c4_purchase_bills", JSON.stringify(bills));
  }, [bills]);

  useEffect(() => {
    localStorage.setItem("c4_purchase_item_rules", JSON.stringify(itemRules));
  }, [itemRules]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const billData = await res.json();
      const invNo = (billData.supplier_invoice_no || billData.invoice_number || "").trim().toUpperCase();
      const vendor = (billData.vendor_name || "").trim().toLowerCase();

      // Check duplicates
      const isDuplicate = bills.some(
        (b) => (b.supplier_invoice_no || b.invoice_number || "").trim().toUpperCase() === invNo &&
               (b.vendor_name || "").trim().toLowerCase() === vendor
      );

      const gstCheck = validateGSTIN(billData.vendor_gstin);

      // Check learned item mappings
      let matchedLedger = "Purchase: General Goods";
      if (billData.items && billData.items.length > 0) {
        const firstItem = (billData.items[0].item_name || "").trim().toLowerCase();
        if (itemRules[firstItem]) matchedLedger = itemRules[firstItem];
      }

      const newBill = {
        ...billData,
        id: billData.id || `inv_${Date.now()}`,
        status: "needs_review",
        isDuplicate,
        gstValid: gstCheck.isValid,
        gstState: gstCheck.stateName || "",
        accounting_ledgers: [{ ledger_name: matchedLedger, amount: billData.taxable_amount || 0 }]
      };

      setBills((prev) => [newBill, ...prev]);
      setActiveTab("needs_review");
      showToast(isDuplicate ? `⚠️ Warning: Invoice #${invNo} appears to be a duplicate!` : `Invoice #${invNo} imported!`);
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, "error");
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleLedgerChange = (billId, newLedger) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id === billId) {
          // Memorize first item
          if (b.items && b.items.length > 0) {
            const firstItem = (b.items[0].item_name || "").trim().toLowerCase();
            if (firstItem) {
              setItemRules((r) => ({ ...r, [firstItem]: newLedger }));
            }
          }
          return {
            ...b,
            status: "approved",
            accounting_ledgers: [{ ledger_name: newLedger, amount: b.taxable_amount || 0 }]
          };
        }
        return b;
      })
    );
    showToast("Moved to Approved!");
  };

  const handleApprove = (id) => {
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, status: "approved" } : b)));
  };

  const handlePushSingle = async (bill) => {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/tally/push-voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bill, company_name: activeClient }),
      });
      if (!res.ok) throw new Error("Push to Tally failed");

      setBills((prev) => prev.map((b) => (b.id === bill.id ? { ...b, status: "pushed" } : b)));
      showToast(`Invoice #${bill.supplier_invoice_no || bill.invoice_number} synced to Tally!`);
    } catch (err) {
      showToast(`Tally push error: ${err.message}`, "error");
    }
  };

  const handlePushAllApproved = async () => {
    const toPush = bills.filter((b) => b.status === "approved");
    if (toPush.length === 0) return;

    setSyncing(true);
    let count = 0;
    for (const bill of toPush) {
      try {
        await fetch(`${BACKEND_BASE}/api/tally/push-voucher`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bill, company_name: activeClient }),
        });
        count++;
      } catch (e) {
        console.error(e);
      }
    }
    setBills((prev) => prev.map((b) => (b.status === "approved" ? { ...b, status: "pushed" } : b)));
    setSyncing(false);
    showToast(`Pushed ${count} invoices to Tally Prime!`);
  };

  const handleClearAll = () => {
    if (window.confirm("Clear all purchase bills?")) {
      setBills([]);
      localStorage.removeItem("c4_purchase_bills");
      showToast("Cleared purchase invoices.");
    }
  };

  const needsReviewCount = bills.filter((b) => b.status === "needs_review").length;
  const approvedCount = bills.filter((b) => b.status === "approved").length;
  const pushedCount = bills.filter((b) => b.status === "pushed").length;
  const displayedBills = bills.filter((b) => b.status === activeTab);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Invoices</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-500 font-medium">{activeClient}</p>
            {Object.keys(itemRules).length > 0 && (
              <span className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                <Sparkles className="w-2.5 h-2.5" />
                {Object.keys(itemRules).length} Rules Learned
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {bills.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </button>
          )}

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

      {/* TABS & BATCH ACTIONS */}
      <div className="px-8 pt-4 pb-2 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab("needs_review")}
            className={`pb-2.5 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "needs_review"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Needs Review
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "needs_review" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {needsReviewCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("approved")}
            className={`pb-2.5 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "approved"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Approved Invoices
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "approved" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {approvedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("pushed")}
            className={`pb-2.5 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "pushed"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Pushed to Tally
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "pushed" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {pushedCount}
            </span>
          </button>
        </div>

        <div>
          {activeTab === "approved" && approvedCount > 0 && (
            <button
              onClick={handlePushAllApproved}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              {syncing ? "Pushing..." : `Push All to Tally (${approvedCount})`}
            </button>
          )}
        </div>
      </div>

      {/* TABLE DATA CONTAINER */}
      <div className="flex-1 p-8 overflow-y-auto">
        {displayedBills.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              No invoices in {activeTab === "needs_review" ? "Needs Review" : activeTab === "approved" ? "Approved" : "Pushed"}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Upload vendor bills (PDF or Images) to extract and review them here.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Inv #</th>
                  <th className="py-3 px-4">Supplier & GSTIN</th>
                  <th className="py-3 px-4">Expense Ledger</th>
                  <th className="py-3 px-4 text-right">Taxable (₹)</th>
                  <th className="py-3 px-4 text-right">GST (₹)</th>
                  <th className="py-3 px-4 text-right">Total (₹)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {displayedBills.map((b) => {
                  const currentLedger = b.accounting_ledgers?.[0]?.ledger_name || "Purchase: General Goods";
                  const gstTotal = (Number(b.cgst || 0) + Number(b.sgst || 0) + Number(b.igst || 0));

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                        {b.bill_date || b.invoice_date || "-"}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {b.supplier_invoice_no || b.invoice_number || "-"}
                        {b.isDuplicate && (
                          <span className="ml-1 inline-flex items-center text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                            Duplicate
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{b.vendor_name || "Unknown"}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px] text-slate-400">
                          <span>{b.vendor_gstin || "No GSTIN"}</span>
                          {b.gstValid ? (
                            <span className="text-emerald-600 font-bold">✓ {b.gstState}</span>
                          ) : (
                            <span className="text-rose-500 font-bold">✕ Invalid</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={currentLedger}
                          onChange={(e) => handleLedgerChange(b.id, e.target.value)}
                          className={`border rounded px-2.5 py-1 text-xs font-semibold focus:outline-none transition ${
                            b.status === "approved"
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                              : "bg-slate-50 border-slate-200 text-slate-800"
                          }`}
                        >
                          {DEFAULT_PURCHASE_LEDGERS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-slate-900">
                        ₹{Number(b.taxable_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-slate-600">
                        ₹{gstTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-emerald-600 font-bold">
                        ₹{Number(b.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {b.status === "needs_review" && (
                          <button
                            onClick={() => handleApprove(b.id)}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-semibold text-[11px] shadow-sm transition"
                          >
                            Approve
                          </button>
                        )}
                        {b.status === "approved" && (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              Approved
                            </span>
                            <button
                              onClick={() => handlePushSingle(b)}
                              className="p-1 bg-slate-900 hover:bg-slate-800 text-white rounded shadow-sm transition"
                              title="Push to Tally Prime"
                            >
                              <Send className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {b.status === "pushed" && (
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Synced
                          </span>
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
