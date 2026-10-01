import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Upload, 
  Download, 
  FileCode, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Check, 
  Send, 
  Trash2, 
  Sparkles, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Folder, 
  FolderOpen, 
  ChevronDown, 
  ChevronRight, 
  Edit2, 
  RotateCcw, 
  Search, 
  Building
} from "lucide-react";
import { api } from "./api";

const DEFAULT_BANK_LEDGERS = [
  "HDFC Bank - 8050",
  "ICICI Bank Current A/c",
  "SBI Operating Account",
  "Cash in Hand"
];

const DEFAULT_EXPENSE_FALLBACKS = [
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

// ROBUST POP-OUT SEARCHABLE TYPEAHEAD COMBOBOX WITH KEYBOARD NAVIGATION
function SearchableLedgerSelect({ value, onChange, coaList = [], fallbackOptions = [], placeholder = "Type to search ledger..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef(null);

  const allFlattenedLedgers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const list = [];

    if (coaList && coaList.length > 0) {
      coaList.forEach((l) => {
        const name = l.name || "";
        const cat = l.category || "General Accounts";
        if (!term || name.toLowerCase().includes(term) || cat.toLowerCase().includes(term)) {
          list.push({ ...l, groupName: cat });
        }
      });
    }

    if (list.length === 0) {
      const defaultGroup = "Standard Accounts";
      fallbackOptions
        .filter((name) => !term || name.toLowerCase().includes(term))
        .forEach((name) => {
          list.push({ id: name, name, category: defaultGroup, groupName: defaultGroup });
        });
    }

    return list;
  }, [coaList, fallbackOptions, searchTerm]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < allFlattenedLedgers.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allFlattenedLedgers[highlightedIndex]) {
        onChange(allFlattenedLedgers[highlightedIndex].name);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={isOpen ? searchTerm : (value || "")}
          onFocus={() => {
            setSearchTerm("");
            setIsOpen(true);
          }}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full text-xs font-semibold border border-slate-300 rounded p-1.5 bg-white text-slate-800 pr-7 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
        />
        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
      </div>

      {isOpen && (
        <div 
          className="absolute left-0 top-full mt-1 w-[320px] max-h-64 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-y-auto z-[999] divide-y divide-slate-100"
          style={{ minWidth: "100%" }}
        >
          {allFlattenedLedgers.length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center italic">
              No matching ledger in Client COA
            </div>
          ) : (
            allFlattenedLedgers.map((l, idx) => (
              <button
                key={l.id || l.name + idx}
                type="button"
                onClick={() => {
                  onChange(l.name);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between ${
                  highlightedIndex === idx ? "bg-indigo-100 text-indigo-900 font-bold" : (value === l.name ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-800 font-medium hover:bg-slate-100")
                }`}
              >
                <span className="truncate pr-2">{l.name}</span>
                <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                  {l.statementType === "Balance Sheet" ? "B/S" : (l.cogsClassification === "COGS" ? "COGS" : "P&L")}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function BankModule({ activeClient = "Pansuria Confectionery & Food" }) {
  const [bankSubTab, setBankSubTab] = useState("needs_review");

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

  // Client-Scoped Dynamic Chart of Accounts
  const [clientCoa, setClientCoa] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_coa_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Extract Bank / Cash Ledgers from COA for the dropdown selector
  const availableBankLedgers = useMemo(() => {
    if (clientCoa && clientCoa.length > 0) {
      const banks = clientCoa.filter((l) => {
        const cat = (l.category || "").toLowerCase();
        const sub = (l.subCategory || "").toLowerCase();
        const name = (l.name || "").toLowerCase();
        const stmt = (l.statementType || "").toLowerCase();
        
        return (
          stmt === "balance sheet" &&
          (cat.includes("bank") || cat.includes("cash") || sub.includes("bank") || sub.includes("cash") || name.includes("bank") || name.includes("hdfc") || name.includes("sbi") || name.includes("icici"))
        );
      }).map((l) => l.name);

      if (banks.length > 0) return banks;
    }
    return DEFAULT_BANK_LEDGERS;
  }, [clientCoa]);

  const [selectedBankLedger, setSelectedBankLedger] = useState(() => availableBankLedgers[0] || "HDFC Bank - 8050");

  useEffect(() => {
    if (availableBankLedgers.length > 0 && !availableBankLedgers.includes(selectedBankLedger)) {
      setSelectedBankLedger(availableBankLedgers[0]);
    }
  }, [availableBankLedgers]);

  // LIVE BANK BALANCE CALCULATION FOR SELECTED BANK
  const currentBankBalance = useMemo(() => {
    let balance = 0;
    const allBankTxns = [...transactions, ...approvedTransactions, ...pushedTransactions].filter(
      (t) => (t.bankLedger || selectedBankLedger) === selectedBankLedger
    );

    allBankTxns.forEach((tx) => {
      const amt = parseFloat(tx.amount) || 0;
      if (tx.type === "Receipt") {
        balance += amt;
      } else {
        balance -= amt;
      }
    });
    return balance;
  }, [transactions, approvedTransactions, pushedTransactions, selectedBankLedger]);

  // --- FETCH BANK TRANSACTIONS & COA DIRECTLY FROM FIRESTORE ---
  useEffect(() => {
    let isMounted = true;

    async function loadCloudBankingData() {
      try {
        const [cloudPending, cloudApproved, cloudPushed, coaData] = await Promise.all([
          api.getBankTxns(activeClient, "pending").catch(() => null),
          api.getBankTxns(activeClient, "reconciled").catch(() => null),
          api.getBankTxns(activeClient, "pushed").catch(() => null),
          api.getClientCoa(activeClient).catch(() => null)
        ]);

        if (!isMounted) return;

        if (Array.isArray(cloudPending)) {
          setTransactions(cloudPending);
          localStorage.setItem(`c4_bank_transactions_${activeClient}`, JSON.stringify(cloudPending));
        }
        if (Array.isArray(cloudApproved)) {
          setApprovedTransactions(cloudApproved);
          localStorage.setItem(`c4_bank_approved_${activeClient}`, JSON.stringify(cloudApproved));
        }
        if (Array.isArray(cloudPushed)) {
          setPushedTransactions(cloudPushed);
          localStorage.setItem(`c4_bank_pushed_${activeClient}`, JSON.stringify(cloudPushed));
        }
        if (Array.isArray(coaData) && coaData.length > 0) {
          setClientCoa(coaData);
          localStorage.setItem(`c4_coa_${activeClient}`, JSON.stringify(coaData));
        }
      } catch (err) {
        console.warn("Using offline fallback for banking:", err);
      }
    }

    if (activeClient) {
      loadCloudBankingData();
    }

    return () => {
      isMounted = false;
    };
  }, [activeClient]);

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
  const [expandedFolders, setExpandedFolders] = useState({});
  const [editingApprovedId, setEditingApprovedId] = useState(null);
  const fileInputRef = useRef(null);

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const toggleFolder = (folderKey) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey]
    }));
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
      "Date,Narration,Chq_Ref_No,Withdraw,Deposit,Balance\n" +
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

  const handleDownloadApprovedExcel = () => {
    if (approvedTransactions.length === 0) {
      notify("No approved transactions available to export.", "error");
      return;
    }

    const headers = [
      "Date", "Bank Ledger", "Type", "Narration / Description", "Reference No", "Allocated Ledger (COA)", "Amount (₹)", "Approved At"
    ];

    const rows = approvedTransactions.map((tx) => [
      `"${tx.date || ""}"`,
      `"${tx.bankLedger || selectedBankLedger}"`,
      `"${tx.type || ""}"`,
      `"${(tx.narration || "").replace(/"/g, '""')}"`,
      `"${tx.refNo || "-"}"`,
      `"${(tx.allocatedLedger || "").replace(/"/g, '""')}"`,
      Number(tx.amount || 0).toFixed(2),
      `"${tx.approvedAt || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Approved_Bank_Transactions_${activeClient.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Exported ${approvedTransactions.length} approved transactions to CSV!`, "success");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const fileName = file.name.toLowerCase();

    try {
      const XLSX = await loadSheetJS();
      const reader = new FileReader();

      reader.onload = async (event) => {
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
              (rowStr.includes("narr") || rowStr.includes("desc") || rowStr.includes("particular") || rowStr.includes("withdraw") || rowStr.includes("deposit") || rowStr.includes("debit") || rowStr.includes("credit"))
            ) {
              headerIdx = r;
              break;
            }
          }

          const headers = (rawRows[headerIdx] || []).map((h) => String(h || "").trim().toLowerCase());
          const dateIdx = headers.findIndex((h) => h.includes("date") || h.includes("txn date"));
          const narrIdx = headers.findIndex((h) => h.includes("narr") || h.includes("desc") || h.includes("particular") || h.includes("remark"));
          const refIdx = headers.findIndex((h) => h.includes("ref") || h.includes("chq") || h.includes("cheque") || h.includes("utr"));
          const withIdx = headers.findIndex((h) => h.includes("withdraw") || h.includes("with") || h.includes("debit") || h.includes("dr"));
          const depIdx = headers.findIndex((h) => h.includes("deposit") || h.includes("dep") || h.includes("credit") || h.includes("cr"));

          const parsedRows = [];

          const parseCleanAmount = (rawVal) => {
            if (rawVal === undefined || rawVal === null || rawVal === "") return 0;
            const cleaned = String(rawVal).replace(/,/g, "").replace(/[^0-9.-]/g, "");
            return parseFloat(cleaned) || 0;
          };

          for (let i = headerIdx + 1; i < rawRows.length; i++) {
            const cells = rawRows[i] || [];
            if (!cells || cells.length === 0) continue;

            let dateVal = dateIdx !== -1 && cells[dateIdx] ? String(cells[dateIdx]).trim() : "";
            if (!dateVal) continue;

            if (!isNaN(dateVal) && Number(dateVal) > 20000 && Number(dateVal) < 60000) {
              const excelDate = new Date(Math.round((Number(dateVal) - 25569) * 86400 * 1000));
              dateVal = excelDate.toISOString().split("T")[0];
            }

            const narrVal = narrIdx !== -1 && cells[narrIdx] ? String(cells[narrIdx]).trim() : "Bank Transaction";
            const refVal = refIdx !== -1 && cells[refIdx] ? String(cells[refIdx]).trim() : "-";

            let withdrawal = withIdx !== -1 ? parseCleanAmount(cells[withIdx]) : 0;
            let deposit = depIdx !== -1 ? parseCleanAmount(cells[depIdx]) : 0;

            if (withdrawal === 0 && deposit === 0) continue;

            withdrawal = Math.abs(withdrawal);
            deposit = Math.abs(deposit);

            const type = deposit > 0 ? "Receipt" : "Payment";
            const amount = deposit > 0 ? deposit : withdrawal;
            const matched = findMatchingLedger(narrVal);

            parsedRows.push({
              id: `tx_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
              date: dateVal,
              bankLedger: selectedBankLedger,
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

            await api.saveBankTxns(activeClient, "pending", parsedRows).catch((err) => {
              console.warn("Failed saving bank txns to cloud:", err);
            });

            notify(`Extracted ${parsedRows.length} transactions for [${selectedBankLedger}] & saved to Firestore!`, "success");
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

  const handleLedgerSelectAndAutoApprove = async (tx, newLedger) => {
    if (!newLedger) return;

    if (tx.narration && tx.narration.trim().length > 3) {
      const cleanPattern = tx.narration.trim().split(" ")[0].toLowerCase();
      if (cleanPattern.length >= 3) {
        setNarrativeRules((prev) => ({
          ...prev,
          [cleanPattern]: newLedger
        }));
      }
    }

    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));

    const approvedTx = {
      ...tx,
      bankLedger: tx.bankLedger || selectedBankLedger,
      allocatedLedger: newLedger,
      isAutoMatched: true,
      approvedAt: new Date().toLocaleString()
    };
    setApprovedTransactions((prev) => [approvedTx, ...prev]);

    try {
      await api.saveBankTxns(activeClient, "reconciled", [approvedTx]);
      await api.deleteBankTxn(activeClient, "pending", tx.id);
      notify(`Assigned "${newLedger}" & auto-approved to Firestore!`, "success");
    } catch (err) {
      console.error(err);
      notify(`Approved locally, cloud sync error: ${err.message}`, "info");
    }
  };

  const handleUpdateApprovedLedger = async (txId, newLedger) => {
    if (!newLedger) return;
    const target = approvedTransactions.find((t) => t.id === txId);
    if (!target) return;

    const updated = { ...target, allocatedLedger: newLedger };
    setApprovedTransactions((prev) =>
      prev.map((t) => (t.id === txId ? updated : t))
    );
    setEditingApprovedId(null);

    try {
      await api.saveBankTxns(activeClient, "reconciled", [updated]);
      notify(`Updated ledger to "${newLedger}" in Firestore!`, "success");
    } catch (err) {
      console.error(err);
      notify(`Updated locally, cloud sync warning: ${err.message}`, "info");
    }
  };

  const handleRevertToReview = async (tx) => {
    setApprovedTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    setTransactions((prev) => [tx, ...prev]);

    try {
      await api.saveBankTxns(activeClient, "pending", [tx]);
      await api.deleteBankTxn(activeClient, "reconciled", tx.id);
      notify("Transaction reverted to Needs Review tab in Firestore.", "info");
    } catch (err) {
      console.error(err);
      notify("Reverted locally.", "info");
    }
  };

  const handleApproveSingle = async (tx) => {
    const approvedTx = { ...tx, bankLedger: tx.bankLedger || selectedBankLedger, approvedAt: new Date().toLocaleString() };
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    setApprovedTransactions((prev) => [approvedTx, ...prev]);

    try {
      await api.saveBankTxns(activeClient, "reconciled", [approvedTx]);
      await api.deleteBankTxn(activeClient, "pending", tx.id);
      notify("Transaction approved & moved to Firestore Approved queue!", "success");
    } catch (err) {
      console.error(err);
      notify("Approved locally.", "info");
    }
  };

  const handleApproveAll = async () => {
    if (transactions.length === 0) return;
    const toApprove = transactions.map((t) => ({ ...t, bankLedger: t.bankLedger || selectedBankLedger, approvedAt: new Date().toLocaleString() }));
    setApprovedTransactions((prev) => [...toApprove, ...prev]);
    setTransactions([]);
    setBankSubTab("approved");

    try {
      await api.saveBankTxns(activeClient, "reconciled", toApprove);
      for (const t of transactions) {
        await api.deleteBankTxn(activeClient, "pending", t.id).catch(() => null);
      }
      notify(`Approved all ${toApprove.length} transactions & synced to Firestore!`, "success");
    } catch (err) {
      console.error(err);
      notify("Approved locally.", "info");
    }
  };

  const handleDiscardAll = async () => {
    if (bankSubTab === "needs_review") {
      if (transactions.length === 0) return;
      if (!window.confirm(`Discard all ${transactions.length} transactions in Needs Review from Firestore?`)) return;
      const idsToDelete = [...transactions];
      setTransactions([]);
      for (const t of idsToDelete) {
        await api.deleteBankTxn(activeClient, "pending", t.id).catch(() => null);
      }
      notify("All pending transactions discarded.", "info");
    } else if (bankSubTab === "approved") {
      if (approvedTransactions.length === 0) return;
      if (!window.confirm(`Discard all ${approvedTransactions.length} transactions in Approved queue from Firestore?`)) return;
      const idsToDelete = [...approvedTransactions];
      setApprovedTransactions([]);
      for (const t of idsToDelete) {
        await api.deleteBankTxn(activeClient, "reconciled", t.id).catch(() => null);
      }
      notify("All approved transactions discarded.", "info");
    }
  };

  const handleDeleteApproved = async (txId) => {
    setApprovedTransactions((prev) => prev.filter((t) => t.id !== txId));
    await api.deleteBankTxn(activeClient, "reconciled", txId).catch(() => null);
    notify("Transaction removed from Approved queue.", "info");
  };

  const handleDeleteNeedsReview = async (txId) => {
    setTransactions((prev) => prev.filter((t) => t.id !== txId));
    await api.deleteBankTxn(activeClient, "pending", txId).catch(() => null);
    notify("Transaction dismissed.", "info");
  };

  // 100% TALLY-COMPLIANT SINGLE VOUCHER XML GENERATOR
  const buildSingleXmlVoucher = (tx) => {
    const rawDate = tx.date || "2026-09-29";
    const tallyDate = String(rawDate).replace(/[^0-9]/g, "").padEnd(8, "0").slice(0, 8);
    const isReceipt = tx.type === "Receipt";
    const vchType = isReceipt ? "Receipt" : "Payment";
    const amountVal = Number(tx.amount || 0).toFixed(2);
    const vchNumber = String(tx.refNo && tx.refNo !== "-" ? tx.refNo : (tx.id || `BNK-${Date.now()}`)).slice(-10);
    const narration = (tx.narration || `${vchType} voucher`).replace(/&/g, "&amp;");
    const allocatedLedger = (tx.allocatedLedger || "Suspense Account").replace(/&/g, "&amp;");
    const bankLedger = (tx.bankLedger || selectedBankLedger || "Bank Account").replace(/&/g, "&amp;");

    return `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="${vchType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${tallyDate}</DATE>
          <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
          <VOUCHERTYPENAME>${vchType}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${vchNumber}</VOUCHERNUMBER>
          <REFERENCE>${vchNumber}</REFERENCE>
          <PARTYLEDGERNAME>${bankLedger}</PARTYLEDGERNAME>
          <NARRATION>${narration} [Synced via Compliance4]</NARRATION>
          <ISINVOICE>No</ISINVOICE>

          <!-- BANK LEDGER -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${bankLedger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${isReceipt ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
            <LEDGERFROMITEM>No</LEDGERFROMITEM>
            <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <AMOUNT>${isReceipt ? `-${amountVal}` : amountVal}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>

          <!-- ALLOCATED / COUNTER LEDGER -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${allocatedLedger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${isReceipt ? "No" : "Yes"}</ISDEEMEDPOSITIVE>
            <LEDGERFROMITEM>No</LEDGERFROMITEM>
            <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>${isReceipt ? amountVal : `-${amountVal}`}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>`;
  };

  const handleDownloadXML = () => {
    const list = [...approvedTransactions, ...pushedTransactions];
    if (list.length === 0) {
      notify("No approved bank transactions to export.", "error");
      return;
    }

    const xmlVouchers = list.map((t) => buildSingleXmlVoucher(t)).join("\n");
    const fullXML = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${activeClient}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${xmlVouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const blob = new Blob([fullXML], { type: "text/xml;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Tally_Import_Bank_${activeClient.replace(/\s+/g, "_")}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Downloaded Tally-compliant XML import file!", "success");
  };

  const pushVoucherToTallyXml = async (tx) => {
    const xmlVoucher = buildSingleXmlVoucher(tx);
    const tallyXml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${activeClient}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${xmlVoucher}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch("http://localhost:9000", {
      method: "POST",
      headers: { "Content-Type": "text/xml;charset=utf-8" },
      body: tallyXml,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Tally server responded with status: ${response.status}`);
    }

    return await response.text();
  };

  const handlePushSingle = async (tx) => {
    try {
      await pushVoucherToTallyXml(tx);
      const pushedRecord = { ...tx, pushedAt: new Date().toLocaleString() };

      setApprovedTransactions((prev) => prev.filter((t) => t.id !== tx.id));
      setPushedTransactions((prev) => [pushedRecord, ...prev]);

      await api.saveBankTxns(activeClient, "pushed", [pushedRecord]).catch(() => null);
      await api.deleteBankTxn(activeClient, "reconciled", tx.id).catch(() => null);

      notify(`Transaction #${tx.id} synced to Tally & recorded in Firestore!`, "success");
    } catch (err) {
      notify(
        "Could not connect to Tally Prime on Port 9000. Please ensure Tally Prime is open with XML/ODBC enabled.",
        "error"
      );
    }
  };

  const handlePushAllApproved = async () => {
    if (approvedTransactions.length === 0) return;
    setIsSyncing(true);

    let pushedCount = 0;
    const toPush = [...approvedTransactions];
    const successfullyPushed = [];

    for (const tx of toPush) {
      try {
        await pushVoucherToTallyXml(tx);
        successfullyPushed.push({ ...tx, pushedAt: new Date().toLocaleString() });
        pushedCount++;
      } catch (err) {
        break;
      }
    }

    if (pushedCount > 0) {
      const pushedIds = new Set(successfullyPushed.map((s) => s.id));
      setApprovedTransactions((prev) => prev.filter((t) => !pushedIds.has(t.id)));
      setPushedTransactions((prev) => [...successfullyPushed, ...prev]);

      await api.saveBankTxns(activeClient, "pushed", successfullyPushed).catch(() => null);
      for (const pushed of successfullyPushed) {
        await api.deleteBankTxn(activeClient, "reconciled", pushed.id).catch(() => null);
      }

      notify(`Pushed ${pushedCount} transactions to Tally Prime & recorded in Firestore!`, "success");
      setBankSubTab("pushed");
    } else {
      notify(
        "Tally Prime is offline on Port 9000. No transactions were moved.",
        "error"
      );
    }

    setIsSyncing(false);
  };

  const groupedPushedTransactions = useMemo(() => {
    const groups = {};
    pushedTransactions.forEach((tx) => {
      const rawDate = tx.date;
      let monthYear = "Other / Undated";

      if (rawDate) {
        try {
          const parts = String(rawDate).split(/[\/\-]/);
          let dateObj = null;
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              dateObj = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
            } else {
              const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              dateObj = new Date(yr, parseInt(parts[1]) - 1, parts[0]);
            }
          } else {
            dateObj = new Date(rawDate);
          }

          if (dateObj && !isNaN(dateObj.getTime())) {
            monthYear = dateObj.toLocaleString("en-US", { month: "long", year: "numeric" });
          }
        } catch {
          monthYear = "Other / Undated";
        }
      }

      if (!groups[monthYear]) {
        groups[monthYear] = {
          monthLabel: monthYear,
          transactions: [],
          totalAmount: 0
        };
      }

      groups[monthYear].transactions.push(tx);
      groups[monthYear].totalAmount += parseFloat(tx.amount || 0);
    });

    return Object.values(groups);
  }, [pushedTransactions]);

  const displayedList =
    bankSubTab === "needs_review"
      ? transactions
      : bankSubTab === "approved"
      ? approvedTransactions
      : pushedTransactions;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-xs shrink-0 flex-wrap gap-3">
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

        {/* BANK ACCOUNT SELECTOR, LIVE BALANCE & ACTIONS */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg">
            <Building className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="text-left">
              <span className="block text-[9px] font-bold text-slate-400 uppercase leading-none">Target Bank Account</span>
              <select
                value={selectedBankLedger}
                onChange={(e) => setSelectedBankLedger(e.target.value)}
                className="text-xs font-bold text-slate-900 bg-transparent border-none focus:outline-none cursor-pointer pr-4 mt-0.5"
              >
                {availableBankLedgers.map((bank) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>
            <div className="border-l border-slate-200 pl-3 text-right">
              <span className="block text-[9px] font-bold text-slate-400 uppercase leading-none">Live Balance</span>
              <span className={`text-xs font-mono font-black ${currentBankBalance >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                ₹{currentBankBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {approvedTransactions.length > 0 && (
            <button
              onClick={handleDownloadApprovedExcel}
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3 py-2 rounded-lg transition"
              title="Download CSV of all approved transactions"
            >
              <Download className="w-3.5 h-3.5" /> Export Approved (Excel)
            </button>
          )}

          <button
            onClick={handleDownloadXML}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-lg transition border border-blue-200"
            title="Download Tally-compliant XML import file"
          >
            <FileCode className="w-3.5 h-3.5" /> Download Tally XML
          </button>

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
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-xs disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {isUploading ? "Processing..." : "Upload Bank Statement"}
          </button>
        </div>
      </header>

      {/* SUB-TABS & BATCH ACTION CONTROLS */}
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
        <div className="flex items-center gap-2 pb-2">
          {bankSubTab === "needs_review" && transactions.length > 0 && (
            <>
              <button
                onClick={handleDiscardAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold transition"
                title="Discard all pending transactions"
              >
                <Trash2 className="w-3.5 h-3.5" /> Discard All
              </button>

              <button
                onClick={handleApproveAll}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-xs transition"
              >
                <Check className="w-3.5 h-3.5" /> Approve All ({transactions.length})
              </button>
            </>
          )}

          {bankSubTab === "approved" && approvedTransactions.length > 0 && (
            <>
              <button
                onClick={handleDiscardAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold transition"
                title="Discard all approved transactions"
              >
                <Trash2 className="w-3.5 h-3.5" /> Discard All
              </button>

              <button
                onClick={handlePushAllApproved}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {isSyncing ? "Pushing to Tally..." : `Push All to Tally (${approvedTransactions.length})`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* TABLE VIEW */}
      <div className="flex-1 p-8 overflow-y-auto">
        {bankSubTab !== "pushed" && (
          <>
            {displayedList.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center shadow-xs">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">
                  No transactions in {bankSubTab === "needs_review" ? "Needs Review" : "Approved"}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Upload bank statements in <strong>Excel (.xlsx, .xls)</strong> or <strong>CSV</strong> format to extract and auto-classify transactions.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-visible shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Bank Account</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Narration / Description</th>
                      <th className="py-3 px-4 w-72">Ledger Allocation</th>
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

                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600 font-semibold">
                          {tx.bankLedger || selectedBankLedger}
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

                        {/* SEARCHABLE TYPEAHEAD COMBOBOX IN BANK TABLE */}
                        <td className="py-3 px-4 relative overflow-visible">
                          {bankSubTab === "needs_review" ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1">
                                <SearchableLedgerSelect
                                  value={tx.allocatedLedger}
                                  onChange={(selectedLedger) => handleLedgerSelectAndAutoApprove(tx, selectedLedger)}
                                  coaList={clientCoa}
                                  fallbackOptions={DEFAULT_EXPENSE_FALLBACKS}
                                  placeholder="Type to allocate & approve →"
                                />
                              </div>
                              {tx.isAutoMatched && (
                                <span title={`Auto-suggested: ${tx.allocatedLedger}`} className="text-indigo-600 shrink-0">
                                  <Sparkles className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          ) : editingApprovedId === tx.id ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1">
                                <SearchableLedgerSelect
                                  value={tx.allocatedLedger}
                                  onChange={(selectedLedger) => handleUpdateApprovedLedger(tx.id, selectedLedger)}
                                  coaList={clientCoa}
                                  fallbackOptions={DEFAULT_EXPENSE_FALLBACKS}
                                  placeholder="Type to re-allocate..."
                                />
                              </div>
                              <button
                                onClick={() => setEditingApprovedId(null)}
                                className="text-slate-400 hover:text-slate-600 text-xs px-1"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded text-xs font-semibold">
                                {tx.allocatedLedger}
                              </span>
                              <button
                                onClick={() => setEditingApprovedId(tx.id)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                title="Change Assigned Ledger"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                          ₹{Number(tx.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {bankSubTab === "needs_review" && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleApproveSingle(tx)}
                                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-semibold text-[11px] shadow-xs transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDeleteNeedsReview(tx.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                title="Dismiss Transaction"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {bankSubTab === "approved" && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handlePushSingle(tx)}
                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3 py-1 rounded shadow-xs transition"
                              >
                                <Send className="w-3.5 h-3.5" /> Push
                              </button>
                              <button
                                onClick={() => handleRevertToReview(tx)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                title="Move back to Needs Review"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteApproved(tx.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                title="Remove from Approved"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* TAB 3: PUSHED TO TALLY */}
        {bankSubTab === "pushed" && (
          <div className="space-y-4">
            {groupedPushedTransactions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-16 text-center">
                <FileSpreadsheet className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No transactions pushed to Tally yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Transactions pushed to Tally Prime will be organized into monthly folders here.
                </p>
              </div>
            ) : (
              groupedPushedTransactions.map((group) => {
                const isExpanded = expandedFolders[group.monthLabel] !== false;

                return (
                  <div key={group.monthLabel} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                    <div
                      onClick={() => toggleFolder(group.monthLabel)}
                      className="px-6 py-4 bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer transition select-none"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <FolderOpen className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Folder className="w-5 h-5 text-slate-400" />
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 tracking-wide uppercase flex items-center gap-2">
                            {group.monthLabel}
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-mono font-bold lowercase">
                              {group.transactions.length} entries
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Bank activity for {group.monthLabel}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Total Volume</span>
                          <p className="text-sm font-black font-mono text-slate-900">
                            ₹{Number(group.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="p-1 rounded bg-white border border-slate-200 text-slate-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-white border-b border-slate-200 uppercase font-semibold text-slate-400 text-[10px]">
                          <tr>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Bank Account</th>
                            <th className="px-6 py-3">Type</th>
                            <th className="px-6 py-3">Narration / Description</th>
                            <th className="px-6 py-3">Allocated Ledger (COA)</th>
                            <th className="px-6 py-3">Pushed At</th>
                            <th className="px-6 py-3 font-mono text-right">Amount (₹)</th>
                            <th className="px-6 py-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.transactions.map((tx, idx) => (
                            <tr key={tx.id || idx} className="hover:bg-slate-50/60 transition">
                              <td className="px-6 py-3.5 font-mono text-slate-900 font-bold whitespace-nowrap">
                                {tx.date}
                              </td>
                              <td className="px-6 py-3.5 font-mono text-slate-600 font-semibold whitespace-nowrap">
                                {tx.bankLedger}
                              </td>
                              <td className="px-6 py-3.5 whitespace-nowrap">
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
                              <td className="px-6 py-3.5 text-slate-800 max-w-xs truncate" title={tx.narration}>
                                <p className="font-semibold text-slate-900 leading-tight truncate">{tx.narration}</p>
                                <p className="font-mono text-[10px] text-slate-400 mt-0.5">Ref: {tx.refNo}</p>
                              </td>
                              <td className="px-6 py-3.5 font-semibold text-indigo-900">
                                {tx.allocatedLedger}
                              </td>
                              <td className="px-6 py-3.5 text-slate-400 text-[11px]">
                                {tx.pushedAt || "Recent"}
                              </td>
                              <td className="px-6 py-3.5 font-mono font-bold text-slate-800 text-right">
                                ₹{Number(tx.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                  <Check className="w-3 h-3" /> In Tally
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })
            )}
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
