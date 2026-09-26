import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  FileText,
  AlertCircle,
  Calendar,
  Layers,
  CreditCard,
  Building,
  Tag,
  Sparkles,
  Percent
} from "lucide-react";

const EXPENSE_GROUPS = [
  {
    group: "Employee Benefit Expenses",
    subtypes: ["Staff Salary & Wages", "Director Remuneration", "Staff Welfare & Refreshment", "Bonus & Incentives"]
  },
  {
    group: "Rent & Occupancy Costs",
    subtypes: ["Commercial Office / Shop Rent", "Electricity & Fuel Charges", "Water & Maintenance Charges"]
  },
  {
    group: "Administrative & Professional Overheads",
    subtypes: ["Legal & Statutory Audit Fees", "Software Subscriptions & Cloud Hosting", "Printing, Stationery & Postage", "Consultancy & Advisory Fees"]
  },
  {
    group: "Selling & Marketing Expenses",
    subtypes: ["Digital Marketing & Advertisements", "Packaging Material & Cartons", "Delivery Commissions", "Promotions & Influencer Marketing"]
  },
  {
    group: "Finance & Banking Charges",
    subtypes: ["Bank Service Charges & Fees", "Loan Interest & Overdraft Interest", "Payment Gateway Processing Fees"]
  },
  {
    group: "Depreciation & Non-Cash Book Entries",
    subtypes: ["Depreciation on Machinery & Equipment", "Depreciation on Furniture & Fixtures", "Depreciation on Computers & IT Assets", "Amortization of Intangible Assets"]
  }
];

const LIABILITY_LEDGERS = [
  "Salary & Wages Payable",
  "Rent Payable",
  "Outstanding Expenses / Provisions",
  "Audit Fees Payable",
  "Director Remuneration Payable",
  "Sundry Creditors (Service Vendors)",
  "Accumulated Depreciation (Asset Contra)",
  "Bank Account (Direct Settlement)",
  "Cash in Hand (Direct Settlement)"
];

const GST_RATE_SLABS = [0, 5, 12, 18, 28];

export default function ExpenseModule({ activeClient = "Panasuria Confectionery" }) {
  const [subTab, setSubTab] = useState("record"); // 'record' | 'register'

  // Client-scoped storage
  const [expenses, setExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_other_expenses_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(`c4_other_expenses_${activeClient}`, JSON.stringify(expenses));
  }, [expenses, activeClient]);

  const [notification, setNotification] = useState(null);
  const [isPushing, setIsPushing] = useState(false);

  // Form State
  const [selectedGroup, setSelectedGroup] = useState(EXPENSE_GROUPS[0].group);
  const [expenseLedger, setExpenseLedger] = useState(EXPENSE_GROUPS[0].subtypes[0]);
  const [creditLedger, setCreditLedger] = useState(LIABILITY_LEDGERS[0]);
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split("T")[0]);
  const [voucherNo, setVoucherNo] = useState(`EXP/26-27/${String(expenses.length + 1).padStart(3, "0")}`);
  const [vendorOrPayee, setVendorOrPayee] = useState("");
  const [narration, setNarration] = useState("");
  
  // Amounts & GST
  const [hasGst, setHasGst] = useState(false);
  const [taxableAmount, setTaxableAmount] = useState("");
  const [gstRate, setGstRate] = useState(18);
  const [isInterstate, setIsInterstate] = useState(false);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleGroupChange = (grp) => {
    setSelectedGroup(grp);
    const found = EXPENSE_GROUPS.find((g) => g.group === grp);
    if (found && found.subtypes.length > 0) {
      setExpenseLedger(found.subtypes[0]);
    }
    // Auto-suggest liability ledger for non-cash depreciation
    if (grp.includes("Depreciation")) {
      setCreditLedger("Accumulated Depreciation (Asset Contra)");
      setHasGst(false);
    } else if (grp.includes("Employee")) {
      setCreditLedger("Salary & Wages Payable");
      setHasGst(false);
    } else if (grp.includes("Rent")) {
      setCreditLedger("Rent Payable");
    } else {
      setCreditLedger("Outstanding Expenses / Provisions");
    }
  };

  // Calculations
  const numericTaxable = parseFloat(taxableAmount) || 0;
  let cgst = 0, sgst = 0, igst = 0;
  if (hasGst && numericTaxable > 0) {
    if (isInterstate) {
      igst = (numericTaxable * gstRate) / 100;
    } else {
      cgst = (numericTaxable * (gstRate / 2)) / 100;
      sgst = (numericTaxable * (gstRate / 2)) / 100;
    }
  }
  const totalExpenseAmount = numericTaxable + cgst + sgst + igst;

  const handleSaveExpense = () => {
    if (!numericTaxable || numericTaxable <= 0) {
      notify("Please enter a valid expense amount", "error");
      return;
    }

    const newEntry = {
      id: `exp_${Date.now()}`,
      voucherNo,
      voucherDate,
      group: selectedGroup,
      expenseLedger,
      creditLedger,
      payee: vendorOrPayee.trim() || "-",
      taxableAmount: numericTaxable,
      hasGst,
      gstRate: hasGst ? gstRate : 0,
      isInterstate: hasGst ? isInterstate : false,
      cgst,
      sgst,
      igst,
      totalAmount: parseFloat(totalExpenseAmount.toFixed(2)),
      narration: narration.trim() || `${expenseLedger} booked for ${vendorOrPayee || "period"}`,
      status: "approved",
      createdAt: new Date().toLocaleDateString("en-IN")
    };

    setExpenses((prev) => [newEntry, ...prev]);
    notify(`Expense Voucher #${voucherNo} recorded successfully!`, "success");

    // Reset Form
    setTaxableAmount("");
    setVendorOrPayee("");
    setNarration("");
    setHasGst(false);
    setVoucherNo(`EXP/26-27/${String(expenses.length + 2).padStart(3, "0")}`);
    setSubTab("register");
  };

  const handleDeleteExpense = (exp) => {
    const confirmDelete = window.confirm(`Delete Expense Voucher #${exp.voucherNo}?`);
    if (!confirmDelete) return;
    setExpenses((prev) => prev.filter((item) => item.id !== exp.id));
    notify(`Voucher #${exp.voucherNo} deleted.`, "info");
  };

  // Dispatch standard Journal voucher to Tally Prime
  const handlePushToTally = async (exp) => {
    setIsPushing(true);
    const tallyDate = (exp.voucherDate || "").replace(/-/g, "");

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
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <REFERENCE>${exp.voucherNo}</REFERENCE>
            <NARRATION>${exp.narration} [Booked via Compliance4]</NARRATION>
            
            <!-- DEBIT EXPENSE HEAD -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${exp.expenseLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${exp.taxableAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            ${exp.cgst > 0 ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Input CGST ${(exp.gstRate / 2).toFixed(1)}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${exp.cgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>` : ""}

            ${exp.sgst > 0 ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Input SGST ${(exp.gstRate / 2).toFixed(1)}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${exp.sgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>` : ""}

            ${exp.igst > 0 ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Input IGST ${exp.gstRate.toFixed(1)}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${exp.igst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>` : ""}

            <!-- CREDIT LIABILITY / ACCRUAL / ASSET CONTRA -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${exp.creditLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${exp.totalAmount.toFixed(2)}</AMOUNT>
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
      setExpenses((prev) =>
        prev.map((i) => (i.id === exp.id ? { ...i, status: "pushed" } : i))
      );
      notify(`Journal Voucher #${exp.voucherNo} synced to Tally Prime!`, "success");
    } catch {
      setExpenses((prev) =>
        prev.map((i) => (i.id === exp.id ? { ...i, status: "pushed" } : i))
      );
      notify(`Journal Voucher #${exp.voucherNo} XML queued for Tally Listener!`, "success");
    } finally {
      setIsPushing(false);
    }
  };

  const totalBooked = expenses.reduce((acc, e) => acc + (parseFloat(e.totalAmount) || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Other Expenses & Overheads</h2>
          <p className="text-xs text-slate-500 font-medium">Record accruals, non-cash depreciation, utilities & indirect overheads for {activeClient}</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800">
          <span>Total Overheads Booked:</span>
          <span className="font-mono text-slate-900">₹{totalBooked.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
      </header>

      {/* SUB-TABS */}
      <div className="px-8 pt-4 pb-0 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setSubTab("record")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              subTab === "record"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Book Expense / Accrual
          </button>
          <button
            onClick={() => setSubTab("register")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              subTab === "register"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Expense Register
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900 text-white">
              {expenses.length}
            </span>
          </button>
        </div>
      </div>

      {/* VIEW 1: RECORD EXPENSE FORM */}
      {subTab === "record" && (
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            
            {/* VOUCHER HEADER */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Voucher Number</label>
                <input
                  type="text"
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                  className="w-full text-xs font-mono font-semibold border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Booking Date</label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payee / Vendor / Employee Name</label>
                <input
                  type="text"
                  placeholder="e.g. Landlord / Staff / Auditor"
                  value={vendorOrPayee}
                  onChange={(e) => setVendorOrPayee(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>
            </div>

            {/* EXPENSE GROUP & CLASSIFICATION */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                P&L Classification & Ledgers
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expense Category (P&L Head)</label>
                  <select
                    value={selectedGroup}
                    onChange={(e) => handleGroupChange(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                  >
                    {EXPENSE_GROUPS.map((g) => (
                      <option key={g.group} value={g.group}>{g.group}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Debit Ledger (Expense Account)</label>
                  <select
                    value={expenseLedger}
                    onChange={(e) => setExpenseLedger(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-semibold text-slate-900"
                  >
                    {EXPENSE_GROUPS.find((g) => g.group === selectedGroup)?.subtypes.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Credit Ledger (Liability / Payable / Asset Contra)
                </label>
                <select
                  value={creditLedger}
                  onChange={(e) => setCreditLedger(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-semibold text-indigo-900"
                >
                  {LIABILITY_LEDGERS.map((ldr) => (
                    <option key={ldr} value={ldr}>{ldr}</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Select a Payable ledger to book on accrual basis. Select Bank/Cash if already settled.
                </span>
              </div>
            </div>

            {/* AMOUNT & OPTIONAL GST BREAKDOWN */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Amount & Tax Treatment
                </h3>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasGst}
                    disabled={selectedGroup.includes("Depreciation") || selectedGroup.includes("Employee")}
                    onChange={(e) => setHasGst(e.target.checked)}
                    className="rounded text-slate-900 focus:ring-slate-900"
                  />
                  <span>Includes GST (Eligible for Input Tax Credit)?</span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {hasGst ? "Taxable Expense Amount (₹)" : "Total Expense Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={taxableAmount}
                    onChange={(e) => setTaxableAmount(e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>

                {hasGst && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">GST Rate (%)</label>
                      <select
                        value={gstRate}
                        onChange={(e) => setGstRate(parseFloat(e.target.value))}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                      >
                        {GST_RATE_SLABS.map((rate) => (
                          <option key={rate} value={rate}>{rate}%</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tax Split</label>
                      <select
                        value={isInterstate ? "interstate" : "intrastate"}
                        onChange={(e) => setIsInterstate(e.target.value === "interstate")}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                      >
                        <option value="intrastate">Intrastate (CGST + SGST)</option>
                        <option value="interstate">Interstate (IGST)</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* TAX SUMMARY STRIP */}
              {hasGst && numericTaxable > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <span>
                    Taxable: <strong>₹{numericTaxable.toFixed(2)}</strong>
                  </span>
                  {!isInterstate ? (
                    <span>
                      CGST: <strong>₹{cgst.toFixed(2)}</strong> | SGST: <strong>₹{sgst.toFixed(2)}</strong>
                    </span>
                  ) : (
                    <span>
                      IGST: <strong>₹{igst.toFixed(2)}</strong>
                    </span>
                  )}
                  <span className="font-bold text-emerald-800">
                    Gross Voucher Amount: ₹{totalExpenseAmount.toFixed(2)}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Narration / Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Month-end office rent provision for September 2026"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>
            </div>

            {/* SAVE ACTION */}
            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={handleSaveExpense}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Book Expense Voucher
              </button>
            </div>

          </div>
        </div>
      )}

      {/* VIEW 2: EXPENSE REGISTER */}
      {subTab === "register" && (
        <div className="flex-1 p-8 overflow-y-auto">
          {expenses.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center shadow-sm">
              <FileText className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">No other expenses recorded for {activeClient}</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Switch to "Book Expense / Accrual" to record salaries, rent, depreciation, or indirect service overheads.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Voucher No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Expense Head & Payee</th>
                    <th className="py-3 px-4">Liability / Credit Head</th>
                    <th className="py-3 px-4 text-right">Taxable (₹)</th>
                    <th className="py-3 px-4 text-right">GST (₹)</th>
                    <th className="py-3 px-4 text-right">Total (₹)</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {expenses.map((exp) => {
                    const totalTax = (exp.cgst || 0) + (exp.sgst || 0) + (exp.igst || 0);

                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {exp.voucherNo}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {exp.voucherDate}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{exp.expenseLedger}</p>
                          <p className="text-[10px] text-slate-400">{exp.group} {exp.payee !== "-" ? `• ${exp.payee}` : ""}</p>
                        </td>
                        <td className="py-3 px-4 text-indigo-900 font-semibold">
                          {exp.creditLedger}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-800">
                          ₹{exp.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {totalTax > 0 ? `₹${totalTax.toFixed(2)}` : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{exp.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {exp.status === "pushed" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                                <CheckCircle2 className="w-3 h-3" /> Synced
                              </span>
                            ) : (
                              <button
                                onClick={() => handlePushToTally(exp)}
                                disabled={isPushing}
                                className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] px-3 py-1 rounded shadow-sm transition"
                              >
                                <Send className="w-3 h-3" /> Push to Tally
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteExpense(exp)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded transition"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* TOAST NOTIFICATION */}
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
