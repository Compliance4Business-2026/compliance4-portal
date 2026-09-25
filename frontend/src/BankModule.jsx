import React, { useState, useEffect } from "react";
import { 
  Upload, 
  CheckCircle, 
  Send, 
  FileSpreadsheet, 
  AlertCircle, 
  Download,
  Trash2
} from "lucide-react";

// Adapts dynamically: uses VITE_API_URL if configured, otherwise uses relative path
const getBaseUrl = () => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  }
  return "";
};

export default function BankModule({ activeClient = "Panasuria Confectionery" }) {
  const [bankLedger, setBankLedger] = useState("HDFC Bank - 8050");
  
  // Persistent storage across page reloads
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_bank_transactions");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState("needs_review"); // 'needs_review' | 'approved' | 'pushed'
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    localStorage.setItem("c4_bank_transactions", JSON.stringify(transactions));
  }, [transactions]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Download Standard 4-Column Template
  const downloadTemplate = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Date,Narration,Debit,Credit\n" +
      "01/09/2026,NEFT CR-DEUT0797BGL-INTERNAL AC,0,545.48\n" +
      "01/09/2026,UPI-AUTOPAY-SMFG INDIA CREDIT,410,0\n" +
      "03/09/2026,CASH DEPOSIT CHARGES,63.85,0\n" +
      "03/09/2026,NEFT CR-ICIC0099999-BLINK COMMERCE,0,1066.45\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Bank_Statement_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Upload and Parse Statement File
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", activeClient);
    formData.append("bank_ledger", bankLedger);

    const baseUrl = getBaseUrl();
    const endpoint = baseUrl ? `${baseUrl}/api/bank/reconcile-file` : "/api/bank/reconcile-file";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      const initialized = data.map((t) => ({
        ...t,
        status: "needs_review",
      }));

      setTransactions(initialized);
      setActiveTab("needs_review");
      showToast(`Successfully imported ${initialized.length} transactions!`);
    } catch (err) {
      showToast(`Bank parsing failed: ${err.message}`, "error");
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  // 3. Status Action Handlers
  const handleApprove = (id) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "approved" } : t))
    );
  };

  const handleApproveAll = () => {
    setTransactions((prev) =>
      prev.map((t) => (t.status === "needs_review" ? { ...t, status: "approved" } : t))
    );
    showToast("All pending transactions moved to Approved!");
  };

  const handlePushSingle = async (txn) => {
    const baseUrl = getBaseUrl();
    const endpoint = baseUrl ? `${baseUrl}/api/tally/push-bank-voucher` : "/api/tally/push-bank-voucher";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txn, company_name: activeClient }),
      });
      if (!res.ok) throw new Error("Failed to dispatch to Tally");

      setTransactions((prev) =>
        prev.map((t) => (t.id === txn.id ? { ...t, status: "pushed" } : t))
      );
      showToast(`Voucher pushed to Tally for ${txn.voucher_type}!`);
    } catch (err) {
      showToast(`Tally push error: ${err.message}`, "error");
    }
  };

  const handlePushAllApproved = async () => {
    const approvedList = transactions.filter((t) => t.status === "approved");
    if (approvedList.length === 0) return;

    setSyncing(true);
    let successCount = 0;
    const baseUrl = getBaseUrl();
    const endpoint = baseUrl ? `${baseUrl}/api/tally/push-bank-voucher` : "/api/tally/push-bank-voucher";

    for (const txn of approvedList) {
      try {
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txn, company_name: activeClient }),
        });
        successCount++;
      } catch (e) {
        console.error(e);
      }
    }

    setTransactions((prev) =>
      prev.map((t) => (t.status === "approved" ? { ...t, status: "pushed" } : t))
    );
    setSyncing(false);
    showToast(`Dispatched ${successCount} vouchers to Tally Prime!`);
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all loaded transactions?")) {
      setTransactions([]);
      localStorage.removeItem("c4_bank_transactions");
      showToast("Cleared transaction list.");
    }
  };

  // 4. Tab Counts & Filters
  const needsReviewCount = transactions.filter((t) => t.status === "needs_review").length;
  const approvedCount = transactions.filter((t) => t.status === "approved").length;
  const pushedCount = transactions.filter((t) => t.status === "pushed").length;

  const displayedTransactions = transactions.filter((t) => t.status === activeTab);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Banking Reconciliation</h2>
          <p className="text-xs text-slate-500 font-medium">{activeClient}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <span className="text-xs font-semibold text-slate-500">Target Bank Ledger:</span>
            <select
              value={bankLedger}
              onChange={(e) => setBankLedger(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="HDFC Bank - 8050">HDFC Bank - 8050</option>
              <option value="ICICI Bank - 0026">ICICI Bank - 0026</option>
              <option value="State Bank of India">State Bank of India</option>
            </select>
          </div>

          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Template
          </button>

          {transactions.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition"
              title="Reset statement"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </button>
          )}

          <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Parsing..." : "Upload Bank Statement"}
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </header>

      {/* NAVIGATION TABS & BULK ACTIONS */}
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
            Approved Transactions
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
          {activeTab === "needs_review" && needsReviewCount > 0 && (
            <button
              onClick={handleApproveAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-semibold shadow-sm transition"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Approve All ({needsReviewCount})
            </button>
          )}

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

      {/* TABLE SECTION */}
      <div className="flex-1 p-8 overflow-y-auto">
        {displayedTransactions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              No transactions in {activeTab === "needs_review" ? "Needs Review" : activeTab === "approved" ? "Approved" : "Pushed"}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {activeTab === "needs_review"
                ? "Upload an Excel or CSV statement to populate transactions."
                : activeTab === "approved"
                ? "Click 'Approve' on pending items to prepare them for Tally export."
                : "Transactions dispatched to Tally Prime appear here."}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Bank Account</th>
                  <th className="py-3 px-4">Description (Narration)</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Accounted Ledger</th>
                  <th className="py-3 px-4 text-right">Debit (₹)</th>
                  <th className="py-3 px-4 text-right">Credit (₹)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {displayedTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">{t.date}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">{t.bank_ledger}</td>
                    <td className="py-3 px-4 max-w-xs truncate" title={t.narration}>
                      {t.narration}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                          t.voucher_type === "Receipt"
                            ? "bg-emerald-100 text-emerald-800"
                            : t.voucher_type === "Payment"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {t.voucher_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <select
                        value={t.ledger}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTransactions((prev) =>
                            prev.map((item) => (item.id === t.id ? { ...item, ledger: val } : item))
                          );
                        }}
                        className="border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="UPI Collection">UPI Collection</option>
                        <option value="Cash in Hand">Cash in Hand</option>
                        <option value="Zomato Payout Clearance">Zomato Payout Clearance</option>
                        <option value="Swiggy Payout Clearance">Swiggy Payout Clearance</option>
                        <option value="Blinkit Payout Clearance">Blinkit Payout Clearance</option>
                        <option value="Electricity Expense Payable">Electricity Expense Payable</option>
                        <option value="Staff Advance / Salary">Staff Advance / Salary</option>
                        <option value="Rent Expenses">Rent Expenses</option>
                        <option value="Bank Charges & Fees">Bank Charges & Fees</option>
                        <option value="Interest Income">Interest Income</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-slate-900">
                      {t.debit > 0 ? `₹${t.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-emerald-600 font-semibold">
                      {t.credit > 0 ? `₹${t.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {t.status === "needs_review" && (
                        <button
                          onClick={() => handleApprove(t.id)}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-semibold text-[11px] shadow-sm transition"
                        >
                          Approve
                        </button>
                      )}
                      {t.status === "approved" && (
                        <button
                          onClick={() => handlePushSingle(t)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[11px] shadow-sm transition flex items-center gap-1 mx-auto"
                        >
                          <Send className="w-3 h-3" />
                          Push
                        </button>
                      )}
                      {t.status === "pushed" && (
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Synced
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
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
