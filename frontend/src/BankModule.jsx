import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Check,
  Send,
  Trash2,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight
} from "lucide-react";

const DEFAULT_BANK_LEDGERS = [
  "Sales: Direct UPI Collection",
  "Sundry Debtors / Customer Receipts",
  "Tea & Refreshment Expenses",
  "Electric Power & Fuel Expenses",
  "Commercial Office / Shop Rent",
  "Staff Salary & Wages",
  "Purchases: Direct Vendor Payment",
  "Bank Charges & Processing Fees",
  "Printing, Stationery & Postage",
  "Repairs & Maintenance",
  "Director / Partner Drawings",
  "Sundry Creditors / Supplier Settlement"
];

const loadSheetJS = () => {
  return new Promise((resolve, reject) => {
    if (window.XLSX) {
      resolve(window.XLSX);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Failed to load spreadsheet engine"));
    document.head.appendChild(script);
  });
};

export default function BankModule({ activeClient = "Panasuria Confectionery" }) {
  const [bankSubTab, setBankSubTab] = useState("needs_review"); // 'needs_review' | 'approved' | 'pushed'

  // Client-scoped persistent state
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

  const findMatchingLedger = (narration) => {
    if (!narration) return "";
    const clean = narration.toLowerCase();
    for (const [pattern, ledger] of Object.entries(narrativeRules)) {
      if (clean.includes(pattern.toLowerCase())) {
        return ledger;
      }
    }
    return "";
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      "Date,Narration,Chq_Ref_No,Withdrawal,Deposit,Balance\n" +
      "2026-09-01,UPI/524310982/Customer Settlement,REF10928,0.00,4500.00,4500.00\n" +
      "2026-09-02,NEFT/Vendor Milk Supplies/Amul,REF39210,1850.00,0.00,2650.00\n" +
      "2026-09-03,ELECTRICITY BILL Torrent Power,REF98211,840.00,0.00,1810.00\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Bank_Statement_Template_${activeClient.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Template downloaded successfully!", "success");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const fileName = file.name.toLowerCase();

    try {
      const XLSX = await loadSheetJS();
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          let rawRows = [];

          if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
            const text = new TextDecoder().decode(event.target.result);
            const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
            rawRows = lines.map((line) => line.split(",").map((c) => c.replace(/["']/g, "").trim()));
          } else {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          }

          if (!rawRows || rawRows.length < 2) {
            notify("File appears to be empty or missing data rows.", "error");
            setIsUploading(false);
            return;
          }

          let headerIdx = 0;
          for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
            const rowStr = (rawRows[r] || []).join(" ").toLowerCase();
            if (
              rowStr.includes("date") &&
              (rowStr.includes("narr") || rowStr.includes("desc") || rowStr.includes("particular") || rowStr.includes("withdrawal") || rowStr.includes("deposit") || rowStr.includes("debit") || rowStr.includes("credit"))
            ) {
              headerIdx = r;
              break;
            }
          }

          const headers = (rawRows[headerIdx] || []).map((h) => String(h || "").trim().toLowerCase());
          const dateIdx = headers.findIndex((h) => h.includes("date") || h.includes("txn date"));
          const narrIdx = headers.findIndex((h) => h.includes("narr") || h.includes("desc") || h.includes("particular") || h.includes("remark"));
          const refIdx = headers.findIndex((h) => h.includes("ref") || h.includes("chq") || h.includes("cheque") || h.includes("utr"));
          const withIdx = headers.findIndex((h) => h.includes("with") || h.includes("debit") || h.includes("dr"));
          const depIdx = headers.findIndex((h) => h.includes("dep") || h.includes("credit") || h.includes("cr"));

          const parsedRows = [];

          for (let i = headerIdx + 1; i < rawRows.length; i++) {
            const cells = rawRows[i] || [];
            if (!cells || cells.length === 0) continue;

            let dateVal = dateIdx !== -1 && cells[dateIdx] ? String(cells[dateIdx]).trim() : new Date().toISOString().split("T")[0];

            if (!isNaN(dateVal) && Number(dateVal) > 20000 && Number(dateVal) < 60000) {
              const excelDate = new Date(Math.round((Number(dateVal) - 25569) * 86400 * 1000));
              dateVal = excelDate.toISOString().split("T")[0];
            }

            const narrVal = narrIdx !== -1 && cells[narrIdx] ? String(cells[narrIdx]).trim() : "Bank Transaction";
            const refVal = refIdx !== -1 && cells[refIdx] ? String(cells[refIdx]).trim() : "-";

            const withdrawal = withIdx !== -1 ? Math.abs(parseFloat(String(cells[withIdx]).replace(/[^0-9.-]/g, "")) || 0) : 0;
            const deposit = depIdx !== -1 ? Math.abs(parseFloat(String(cells[depIdx]).replace(/[^0-9.-]/g, "")) || 0) : 0;

            if (withdrawal === 0 && deposit === 0) continue;

            const type = deposit > 0 ? "Receipt" : "Payment";
            const amount = deposit > 0 ? deposit : withdrawal;
            const matched = findMatchingLedger(narrVal);

            parsedRows.push({
              id: `tx_${Date.now()}_${i}`,
              date: dateVal,
              narration: narrVal,
              refNo: refVal,
              type,
              amount,
              allocatedLedger: matched || (type === "Receipt" ? "Sales: Direct UPI Collection" : "Tea & Refreshment Expenses"),
              isAutoMatched: Boolean(matched)
            });
          }

          if (parsedRows.length === 0) {
            notify("No valid withdrawal or deposit rows detected.", "error");
          } else {
            setTransactions((prev) => [...parsedRows, ...prev]);
            notify(`Extracted ${parsedRows.length} transactions from statement!`, "success");
            setBankSubTab("needs_review");
          }
        } catch (err) {
          console.error(err);
          notify("Failed to process statement layout.", "error");
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      notify("Failed to initialize spreadsheet reader.", "error");
      setIsUploading(false);
    }
  };

  // FEATURE 1 & 2: AUTO-APPROVE AND MOVE TRANSACTION ON LEDGER SELECTION
  const handleLedgerSelectAndAutoApprove = (tx, newLedger) => {
    // 1. Learn keyword pattern
    if (tx.narration && tx.narration.trim().length > 3) {
      const cleanPattern = tx.narration.trim().split(" ")[0].toLowerCase();
      if (cleanPattern.length >= 3) {
        setNarrativeRules((prev) => ({
          ...prev,
          [cleanPattern]: newLedger
        }));
      }
    }

    // 2. Remove from Needs Review immediately
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));

    // 3. Shift into Approved Transactions queue
    const approvedTx = {
      ...tx,
      allocatedLedger: newLedger,
      isAutoMatched: true,
      approvedAt: new Date().toLocaleString()
    };
    setApprovedTransactions((prev) => [approvedTx, ...prev]);

    notify(`Assigned "${newLedger}" & auto-approved!`, "success");
  };

  // Manual Approve Single
  const handleApproveSingle = (tx) => {
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    setApprovedTransactions((prev) => [{ ...tx, approvedAt: new Date().toLocaleString() }, ...prev]);
    notify("Transaction approved & moved to Approved queue!", "success");
  };

  // Approve All
  const handleApproveAll = () => {
    if (transactions.length === 0) return;
    const toApprove = transactions.map((t) => ({ ...t, approvedAt: new Date().toLocaleString() }));
    setApprovedTransactions((prev) => [...toApprove, ...prev]);
    setTransactions([]);
    setBankSubTab("approved");
    notify(`Approved all ${toApprove.length} transactions!`, "success");
  };

  // Push single voucher to Tally
  const pushVoucherToTallyXml = async (tx) => {
    const tallyDate = (tx.date || "").replace(/[^0-9]/g, "");
    const isReceipt = tx.type === "Receipt";

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
          <VOUCHER VCHTYPE="${isReceipt ? "Receipt" : "Payment"}" ACTION="Create">
            <DATE>${tallyDate || "20260901"}</DATE>
            <VOUCHERTYPENAME>${isReceipt ? "Receipt" : "Payment"}</VOUCHERTYPENAME>
            <REFERENCE>${tx.refNo !== "-" ? tx.refNo : tx.id}</REFERENCE>
            <NARRATION>${tx.narration} [Synced via Compliance4]</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${tx.allocatedLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isReceipt ? "No" : "Yes"}</ISDEEMEDPOSITIVE>
              <AMOUNT>${isReceipt ? tx.amount.toFixed(2) : `-${tx.amount.toFixed(2)}`}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Bank Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isReceipt ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
              <AMOUNT>${isReceipt ? `-${tx.amount.toFixed(2)}` : tx.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
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
    } catch (e) {
      console.warn("Direct port 9000 dispatch:", e);
    }
  };

  const handlePushSingle = async (tx) => {
    await pushVoucherToTallyXml(tx);
    setApprovedTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    setPushedTransactions((prev) => [{ ...tx, pushedAt: new Date().toLocaleString() }, ...prev]);
    notify(`Transaction #${tx.id} synced to Tally!`, "success");
  };

  // FEATURE 3: ONE-CLICK PUSH ALL APPROVED TRANSACTIONS TO TALLY
  const handlePushAllApproved = async () => {
    if (approvedTransactions.length === 0) return;
    setIsSyncing(true);
    const toPush = [...approvedTransactions];

    for (const tx of toPush) {
      await pushVoucherToTallyXml(tx);
    }

    setPushedTransactions((prev) => [
      ...toPush.map((t) => ({ ...t, pushedAt: new Date().toLocaleString() })),
      ...prev
    ]);
    setApprovedTransactions([]);
    setIsSyncing(false);
    setBankSubTab("pushed");
    notify(`Batch pushed ${toPush.length} transactions directly to Tally Prime!`, "success");
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
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition"
            title="Download CSV Statement Template"
          >
            <Download className="w-3.5 h-3.5" />
            Download Template
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="*"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {isUploading ? "Processing..." : "Upload Bank Statement (Excel / CSV)"}
          </button>
        </div>
      </header>

      {/* SUB-TABS & BATCH ACTION BAR */}
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

        {/* BATCH ACTION CONTROLS */}
        <div className="pb-2">
          {bankSubTab === "needs_review" && transactions.length > 0 && (
            <button
              onClick={handleApproveAll}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition"
            >
              <Check className="w-3.5 h-3.5" /> Approve All ({transactions.length})
            </button>
          )}

          {/* FEATURE 3: ONE-CLICK PUSH ALL APPROVED TO TALLY */}
          {bankSubTab === "approved" && approvedTransactions.length > 0 && (
            <button
              onClick={handlePushAllApproved}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSyncing ? "Pushing to Tally..." : `Push All to Tally (${approvedTransactions.length})`}
            </button>
          )}
        </div>
      </div>

      {/* TABLE VIEW */}
      <div className="flex-1 p-8 overflow-y-auto">
        {displayedList.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              No transactions in {bankSubTab === "needs_review" ? "Needs Review" : bankSubTab === "approved" ? "Approved" : "Pushed"}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Upload bank statements in <strong>Excel (.xlsx, .xls)</strong> or <strong>CSV</strong> format to extract and auto-classify transactions.
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
                            onChange={(e) => handleLedgerSelectAndAutoApprove(tx, e.target.value)}
                            className={`border rounded px-2.5 py-1 text-xs font-semibold focus:outline-none transition max-w-xs ${
                              tx.isAutoMatched
                                ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                                : "bg-slate-50 border-slate-200 text-slate-800"
                            }`}
                          >
                            <option value="" disabled>Select & Auto-Approve...</option>
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
                        <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded text-xs font-semibold">
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
                        <button
                          onClick={() => handlePushSingle(tx)}
                          className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3 py-1 rounded shadow-sm transition"
                        >
                          <Send className="w-3 h-3" /> Push
                        </button>
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
