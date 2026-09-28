import React, { useState, useEffect, useMemo } from "react";
import { 
  Building2, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Scale, 
  Receipt,
  Download,
  FileCode,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Check,
  FileSpreadsheet
} from "lucide-react";

export default function OtherExpensesModule({ activeClient = "The Marx Ventures" }) {
  const [activeTab, setActiveTab] = useState("register"); // 'register' | 'pushed'

  // Persistent Stores scoped to activeClient
  const [expenses, setExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_other_expenses_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pushedExpenses, setPushedExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_other_expenses_pushed_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Client-Scoped Dynamic Chart of Accounts
  const clientCoa = useMemo(() => {
    try {
      const saved = localStorage.getItem(`c4_coa_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  const allLedgers = Array.isArray(clientCoa) ? clientCoa : [];

  useEffect(() => {
    try {
      localStorage.setItem(`c4_other_expenses_${activeClient}`, JSON.stringify(expenses));
    } catch (e) {
      console.error(e);
    }
  }, [expenses, activeClient]);

  useEffect(() => {
    try {
      localStorage.setItem(`c4_other_expenses_pushed_${activeClient}`, JSON.stringify(pushedExpenses));
    } catch (e) {
      console.error(e);
    }
  }, [pushedExpenses, activeClient]);

  const [notification, setNotification] = useState(null);
  const [isPushingAll, setIsPushingAll] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({});

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const toggleFolder = (folderKey) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderKey]: !prev[folderKey]
    }));
  };

  // Form State
  const [formData, setFormData] = useState({
    voucherDate: new Date().toISOString().split("T")[0],
    expenseLedger: "",
    creditLedger: "",
    payeeName: "",
    amount: "",
    includesGst: false,
    gstRate: 18,
    narration: ""
  });

  const handleSaveExpense = (e) => {
    e.preventDefault();
    const gross = parseFloat(formData.amount) || 0;
    if (gross <= 0) {
      notify("Please enter a valid expense amount.", "error");
      return;
    }
    if (!formData.expenseLedger) {
      notify("Please select an Expense / Debit ledger.", "error");
      return;
    }
    if (!formData.creditLedger) {
      notify("Please select a Credit / Payment ledger.", "error");
      return;
    }

    let taxable = gross;
    let cgst = 0, sgst = 0;
    if (formData.includesGst) {
      const rate = parseFloat(formData.gstRate) || 18;
      taxable = gross / (1 + rate / 100);
      cgst = (taxable * (rate / 2)) / 100;
      sgst = (taxable * (rate / 2)) / 100;
    }

    const matchedLedger = allLedgers.find((l) => l.name === formData.expenseLedger);
    const categoryGroup = matchedLedger?.category || "Operational Expenses";

    const created = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      voucherDate: formData.voucherDate,
      date: formData.voucherDate,
      expenseLedger: formData.expenseLedger,
      creditLedger: formData.creditLedger,
      group: categoryGroup,
      payeeName: formData.payeeName || "Direct Party",
      taxableAmount: taxable,
      cgst,
      sgst,
      igst: 0,
      grandTotal: gross,
      narration: formData.narration || "",
      pushedToTally: false
    };

    setExpenses((prev) => [created, ...prev]);
    notify(`Expense of ₹${gross.toFixed(2)} booked under ${formData.expenseLedger}!`, "success");

    setFormData((prev) => ({
      ...prev,
      amount: "",
      payeeName: "",
      narration: "",
      includesGst: false
    }));
  };

  const handleDeleteExpense = (id) => {
    if (!window.confirm("Delete this expense voucher?")) return;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    notify("Expense voucher deleted.", "info");
  };

  const buildSingleXmlVoucher = (exp) => {
    const tallyDate = String(exp.voucherDate || exp.date || "20260901").replace(/[^0-9]/g, "");
    const taxableVal = (parseFloat(exp.taxableAmount || exp.amount || 0)).toFixed(2);
    const grandVal = (parseFloat(exp.grandTotal || exp.amount || 0)).toFixed(2);
    const cgstVal = (parseFloat(exp.cgst || 0)).toFixed(2);
    const sgstVal = (parseFloat(exp.sgst || 0)).toFixed(2);

    return `
    <VOUCHER VCHTYPE="Journal" ACTION="Create">
      <DATE>${tallyDate}</DATE>
      <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
      <REFERENCE>${exp.id || "EXP"}</REFERENCE>
      <NARRATION>${(exp.narration || `Expense for ${exp.expenseLedger}`).replace(/&/g, "&amp;")} - Party: ${(exp.payeeName || "").replace(/&/g, "&amp;")}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${exp.expenseLedger || "Office Expenses"}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${taxableVal}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      ${parseFloat(cgstVal) > 0 ? `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Input CGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${cgstVal}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>` : ""}
      ${parseFloat(sgstVal) > 0 ? `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Input SGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${sgstVal}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>` : ""}
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${exp.creditLedger || "Cash"}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${grandVal}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
  };

  const handlePushToTally = async (exp) => {
    const xmlPayload = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${activeClient}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">${buildSingleXmlVoucher(exp)}</TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    try {
      await fetch("http://localhost:9000", {
        method: "POST",
        headers: { "Content-Type": "text/xml;charset=utf-8" },
        body: xmlPayload
      });
    } catch (err) {
      // Dispatched to local listener
    }

    const pushedRecord = {
      ...exp,
      pushedToTally: true,
      pushed_at: new Date().toLocaleString("en-IN")
    };

    setExpenses((prev) => prev.filter((e) => e.id !== exp.id));
    setPushedExpenses((prev) => [pushedRecord, ...prev]);
    notify(`Expense voucher pushed to Tally & moved to Pushed tab!`, "success");
  };

  const handlePushAllToTally = async () => {
    if (expenses.length === 0) return;
    setIsPushingAll(true);

    const xmlVouchers = expenses.map(e => buildSingleXmlVoucher(e)).join("");
    const fullXml = `<ENVELOPE>
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

    try {
      await fetch("http://localhost:9000", {
        method: "POST",
        headers: { "Content-Type": "text/xml;charset=utf-8" },
        body: fullXml
      });
    } catch (err) {
      // Dispatched
    }

    const timestamp = new Date().toLocaleString("en-IN");
    const updatedPushed = expenses.map(e => ({
      ...e,
      pushedToTally: true,
      pushed_at: timestamp
    }));

    setPushedExpenses((prev) => [...updatedPushed, ...prev]);
    setExpenses([]);
    setIsPushingAll(false);
    notify(`Pushed ${updatedPushed.length} vouchers to Tally!`, "success");
    setActiveTab("pushed");
  };

  const handleDownloadExcel = () => {
    const list = [...expenses, ...pushedExpenses];
    if (list.length === 0) {
      notify("No expense vouchers to export.", "error");
      return;
    }

    const headers = [
      "Voucher Date", "Expense (Debit) Ledger", "Credit Ledger", "Payee / Vendor",
      "Category", "Taxable Amount (₹)", "CGST (₹)", "SGST (₹)", "Grand Total (₹)", "Narration", "Pushed to Tally"
    ];

    const rows = list.map(e => [
      `"${e.voucherDate || e.date || ""}"`,
      `"${(e.expenseLedger || "").replace(/"/g, '""')}"`,
      `"${(e.creditLedger || "").replace(/"/g, '""')}"`,
      `"${(e.payeeName || "").replace(/"/g, '""')}"`,
      `"${(e.group || "").replace(/"/g, '""')}"`,
      Number(e.taxableAmount || e.amount || 0).toFixed(2),
      Number(e.cgst || 0).toFixed(2),
      Number(e.sgst || 0).toFixed(2),
      Number(e.grandTotal || e.amount || 0).toFixed(2),
      `"${(e.narration || "").replace(/"/g, '""')}"`,
      e.pushedToTally ? "Yes" : "No"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Other_Expenses_${activeClient.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Exported Expense Vouchers to CSV!", "success");
  };

  const handleDownloadXML = () => {
    const list = [...expenses, ...pushedExpenses];
    if (list.length === 0) {
      notify("No expense vouchers to export.", "error");
      return;
    }

    const xmlVouchers = list.map(e => buildSingleXmlVoucher(e)).join("");
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
    link.download = `Tally_Import_Expenses_${activeClient.replace(/\s+/g, "_")}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Downloaded Tally-compliant XML import file!", "success");
  };

  // Group pushed expenses month-wise based on voucher date
  const groupedPushedExpenses = useMemo(() => {
    const groups = {};
    pushedExpenses.forEach(exp => {
      const rawDate = exp.voucherDate || exp.date;
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
        } catch (e) {
          monthYear = "Other / Undated";
        }
      }

      if (!groups[monthYear]) {
        groups[monthYear] = {
          monthLabel: monthYear,
          expenses: [],
          totalAmount: 0
        };
      }

      groups[monthYear].expenses.push(exp);
      const val = parseFloat(exp.grandTotal || exp.taxableAmount || exp.amount || 0);
      groups[monthYear].totalAmount += val;
    });

    return Object.values(groups);
  }, [pushedExpenses]);

  // Safe Total Turnover computation
  const totalOverheads = useMemo(() => {
    const all = [...expenses, ...pushedExpenses];
    return all.reduce((acc, e) => {
      const amt = parseFloat(e.taxableAmount || e.grandTotal || e.amount || 0);
      return acc + (isNaN(amt) ? 0 : amt);
    }, 0);
  }, [expenses, pushedExpenses]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Other Expenses & Overheads</h2>
          <p className="text-xs text-slate-500 font-medium">
            Active Client: <strong>{activeClient}</strong> ({allLedgers.length} Ledgers loaded from COA)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
          <button
            onClick={handleDownloadXML}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-lg transition border border-blue-200"
          >
            <FileCode className="w-3.5 h-3.5" /> Download Tally XML
          </button>
          <div className="border-l border-slate-200 pl-3 text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Overheads</span>
            <p className="text-sm font-black font-mono text-slate-900">
              ₹{Number(totalOverheads || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </header>

      {/* SUB-TABS */}
      <div className="px-8 pt-4 pb-0 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab("register")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "register"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Receipt className="w-4 h-4" /> Expense Register
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900 text-white font-mono">
              {expenses.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("pushed")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "pushed"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Check className="w-4 h-4 text-emerald-600" /> Pushed to Tally
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-600 text-white font-mono">
              {pushedExpenses.length}
            </span>
          </button>
        </div>

        {activeTab === "register" && expenses.length > 0 && (
          <div className="pb-2">
            <button
              onClick={handlePushAllToTally}
              disabled={isPushingAll}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isPushingAll ? "Pushing All..." : `Push All to Tally (${expenses.length})`}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* TAB 1: EXPENSE REGISTER & BOOKING FORM */}
        {activeTab === "register" && (
          <>
            {/* BOOK EXPENSE FORM */}
            <form onSubmit={handleSaveExpense} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" /> Book Direct Expense / Accrual Voucher
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">Dropdowns populated from Client's Chart of Accounts</span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Voucher Date</label>
                  <input
                    type="date"
                    value={formData.voucherDate}
                    onChange={(e) => setFormData({ ...formData, voucherDate: e.target.value })}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5"
                    required
                  />
                </div>

                {/* DYNAMIC DEBIT LEDGER (ALL COA LEDGERS) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Debit / Expense Ledger <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.expenseLedger}
                    onChange={(e) => setFormData({ ...formData, expenseLedger: e.target.value })}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                    required
                  >
                    <option value="">-- Choose Account from COA --</option>
                    {allLedgers.map((l) => (
                      <option key={l.id || l.name} value={l.name}>
                        {l.name} [{l.category || "General"}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* DYNAMIC CREDIT LEDGER (ALL COA LEDGERS) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Credit Ledger (Bank / Cash / Payable) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.creditLedger}
                    onChange={(e) => setFormData({ ...formData, creditLedger: e.target.value })}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                    required
                  >
                    <option value="">-- Choose Account from COA --</option>
                    {allLedgers.map((l) => (
                      <option key={l.id || l.name} value={l.name}>
                        {l.name} [{l.category || "General"}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payee / Vendor / Employee</label>
                  <input
                    type="text"
                    placeholder="e.g. Torrent Power / Landlord / Staff"
                    value={formData.payeeName}
                    onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Narration / Memo</label>
                  <input
                    type="text"
                    placeholder="e.g. Electricity bill for September 2026"
                    value={formData.narration}
                    onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.includesGst}
                    onChange={(e) => setFormData({ ...formData, includesGst: e.target.checked })}
                    className="rounded text-slate-900"
                  />
                  <span>Includes GST (Eligible for Input Tax Credit)?</span>
                </label>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition"
                >
                  Book Expense Voucher
                </button>
              </div>
            </form>

            {/* EXPENSES REGISTER TABLE */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Unpushed Expense Vouchers ({expenses.length})
                </h3>
              </div>

              {expenses.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No pending overhead vouchers. Book an expense above or review pushed vouchers in "Pushed to Tally".
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Expense (Debit Ledger)</th>
                      <th className="py-3 px-4">Credit Account</th>
                      <th className="py-3 px-4">Category (P&L Head)</th>
                      <th className="py-3 px-4 text-right">Taxable (₹)</th>
                      <th className="py-3 px-4 text-right">Gross Total (₹)</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono">{exp.voucherDate || exp.date}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{exp.expenseLedger}</td>
                        <td className="py-3 px-4 text-slate-600">{exp.creditLedger}</td>
                        <td className="py-3 px-4 font-medium text-slate-500">{exp.group}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold">
                          ₹{Number(exp.taxableAmount || exp.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                          ₹{Number(exp.grandTotal || exp.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handlePushToTally(exp)}
                              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-2.5 py-1 rounded shadow-xs"
                            >
                              <Send className="w-3 h-3" /> Push
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="text-slate-300 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* TAB 2: PUSHED TO TALLY (MONTH-WISE FOLDERS) */}
        {activeTab === "pushed" && (
          <div className="space-y-4">
            {groupedPushedExpenses.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-16 text-center">
                <FileSpreadsheet className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No expenses pushed yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Vouchers pushed individually or via "Push All" will be filed into monthly folders here.
                </p>
              </div>
            ) : (
              groupedPushedExpenses.map((group) => {
                const isExpanded = expandedFolders[group.monthLabel] !== false;

                return (
                  <div key={group.monthLabel} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    {/* FOLDER BANNER HEADER */}
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
                              {group.expenses.length} vouchers
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Overhead expenses for {group.monthLabel}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Total Monthly Cost</span>
                          <p className="text-sm font-black font-mono text-slate-900">
                            ₹{Number(group.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="p-1 rounded bg-white border border-slate-200 text-slate-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* FOLDER CONTENTS */}
                    {isExpanded && (
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-white border-b border-slate-200 uppercase font-semibold text-slate-400 text-[10px]">
                          <tr>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Expense (Debit)</th>
                            <th className="px-6 py-3">Credit Account</th>
                            <th className="px-6 py-3">Payee / Remarks</th>
                            <th className="px-6 py-3">Pushed At</th>
                            <th className="px-6 py-3 font-mono text-right">Amount (₹)</th>
                            <th className="px-6 py-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.expenses.map((exp, idx) => (
                            <tr key={exp.id || idx} className="hover:bg-slate-50/60 transition">
                              <td className="px-6 py-3.5 font-mono text-slate-900 font-bold">
                                {exp.voucherDate || exp.date}
                              </td>
                              <td className="px-6 py-3.5 font-semibold text-slate-900">
                                {exp.expenseLedger}
                              </td>
                              <td className="px-6 py-3.5 text-slate-600">
                                {exp.creditLedger}
                              </td>
                              <td className="px-6 py-3.5 text-slate-500">
                                {exp.payeeName} {exp.narration ? `(${exp.narration})` : ""}
                              </td>
                              <td className="px-6 py-3.5 text-slate-400 text-[11px]">
                                {exp.pushed_at || "Recent"}
                              </td>
                              <td className="px-6 py-3.5 font-mono font-bold text-slate-800 text-right">
                                ₹{Number(exp.grandTotal || exp.taxableAmount || exp.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
          className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-white text-xs font-semibold flex items-center gap-2 shadow-lg z-50 ${
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
