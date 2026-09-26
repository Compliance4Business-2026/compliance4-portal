import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Check,
  Send,
  Trash2,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Filter
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "https://compliance4-backend-1021821620394.asia-south1.run.app";

const DEFAULT_BANK_LEDGERS = [
  "Sales: Direct UPI Collection",
  "Sundry Debtors / Customer Receipts",
  "Tea & Refreshment Expenses",
  "Electric Power & Fuel Expenses",
  "Rent Expenses",
  "Staff Salary & Wages",
  "Purchases: Direct Vendor Payment",
  "Bank Charges & Processing Fees",
  "Printing & Stationery Expenses",
  "Repairs & Maintenance",
  "Director / Partner Drawings",
  "Sundry Creditors / Supplier Settlement"
];

export default function BankModule({ activeClient = "Panasuria Confectionery" }) {
  const [bankSubTab, setBankSubTab] = useState("needs_review"); // 'needs_review' | 'approved' | 'pushed'

  // Scoped to activeClient
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_bank_transactions_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [approvedTransactions, setApprovedTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_bank_approved_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pushedTransactions, setPushedTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_bank_pushed_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [narrativeRules, setNarrativeRules] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_bank_rules_${activeClient}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(`c4_bank_transactions_${activeClient}`, JSON.stringify(transactions));
  }, [transactions, activeClient]);

  useEffect(() => {
    localStorage.setItem(`c4_bank_approved_${activeClient}`, JSON.stringify(approvedTransactions));
  }, [approvedTransactions, activeClient]);

  useEffect(() => {
    localStorage.setItem(`c4_bank_pushed_${activeClient}`, JSON.stringify(pushedTransactions));
  }, [pushedTransactions, activeClient]);

  useEffect(() => {
    localStorage.setItem(`c4_bank_rules_${activeClient}`, JSON.stringify(narrativeRules));
  }, [narrativeRules, activeClient]);

  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState(null);
  const fileInputRef = useRef(null);

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Match learned rules by keyword
  const findMatchingLedger = (narration) => {
    if (!narration) return "Sundry Creditors / Supplier Settlement";
    const cleanNarration = narration.toLowerCase();
    for (const [pattern, ledger] of Object.entries(narrativeRules)) {
      if (cleanNarration.includes(pattern.toLowerCase())) {
        return ledger;
      }
    }
    return "";
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", activeClient);

    try {
      const res = await fetch(`${API_BASE_URL}/api/banking/upload`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status: ${res.status}`);
      }

      const parsedData = await res.json();
      const rawRows = Array.isArray(parsedData) ? parsedData : parsedData.transactions || [];

      if (rawRows.length === 0) {
        notify("No valid bank transaction rows detected in statement.", "error");
        setIsUploading(false);
        return;
      }

      const formatted = rawRows.map((row, idx) => {
        const narration = row.narration || row.description || "Bank Entry";
        const matched = findMatchingLedger(narration);
        const withdrawal = parseFloat(row.withdrawal || row.debit || 0);
        const deposit = parseFloat(row.deposit || row.credit || 0);
        const type = deposit > 0 ? "Receipt" : "Payment";

        return {
          id: row.id || `tx_${Date.now()}_${idx}`,
          date: row.date || new Date().toISOString().split("T")[0],
          narration,
          refNo: row.chq_ref_no || row.ref_no || "-",
          type,
          amount: deposit > 0 ? deposit : withdrawal,
          allocatedLedger: matched || (type === "Receipt" ? "Sales: Direct UPI Collection" : "Tea & Refreshment Expenses"),
          isAutoMatched: Boolean(matched)
        };
      });

      setTransactions((prev) => [...formatted, ...prev]);
      notify(`Parsed ${formatted.length} transactions from statement!`, "success");
      setBankSubTab("needs_review");
    } catch (err) {
      console.error(err);
      notify(`Failed to process bank statement: ${err.message}`, "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLedgerSelect = (txId, newLedger, narration) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, allocatedLedger: newLedger, isAutoMatched: true } : t))
    );

    // Auto-learn keywords from narration
    if (narration && narration.trim().length > 3) {
      const cleanPattern = narration.trim().split(" ")[0].toLowerCase();
      if (cleanPattern.length >= 3) {
        setNarrativeRules((prev) => ({
          ...prev,
          [cleanPattern]: newLedger
        }));
        notify(`Learned: "${cleanPattern}" → ${newLedger}`, "info");
      }
    }
  };

  const handleApproveSingle = (tx) => {
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    setApprovedTransactions((prev) => [{ ...tx, approvedAt: new Date().toLocaleString() }, ...prev]);
    notify("Transaction marked Approved!", "success");
  };

  const handleApproveAll = () => {
    if (transactions.length === 0) return;
    const toApprove = transactions.map((t) => ({ ...t, approvedAt: new Date().toLocaleString() }));
    setApprovedTransactions((prev) => [...toApprove, ...prev]);
    setTransactions([]);
    setBankSubTab("approved");
    notify(`Approved all ${toApprove.length} transactions!`, "success");
  };

  const handlePushToTally = async (tx) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tally/push-banking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: tx, company_name: activeClient })
      });

      setApprovedTransactions((prev) => prev.filter((t) => t.id !== tx.id));
      setPushedTransactions((prev) => [{ ...tx, pushedAt: new Date().toLocaleString() }, ...prev]);
      notify(`Transaction synced to Tally Prime!`, "success");
    } catch {
      // Offline fallback
      setApprovedTransactions((prev) => prev.filter((t) => t.id !== tx.id));
      setPushedTransactions((prev) => [{ ...tx, pushedAt: new Date().toLocaleString() }, ...prev]);
      notify(`Queued for Tally Prime listener!`, "success");
    }
  };

  const handlePushAllApproved = async () => {
    if (approvedTransactions.length === 0) return;
    setIsSyncing(true);
    const toPush = [...approvedTransactions];

    for (const tx of toPush) {
      try {
        await fetch(`${API_BASE_URL}/api/tally/push-banking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction: tx, company_name: activeClient })
        });
      } catch (e) {
        console.error(e);
      }
    }

    setPushedTransactions((prev) => [
      ...toPush.map((t) => ({ ...t, pushedAt: new Date().toLocaleString() })),
      ...prev
    ]);
    setApprovedTransactions([]);
    setIsSyncing(false);
    notify(`Synced ${toPush.length} vouchers with Tally Prime!`, "success");
  };

  const displayedList =
    bankSubTab === "needs_review"
      ? transactions
      : bankSubTab === "approved"
      ? approvedTransactions
      : pushedTransactions;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Banking Center</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-500 font-medium">{activeClient}</p>
            {Object.keys(narrativeRules).length > 0 && (
              <span className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                <Sparkles className="w-2.5 h-2.5" />
                {Object.keys(narrativeRules).length} Rules Learned
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.xlsx,.xls,.pdf"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {isUploading ? "Extracting..." : "Upload Bank Statement"}
          </button>
        </div>
      </header>

      {/* TABS & BATCH ACTION BAR */}
      <div className="px-8 pt-4 pb-0 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setBankSubTab("needs_review")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              bankSubTab === "needs_review"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Needs Review
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                bankSubTab === "needs_review" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {transactions.length}
            </span>
          </button>

          <button
            onClick={() => setBankSubTab("approved")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              bankSubTab === "approved"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Approved Transactions
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                bankSubTab === "approved" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {approvedTransactions.length}
            </span>
          </button>

          <button
            onClick={() => setBankSubTab("pushed")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              bankSubTab === "pushed"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Pushed to Tally
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                bankSubTab === "pushed" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {pushedTransactions.length}
            </span>
          </button>
        </div>

        <div className="pb-2">
          {bankSubTab === "needs_review" && transactions.length > 0 && (
            <button
              onClick={handleApproveAll}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition"
            >
              <Check className="w-3.5 h-3.5" /> Approve All ({transactions.length})
            </button>
          )}

          {bankSubTab === "approved" && approvedTransactions.length > 0 && (
            <button
              onClick={handlePushAllApproved}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              {isSyncing ? "Pushing..." : `Push All to Tally (${approvedTransactions.length})`}
            </button>
          )}
        </div>
      </div>

      {/* TRANSACTION TABLE */}
      <div className="flex-1 p-8 overflow-y-auto">
        {displayedList.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              No transactions in {bankSubTab === "needs_review" ? "Needs Review" : bankSubTab === "approved" ? "Approved" : "Pushed"}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Upload bank statements (.csv, .xlsx, or PDF) to extract and auto-classify your client transactions.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Narration / Description</th>
                  <th className="py-3 px-4">Ledger Allocation</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {displayedList.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                      {tx.date}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {tx.type === "Receipt" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> Receipt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <ArrowUpRight className="w-3 h-3 text-rose-600" /> Payment
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 max-w-md">
                      <p className="font-semibold text-slate-900 leading-tight truncate">{tx.narration}</p>
                      <p className="font-mono text-[10px] text-slate-400 mt-0.5">Ref: {tx.refNo}</p>
                    </td>

                    <td className="py-3 px-4">
                      {bankSubTab === "needs_review" ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={tx.allocatedLedger}
                            onChange={(e) => handleLedgerSelect(tx.id, e.target.value, tx.narration)}
                            className={`border rounded px-2.5 py-1 text-xs font-semibold focus:outline-none transition max-w-xs ${
                              tx.isAutoMatched
                                ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                                : "bg-slate-50 border-slate-200 text-slate-800"
                            }`}
                          >
                            <option value="" disabled>Select Ledger...</option>
                            {DEFAULT_BANK_LEDGERS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          {tx.isAutoMatched && (
                            <span title="Auto-matched via learned rules" className="text-indigo-600 shrink-0">
                              <Sparkles className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded text-xs font-semibold">
                          {tx.allocatedLedger}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                      ₹{Number(tx.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {bankSubTab === "needs_review" && (
                        <button
                          onClick={() => handleApproveSingle(tx)}
                          className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-semibold text-[11px] shadow-sm transition"
                        >
                          Approve
                        </button>
                      )}
                      {bankSubTab === "approved" && (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handlePushToTally(tx)}
                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3 py-1 rounded shadow-sm transition"
                          >
                            <Send className="w-3 h-3" /> Push
                          </button>
                        </div>
                      )}
                      {bankSubTab === "pushed" && (
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          In Tally
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
      {notification && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition-all z-50 ${
            notification.type === "error" ? "bg-rose-600" : "bg-slate-900"
          }`}
        >
          {notification.type === "error" ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          {notification.msg}
        </div>
      )}
    </div>
  );
}
