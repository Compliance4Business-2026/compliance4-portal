import React, { useState, useRef, useEffect } from "react";
import { 
  CreditCard, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  Send, 
  Download, 
  FileCode 
} from "lucide-react";

const API_BASE_URL = 
  import.meta.env.VITE_BACKEND_URL || 
  "https://compliance4-backend-1021821620394.asia-south1.run.app";

const TALLY_BANK_LEDGERS = [
  "HDFC Bank - 8050",
  "HDFC Bank Current A/c",
  "ICICI Bank - 0926",
  "State Bank of India A/c",
  "Cash in Hand",
  "UPI Collection Account"
];

const SUGGESTED_BANK_MAPPINGS = [
  "UPI Collection",
  "UPI Cards and Receipts",
  "Cash in Hand",
  "Zomato Payout Clearance",
  "Swiggy Payout Clearance",
  "Electricity Expense Payable",
  "Staff Advance / Salary",
  "Rent Expenses",
  "Tea & Refreshment Expenses",
  "Bank Charges & Fees",
  "Telephone and Internet Exp",
  "Sundry Creditor Payment",
  "Interest Income"
];

export default function BankModule({ activeClient = "Panasuria Confectionery" }) {
  const [bankSubTab, setBankSubTab] = useState("needs_review");
  const [selectedBankLedger, setSelectedBankLedger] = useState("HDFC Bank - 8050");
  const [isUploadingBank, setIsUploadingBank] = useState(false);
  const [notification, setNotification] = useState(null);
  const bankInputRef = useRef(null);

  // Persistent Banking Store
  const [pendingBankTxns, setPendingBankTxns] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_pending_bank_txns");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [approvedBankTxns, setApprovedBankTxns] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_approved_bank_txns");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pushedBankTxns, setPushedBankTxns] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_pushed_bank_txns");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("c4_pending_bank_txns", JSON.stringify(pendingBankTxns));
  }, [pendingBankTxns]);

  useEffect(() => {
    localStorage.setItem("c4_approved_bank_txns", JSON.stringify(approvedBankTxns));
  }, [approvedBankTxns]);

  useEffect(() => {
    localStorage.setItem("c4_pushed_bank_txns", JSON.stringify(pushedBankTxns));
  }, [pushedBankTxns]);

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const handleBankStatementUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingBank(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", activeClient);
    formData.append("bank_ledger", selectedBankLedger);

    try {
      const res = await fetch(`${API_BASE_URL}/api/bank/reconcile-file`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Server returned status ${res.status}`);
      }

      const rawData = await res.json();
      const formattedTxns = rawData.map((t, idx) => {
        const isDebit = parseFloat(t.debit) > 0;
        const vType = t.voucher_type || (isDebit ? "Payment" : "Receipt");
        const defaultLedger = t.ledger || (t.narration?.toLowerCase().includes("cash") ? "Cash in Hand" : "UPI Collection");

        return {
          id: t.id || `bank_${Date.now()}_${idx}`,
          date: t.date || new Date().toISOString().split("T")[0],
          narration: t.narration || "Bank Transaction",
          voucher_type: vType,
          bank_ledger: selectedBankLedger,
          ledger: defaultLedger,
          debit: parseFloat(t.debit) || 0,
          credit: parseFloat(t.credit) || 0,
          amount: parseFloat(t.amount) || parseFloat(t.debit) || parseFloat(t.credit) || 0,
          isApproved: false // starts yellow (needs review)
        };
      });

      setPendingBankTxns(prev => [...formattedTxns, ...prev]);
      setBankSubTab("needs_review");
      notify(`Reconciled ${formattedTxns.length} transactions for ${selectedBankLedger}!`, "success");
    } catch (err) {
      console.error(err);
      notify(`Bank parsing failed: ${err.message}`, "error");
    } finally {
      setIsUploadingBank(false);
      if (bankInputRef.current) bankInputRef.current.value = "";
    }
  };

  const handleBankLedgerChange = (txnId, newLedger) => {
    setPendingBankTxns(prev => prev.map(t => {
      if (t.id === txnId) {
        return { ...t, ledger: newLedger, isApproved: true }; // Turns green
      }
      return t;
    }));
  };

  const handleBankVoucherTypeChange = (txnId, newType) => {
    setPendingBankTxns(prev => prev.map(t => {
      if (t.id === txnId) {
        return { ...t, voucher_type: newType, isApproved: true };
      }
      return t;
    }));
  };

  const handleBankActionClick = (txn) => {
    if (!txn.isApproved) {
      // First click: confirm AI matching (yellow -> green)
      setPendingBankTxns(prev => prev.map(t => t.id === txn.id ? { ...t, isApproved: true } : t));
    } else {
      // Second click on green: moves to Approved tab
      setPendingBankTxns(prev => prev.filter(t => t.id !== txn.id));
      setApprovedBankTxns(prev => [txn, ...prev.filter(t => t.id !== txn.id)]);
      notify(`Moved transaction to Approved tab!`, "success");
    }
  };

  const handlePushBankToTally = async (txn) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tally/push-bank-voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txn, company_name: activeClient }),
      });

      const data = await res.json();
      if (data.status === "success" || data.status === "dispatched") {
        notify(`Transaction pushed to Tally under ${txn.bank_ledger}!`, "success");
        setApprovedBankTxns(prev => prev.filter(t => t.id !== txn.id));
        setPushedBankTxns(prev => [{ ...txn, pushed_at: new Date().toLocaleString() }, ...prev]);
      } else {
        throw new Error(data.error || "Tally transmission failed");
      }
    } catch (err) {
      notify(`Push failed: ${err.message}`, "error");
    }
  };

  const handleDownloadBankExcel = () => {
    if (approvedBankTxns.length === 0) {
      notify("No approved bank transactions to export.", "error");
      return;
    }

    const headers = ["Date", "Bank Ledger", "Voucher Type", "Narration", "Accounted Ledger", "Debit (Withdrawal)", "Credit (Deposit)"];
    const rows = approvedBankTxns.map(t => [
      `"${t.date}"`,
      `"${t.bank_ledger}"`,
      `"${t.voucher_type}"`,
      `"${(t.narration || "").replace(/"/g, '""')}"`,
      `"${t.ledger}"`,
      t.debit || 0,
      t.credit || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Bank_Vouchers_${selectedBankLedger.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Exported Bank Transactions to CSV!", "success");
  };

  const handleDownloadBankXML = () => {
    if (approvedBankTxns.length === 0) {
      notify("No approved transactions to export.", "error");
      return;
    }

    const xmlVouchers = approvedBankTxns.map(t => {
      const vDate = (t.date || "").replace(/-/g, "");
      const amount = (t.debit > 0 ? t.debit : t.credit).toFixed(2);
      const isPayment = t.voucher_type === "Payment";

      return `
    <VOUCHER VCHTYPE="${t.voucher_type}" ACTION="Create">
      <DATE>${vDate}</DATE>
      <VOUCHERTYPENAME>${t.voucher_type}</VOUCHERTYPENAME>
      <NARRATION>${t.narration}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${t.bank_ledger}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${isPayment ? "No" : "Yes"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${isPayment ? amount : `-${amount}`}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${t.ledger}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${isPayment ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${isPayment ? `-${amount}` : amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
    }).join("");

    const fullXML = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${activeClient}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">${xmlVouchers}</TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const blob = new Blob([fullXML], { type: "text/xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Bank_Tally_Import_${selectedBankLedger.replace(/\s+/g, "_")}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Downloaded Tally-compliant Bank XML file!", "success");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* HEADER WITH BANK SELECTOR */}
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Banking Reconciliation</h2>
            <p className="text-xs text-slate-500">{activeClient}</p>
          </div>

          <div className="flex items-center gap-2 ml-6 pl-6 border-l border-slate-200">
            <label className="text-xs font-bold text-slate-600">Target Bank Ledger:</label>
            <select
              value={selectedBankLedger}
              onChange={(e) => setSelectedBankLedger(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 font-semibold text-slate-800 rounded-lg px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
            >
              {TALLY_BANK_LEDGERS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {bankSubTab === "approved" && approvedBankTxns.length > 0 && (
            <>
              <button
                onClick={handleDownloadBankExcel}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition"
              >
                <Download className="w-3.5 h-3.5" /> Export Excel
              </button>
              <button
                onClick={handleDownloadBankXML}
                className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-lg transition border border-blue-200"
              >
                <FileCode className="w-3.5 h-3.5" /> Download Tally XML
              </button>
            </>
          )}

          <input
            type="file"
            ref={bankInputRef}
            onChange={handleBankStatementUpload}
            accept=".xlsx,.xls,.csv,.pdf"
            className="hidden"
          />
          <button
            disabled={isUploadingBank}
            onClick={() => bankInputRef.current?.click()}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {isUploadingBank ? "Reconciling Statement..." : "Upload Bank Statement"}
          </button>
        </div>
      </header>

      {/* 3 SUB TABS */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
          <button
            onClick={() => setBankSubTab("needs_review")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
              bankSubTab === "needs_review"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Needs Review
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              bankSubTab === "needs_review" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"
            }`}>
              {pendingBankTxns.length}
            </span>
          </button>

          <button
            onClick={() => setBankSubTab("approved")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
              bankSubTab === "approved"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Approved Transactions
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              bankSubTab === "approved" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
            }`}>
              {approvedBankTxns.length}
            </span>
          </button>

          <button
            onClick={() => setBankSubTab("pushed")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
              bankSubTab === "pushed"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Pushed to Tally
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              bankSubTab === "pushed" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
            }`}>
              {pushedBankTxns.length}
            </span>
          </button>
        </div>

        {/* TAB 1: NEEDS REVIEW */}
        {bankSubTab === "needs_review" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {pendingBankTxns.length === 0 ? (
              <div className="p-16 text-center">
                <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No bank transactions pending review</p>
                <p className="text-xs text-slate-400 mt-0.5">Select a target bank ledger and click "Upload Bank Statement" to auto-match ledgers</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Bank Account</th>
                    <th className="px-5 py-3.5">Description (Narration)</th>
                    <th className="px-5 py-3.5 w-32">Type</th>
                    <th className="px-5 py-3.5 w-56">Accounted Ledger</th>
                    <th className="px-5 py-3.5 text-right">Debit (₹)</th>
                    <th className="px-5 py-3.5 text-right">Credit (₹)</th>
                    <th className="px-5 py-3.5 text-center w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingBankTxns.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5 font-mono text-slate-600 whitespace-nowrap">{t.date}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-800 whitespace-nowrap">{t.bank_ledger}</td>
                      <td className="px-5 py-3.5 max-w-sm truncate font-medium text-slate-900" title={t.narration}>
                        {t.narration}
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={t.voucher_type}
                          onChange={(e) => handleBankVoucherTypeChange(t.id, e.target.value)}
                          className="text-xs bg-slate-50 border border-slate-300 rounded p-1 font-semibold text-slate-700"
                        >
                          <option value="Payment">Payment</option>
                          <option value="Receipt">Receipt</option>
                          <option value="Contra">Contra</option>
                        </select>
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={t.ledger}
                          onChange={(e) => handleBankLedgerChange(t.id, e.target.value)}
                          className="w-full text-xs bg-white border border-slate-300 rounded p-1 font-medium text-slate-800 focus:ring-1 focus:ring-slate-900"
                        >
                          {SUGGESTED_BANK_MAPPINGS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-800">
                        {t.debit > 0 ? `₹${t.debit.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-700">
                        {t.credit > 0 ? `₹${t.credit.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleBankActionClick(t)}
                          className={`inline-flex items-center justify-center gap-1 w-24 py-1.5 rounded text-[11px] font-bold shadow-sm transition ${
                            t.isApproved
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-amber-400 hover:bg-amber-500 text-amber-950"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {t.isApproved ? "Approved" : "Approve"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: APPROVED TRANSACTIONS */}
        {bankSubTab === "approved" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {approvedBankTxns.length === 0 ? (
              <div className="p-16 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No approved transactions waiting</p>
                <p className="text-xs text-slate-400 mt-0.5">Approve verified items in "Needs Review" to sync with Tally</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Bank Account</th>
                    <th className="px-5 py-3.5">Narration</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Mapped Ledger</th>
                    <th className="px-5 py-3.5 text-right">Amount (₹)</th>
                    <th className="px-5 py-3.5 text-right">Tally Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {approvedBankTxns.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5 font-mono text-slate-600">{t.date}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-800">{t.bank_ledger}</td>
                      <td className="px-5 py-3.5 max-w-sm truncate text-slate-900 font-medium">{t.narration}</td>
                      <td className="px-5 py-3.5">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700">
                          {t.voucher_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{t.ledger}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                        ₹{(t.debit > 0 ? t.debit : t.credit).toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setApprovedBankTxns(prev => prev.filter(x => x.id !== t.id));
                              setPendingBankTxns(prev => [{ ...t, isApproved: false }, ...prev]);
                            }}
                            className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2 py-1 rounded"
                          >
                            Re-Edit
                          </button>
                          <button
                            onClick={() => handlePushBankToTally(t)}
                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3 py-1 rounded shadow-sm"
                          >
                            <Send className="w-3 h-3" /> Push
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: PUSHED TO TALLY */}
        {bankSubTab === "pushed" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {pushedBankTxns.length === 0 ? (
              <div className="p-16 text-center">
                <CreditCard className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No bank transactions pushed yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Transactions synchronized with Tally Prime will appear here</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Bank Account</th>
                    <th className="px-5 py-3.5">Narration</th>
                    <th className="px-5 py-3.5">Mapped Ledger</th>
                    <th className="px-5 py-3.5 text-right">Amount (₹)</th>
                    <th className="px-5 py-3.5 text-right">Sync Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pushedBankTxns.map((t, idx) => (
                    <tr key={t.id || idx} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5 font-mono text-slate-600">{t.date}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-800">{t.bank_ledger}</td>
                      <td className="px-5 py-3.5 max-w-sm truncate text-slate-900">{t.narration}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-700">{t.ledger}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">
                        ₹{(t.debit > 0 ? t.debit : t.credit).toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <Check className="w-3 h-3" /> In Tally
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {notification && (
        <div
          className={`fixed bottom-6 right-6 max-w-md px-4 py-3 rounded-lg shadow-xl border text-sm flex items-start gap-3 transition-all z-50 ${
            notification.type === "error"
              ? "bg-rose-950 text-rose-100 border-rose-800"
              : "bg-slate-900 text-white border-slate-800"
          }`}
        >
          {notification.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-mono text-xs break-all leading-relaxed">
            {notification.msg}
          </div>
        </div>
      )}
    </div>
  );
}
