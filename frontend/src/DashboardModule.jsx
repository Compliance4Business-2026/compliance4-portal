import React, { useState, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  CreditCard, 
  ShieldCheck, 
  Calendar, 
  Layers,
  DollarSign,
  Filter
} from "lucide-react";

export default function DashboardModule({ activeClient = "Panasuria Confectionery" }) {
  // Period Slicer: 'month' | 'quarter' | 'year' | 'custom'
  const [periodPreset, setPeriodPreset] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("2026-09-01");
  const [customEndDate, setCustomEndDate] = useState("2026-09-30");

  // Load Client Custom Chart of Accounts
  const clientCoa = useMemo(() => {
    try {
      const saved = localStorage.getItem(`c4_coa_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  // Determine Active Date Window
  const { dateFrom, dateTo, periodLabel } = useMemo(() => {
    const today = new Date(2026, 8, 27); // Sept 27, 2026
    const y = today.getFullYear();
    const m = today.getMonth();

    if (periodPreset === "month") {
      const start = new Date(y, m, 1).toISOString().split("T")[0];
      const end = new Date(y, m + 1, 0).toISOString().split("T")[0];
      return { dateFrom: start, dateTo: end, periodLabel: "September 2026 (Current Month)" };
    }
    if (periodPreset === "quarter") {
      const start = new Date(y, m - 2, 1).toISOString().split("T")[0];
      const end = new Date(y, m + 1, 0).toISOString().split("T")[0];
      return { dateFrom: start, dateTo: end, periodLabel: "Last 3 Months (Q2 FY 2026–27)" };
    }
    if (periodPreset === "year") {
      return { dateFrom: "2026-04-01", dateTo: "2027-03-31", periodLabel: "Full FY 2026–27 (1 Year)" };
    }
    return { dateFrom: customStartDate, dateTo: customEndDate, periodLabel: `Custom (${customStartDate} to ${customEndDate})` };
  }, [periodPreset, customStartDate, customEndDate]);

  const isDateInRange = (dateStr) => {
    if (!dateStr) return true;
    const clean = String(dateStr).trim().substring(0, 10);
    return clean >= dateFrom && clean <= dateTo;
  };

  // 1. Sales Invoices Filtered
  const salesInvoices = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem(`c4_normal_sales_invoices_${activeClient}`) || "[]");
      return data.filter((inv) => isDateInRange(inv.invoiceDate || inv.date));
    } catch {
      return [];
    }
  }, [activeClient, dateFrom, dateTo]);

  // 2. Direct Purchases (COGS) Filtered
  const purchaseBills = useMemo(() => {
    try {
      const approved = JSON.parse(localStorage.getItem(`c4_approved_bills_${activeClient}`) || "[]");
      const pushed = JSON.parse(localStorage.getItem(`c4_pushed_bills_${activeClient}`) || "[]");
      return [...approved, ...pushed].filter((b) => isDateInRange(b.billDate || b.date));
    } catch {
      return [];
    }
  }, [activeClient, dateFrom, dateTo]);

  // 3. Other Overheads Filtered
  const otherExpenses = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem(`c4_other_expenses_${activeClient}`) || "[]");
      return data.filter((e) => isDateInRange(e.voucherDate || e.date));
    } catch {
      return [];
    }
  }, [activeClient, dateFrom, dateTo]);

  // --- REVENUE CALCULATIONS ---
  const totalSalesTaxable = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.taxableAmount) || 0), 0);
  const totalOutputCgst = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.cgst) || 0), 0);
  const totalOutputSgst = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.sgst) || 0), 0);
  const totalOutputIgst = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.igst) || 0), 0);
  const totalOutputTax = totalOutputCgst + totalOutputSgst + totalOutputIgst;
  const totalGrossSales = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.grandTotal) || 0), 0);

  // --- DIRECT PURCHASES (COGS) ---
  const totalPurchaseTaxable = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.taxableAmount || b.taxable) || 0), 0);
  const totalInputCgstPurchases = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.cgst) || 0), 0);
  const totalInputSgstPurchases = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.sgst) || 0), 0);
  const totalInputIgstPurchases = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.igst) || 0), 0);

  // --- DYNAMIC P&L CATEGORY AGGREGATOR FROM CLIENT'S UPLOADED COA ---
  const dynamicExpenseBreakdown = useMemo(() => {
    // 1. Build lookup maps from user's custom COA
    const ledgerCategoryMap = {};
    const ledgerStatementTypeMap = {};

    clientCoa.forEach((item) => {
      ledgerCategoryMap[item.name.toLowerCase().trim()] = item.category;
      ledgerStatementTypeMap[item.name.toLowerCase().trim()] = item.statementType || "P&L";
    });

    const categoryTotals = {};
    let expenseCgst = 0, expenseSgst = 0, expenseIgst = 0;

    otherExpenses.forEach((exp) => {
      const ledgerName = (exp.expenseLedger || "").toLowerCase().trim();
      const statementNature = ledgerStatementTypeMap[ledgerName] || "P&L";

      // Include ONLY P&L tagged overheads in Profit & Loss
      if (statementNature === "Balance Sheet") return;

      const netCost = parseFloat(exp.taxableAmount) || 0;
      // Use exact user-defined category from uploaded COA
      const categoryName = ledgerCategoryMap[ledgerName] || exp.group || "Operational Expenses";

      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + netCost;

      expenseCgst += parseFloat(exp.cgst) || 0;
      expenseSgst += parseFloat(exp.sgst) || 0;
      expenseIgst += parseFloat(exp.igst) || 0;
    });

    const totalIndirectOverheads = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    return { categoryTotals, totalIndirectOverheads, expenseCgst, expenseSgst, expenseIgst };
  }, [otherExpenses, clientCoa]);

  // Overall Figures
  const grossProfit = totalSalesTaxable - totalPurchaseTaxable;
  const grossProfitMargin = totalSalesTaxable > 0 ? (grossProfit / totalSalesTaxable) * 100 : 0;

  const netProfit = grossProfit - dynamicExpenseBreakdown.totalIndirectOverheads;
  const netProfitMargin = totalSalesTaxable > 0 ? (netProfit / totalSalesTaxable) * 100 : 0;

  const grandTotalInputTax = 
    (totalInputCgstPurchases + dynamicExpenseBreakdown.expenseCgst) +
    (totalInputSgstPurchases + dynamicExpenseBreakdown.expenseSgst) +
    (totalInputIgstPurchases + dynamicExpenseBreakdown.expenseIgst);

  const netGstPayable = totalOutputTax - grandTotalInputTax;
  const isGstPayable = netGstPayable >= 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* HEADER SECTION WITH MULTI-PERIOD FILTER */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Executive Dashboard & P&L Statement</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-500 font-medium">{activeClient}</p>
            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold border border-slate-200">
              {periodLabel}
            </span>
          </div>
        </div>

        {/* PERIOD SLICER CONTROLS */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 rounded-lg">
          <button
            onClick={() => setPeriodPreset("month")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              periodPreset === "month" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            1 Month
          </button>

          <button
            onClick={() => setPeriodPreset("quarter")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              periodPreset === "quarter" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            3 Months
          </button>

          <button
            onClick={() => setPeriodPreset("year")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              periodPreset === "year" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Full FY (1 Year)
          </button>

          <button
            onClick={() => setPeriodPreset("custom")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              periodPreset === "custom" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Custom
          </button>
        </div>
      </header>

      {/* CUSTOM DATE PICKER STRIP (SHOWN WHEN 'CUSTOM' IS SELECTED) */}
      {periodPreset === "custom" && (
        <div className="bg-slate-100/70 border-b border-slate-200 px-8 py-2.5 flex items-center gap-4 text-xs font-semibold text-slate-700">
          <span>Date From:</span>
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 bg-white"
          />
          <span>Date To:</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 bg-white"
          />
        </div>
      )}

      {/* DASHBOARD CONTENT BODY */}
      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* FINANCIAL SUMMARY CARDS */}
        <div className="grid grid-cols-4 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Revenue from Operations</span>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ₹{totalSalesTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
              <span>Gross: ₹{totalGrossSales.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              <span className="font-semibold text-emerald-700">{salesInvoices.length} Bills</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Profit (COGS Deducted)</span>
              <div className={`p-2 rounded-lg ${grossProfit >= 0 ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-600"}`}>
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-2xl font-black font-mono ${grossProfit >= 0 ? "text-slate-900" : "text-rose-700"}`}>
              ₹{grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
              <span>COGS: ₹{totalPurchaseTaxable.toFixed(0)}</span>
              <span className="font-bold text-indigo-700">{grossProfitMargin.toFixed(1)}% GP</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Indirect Operating Overheads</span>
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ₹{dynamicExpenseBreakdown.totalIndirectOverheads.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
              <span>{otherExpenses.length} Vouchers</span>
              <span className="font-semibold text-slate-700">P&L Filtered Only</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Operating Profit</span>
              <div className={`p-2 rounded-lg ${netProfit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-2xl font-black font-mono ${netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              ₹{netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
              <span>Net Margin:</span>
              <span className={`font-bold ${netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {netProfitMargin.toFixed(1)}% NP
              </span>
            </div>
          </div>
        </div>

        {/* DYNAMIC PROFIT & LOSS STATEMENT (RENDERED DIRECTLY FROM USER'S COA CATEGORIES) */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-slate-900" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Statement of Profit and Loss ({periodLabel})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Grouped strictly by Client's Uploaded COA</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-6">Schedule / Category Name</th>
                <th className="py-3 px-4 text-center">Type</th>
                <th className="py-3 px-6 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              <tr className="bg-slate-50/40">
                <td className="py-3 px-6 font-bold text-slate-900">I. Revenue from Operations (Net Sales)</td>
                <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">Sales Register</td>
                <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">
                  ₹{totalSalesTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>

              <tr>
                <td className="py-3 px-6 text-slate-700 pl-10">Less: Cost of Goods Sold / Purchases (COGS)</td>
                <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">Purchase Register</td>
                <td className="py-3 px-6 text-right font-mono text-rose-700">
                  -₹{totalPurchaseTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>

              <tr className="bg-indigo-50/40 font-bold border-t border-b border-indigo-100">
                <td className="py-3 px-6 text-indigo-950 font-black">GROSS PROFIT (I - COGS)</td>
                <td className="py-3 px-4 text-center text-indigo-700 text-[10.5px]">{grossProfitMargin.toFixed(1)}% GP</td>
                <td className="py-3 px-6 text-right font-mono font-black text-indigo-950">
                  ₹{grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>

              <tr>
                <td colSpan="3" className="py-2.5 px-6 font-bold uppercase tracking-wider text-[10px] text-slate-400 bg-slate-50/70">
                  II. Indirect Operating Expenses (Client-Defined P&L Heads)
                </td>
              </tr>

              {Object.keys(dynamicExpenseBreakdown.categoryTotals).length === 0 ? (
                <tr>
                  <td colSpan="3" className="py-3 px-6 pl-10 text-slate-400 italic text-[11px]">
                    No indirect P&L overhead vouchers recorded for this period.
                  </td>
                </tr>
              ) : (
                Object.entries(dynamicExpenseBreakdown.categoryTotals).map(([categoryName, amt]) => (
                  <tr key={categoryName} className="hover:bg-slate-50/60 transition">
                    <td className="py-2.5 px-6 pl-10 text-slate-700 font-medium">{categoryName}</td>
                    <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">Uploaded COA</td>
                    <td className="py-2.5 px-6 text-right font-mono text-slate-800">
                      -₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}

              <tr className="border-t border-slate-200 font-semibold bg-slate-50/40">
                <td className="py-2.5 px-6 pl-6 text-slate-800">Total Indirect Expenses</td>
                <td className="py-2.5 px-4 text-center text-slate-400">-</td>
                <td className="py-2.5 px-6 text-right font-mono font-bold text-rose-700">
                  -₹{dynamicExpenseBreakdown.totalIndirectOverheads.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>

            <tfoot>
              <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-900">
                <td className="py-3.5 px-6 text-sm font-black tracking-wide">
                  NET OPERATING PROFIT / (LOSS)
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-emerald-400 text-xs">
                  {netProfitMargin.toFixed(1)}% NP Margin
                </td>
                <td className="py-3.5 px-6 text-right font-mono font-black text-base text-emerald-400">
                  ₹{netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* STATUTORY GST SUMMARY */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                GST Position Summary (GSTR-3B Preliminary - {periodLabel})
              </h3>
            </div>
            <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${isGstPayable ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-blue-50 text-blue-800 border border-blue-200"}`}>
              {isGstPayable ? `Estimated Cash Payable: ₹${netGstPayable.toFixed(2)}` : `Net ITC Carry-Forward: ₹${Math.abs(netGstPayable).toFixed(2)}`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-6 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Output Tax (Sales)</span>
              <p className="text-lg font-black font-mono text-slate-900">₹{totalOutputTax.toFixed(2)}</p>
              <p className="text-[10px] text-slate-500">{salesInvoices.length} Invoices</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Eligible ITC</span>
              <p className="text-lg font-black font-mono text-emerald-700">₹{grandTotalInputTax.toFixed(2)}</p>
              <p className="text-[10px] text-slate-500">Purchases + Eligible Overheads</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Net Tax Settlement</span>
              <p className={`text-lg font-black font-mono ${isGstPayable ? "text-amber-700" : "text-blue-700"}`}>
                ₹{Math.abs(netGstPayable).toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-500">{isGstPayable ? "Payable via Electronic Cash Ledger" : "Available to set off against future sales"}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
