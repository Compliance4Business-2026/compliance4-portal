import React, { useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  CreditCard, 
  ShieldCheck, 
  Calendar, 
  Layers,
  PieChart as PieIcon,
  CheckCircle2,
  DollarSign
} from "lucide-react";

export default function DashboardModule({ activeClient = "Panasuria Confectionery" }) {
  // 1. Invoiced Sales
  const salesInvoices = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_normal_sales_invoices_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  // 2. Direct Purchases (COGS)
  const purchaseBills = useMemo(() => {
    try {
      const approved = JSON.parse(localStorage.getItem(`c4_approved_bills_${activeClient}`) || "[]");
      const pushed = JSON.parse(localStorage.getItem(`c4_pushed_bills_${activeClient}`) || "[]");
      return [...approved, ...pushed];
    } catch {
      return [];
    }
  }, [activeClient]);

  // 3. Other Expenses & Indirect Overheads
  const otherExpenses = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_other_expenses_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  // 4. Bank Transactions
  const bankTransactions = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(`c4_bank_transactions_${activeClient}`) || "[]");
      const approved = JSON.parse(localStorage.getItem(`c4_bank_approved_${activeClient}`) || "[]");
      const pushed = JSON.parse(localStorage.getItem(`c4_bank_pushed_${activeClient}`) || "[]");
      return [...raw, ...approved, ...pushed];
    } catch {
      return [];
    }
  }, [activeClient]);

  // --- REVENUE & TAX CALCULATIONS ---
  const totalSalesTaxable = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.taxableAmount) || 0), 0);
  const totalOutputCgst = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.cgst) || 0), 0);
  const totalOutputSgst = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.sgst) || 0), 0);
  const totalOutputIgst = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.igst) || 0), 0);
  const totalOutputTax = totalOutputCgst + totalOutputSgst + totalOutputIgst;
  const totalGrossSales = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.grandTotal) || 0), 0);

  // --- COGS / DIRECT PURCHASES ---
  const totalPurchaseTaxable = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.taxableAmount || b.taxable) || 0), 0);
  const totalInputCgstPurchases = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.cgst) || 0), 0);
  const totalInputSgstPurchases = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.sgst) || 0), 0);
  const totalInputIgstPurchases = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.igst) || 0), 0);

  // --- OTHER EXPENSES CLASSIFICATION ---
  const expenseBreakdown = useMemo(() => {
    const summary = {
      "Employee Benefit Expenses": 0,
      "Rent & Occupancy Costs": 0,
      "Administrative & Professional Overheads": 0,
      "Selling & Marketing Expenses": 0,
      "Finance & Banking Charges": 0,
      "Depreciation & Non-Cash Book Entries": 0
    };
    let expenseCgst = 0, expenseSgst = 0, expenseIgst = 0;

    otherExpenses.forEach((exp) => {
      const netCost = parseFloat(exp.taxableAmount) || 0;
      if (summary[exp.group] !== undefined) {
        summary[exp.group] += netCost;
      } else {
        summary["Administrative & Professional Overheads"] += netCost;
      }
      expenseCgst += parseFloat(exp.cgst) || 0;
      expenseSgst += parseFloat(exp.sgst) || 0;
      expenseIgst += parseFloat(exp.igst) || 0;
    });

    const totalIndirectOverheads = Object.values(summary).reduce((a, b) => a + b, 0);
    return { summary, totalIndirectOverheads, expenseCgst, expenseSgst, expenseIgst };
  }, [otherExpenses]);

  // Total Input Tax Credit (Purchases + Eligible Services)
  const grandTotalInputTax = 
    (totalInputCgstPurchases + expenseBreakdown.expenseCgst) +
    (totalInputSgstPurchases + expenseBreakdown.expenseSgst) +
    (totalInputIgstPurchases + expenseBreakdown.expenseIgst);

  // Profitability Figures
  const grossProfit = totalSalesTaxable - totalPurchaseTaxable;
  const grossProfitMargin = totalSalesTaxable > 0 ? (grossProfit / totalSalesTaxable) * 100 : 0;

  const netProfit = grossProfit - expenseBreakdown.totalIndirectOverheads;
  const netProfitMargin = totalSalesTaxable > 0 ? (netProfit / totalSalesTaxable) * 100 : 0;

  // Net GST Liability
  const netGstPayable = totalOutputTax - grandTotalInputTax;
  const isGstPayable = netGstPayable >= 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Executive Dashboard & P&L Statement</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-500 font-medium">{activeClient}</p>
            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold border border-slate-200">
              FY 2026–27
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Accrual Statutory Books</span>
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* TOP 4 FINANCIAL METRIC CARDS */}
        <div className="grid grid-cols-4 gap-5">
          {/* NET REVENUE */}
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

          {/* GROSS PROFIT */}
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

          {/* OPERATING OVERHEADS */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Indirect Operating Overheads</span>
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ₹{expenseBreakdown.totalIndirectOverheads.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
              <span>{otherExpenses.length} Expense Vouchers</span>
              <span className="font-semibold text-slate-700">Salary, Rent, Depr.</span>
            </div>
          </div>

          {/* NET PROFIT / EBITDA */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Profit / EBITDA</span>
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

        {/* FULL AUDIT-READY PROFIT & LOSS STATEMENT */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-slate-900" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Statement of Profit and Loss (Managerial & Statutory)
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">All figures net of taxes (Taxable Base)</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-6">Particulars / Schedule Head</th>
                <th className="py-3 px-4 text-center">Reference</th>
                <th className="py-3 px-6 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {/* REVENUE */}
              <tr className="bg-slate-50/40">
                <td className="py-3 px-6 font-bold text-slate-900">I. Revenue from Operations (Net Sales)</td>
                <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">Sales Register</td>
                <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">
                  ₹{totalSalesTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* COGS */}
              <tr>
                <td className="py-3 px-6 text-slate-700 pl-10">Less: Cost of Materials Consumed / Purchases (COGS)</td>
                <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">Purchase Register</td>
                <td className="py-3 px-6 text-right font-mono text-rose-700">
                  -₹{totalPurchaseTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* GROSS PROFIT STRIP */}
              <tr className="bg-indigo-50/40 font-bold border-t border-b border-indigo-100">
                <td className="py-3 px-6 text-indigo-950 font-black">GROSS PROFIT (I - COGS)</td>
                <td className="py-3 px-4 text-center text-indigo-700 text-[10.5px]">{grossProfitMargin.toFixed(1)}% GP</td>
                <td className="py-3 px-6 text-right font-mono font-black text-indigo-950">
                  ₹{grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* INDIRECT OVERHEADS BREAKDOWN */}
              <tr>
                <td colSpan="3" className="py-2.5 px-6 font-bold uppercase tracking-wider text-[10px] text-slate-400 bg-slate-50/70">
                  II. Indirect Operating Overheads & Expenses
                </td>
              </tr>
              {Object.entries(expenseBreakdown.summary).map(([grp, amt]) => (
                <tr key={grp} className="hover:bg-slate-50/60 transition">
                  <td className="py-2.5 px-6 pl-10 text-slate-600">{grp}</td>
                  <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">Accrual Module</td>
                  <td className="py-2.5 px-6 text-right font-mono text-slate-800">
                    {amt > 0 ? `-₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹0.00"}
                  </td>
                </tr>
              ))}

              {/* TOTAL OVERHEADS ROW */}
              <tr className="border-t border-slate-200 font-semibold bg-slate-50/40">
                <td className="py-2.5 px-6 pl-6 text-slate-800">Total Indirect Expenses</td>
                <td className="py-2.5 px-4 text-center text-slate-400">-</td>
                <td className="py-2.5 px-6 text-right font-mono font-bold text-rose-700">
                  -₹{expenseBreakdown.totalIndirectOverheads.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>

            {/* NET PROFIT FINAL ROW */}
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

        {/* GST COMPLIANCE SUMMARY (TABLE 3.1 & 4 WITH OTHER EXPENSES INTEGRATION) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                GST Position Summary (GSTR-3B Preliminary)
              </h3>
            </div>
            <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${isGstPayable ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-blue-50 text-blue-800 border border-blue-200"}`}>
              {isGstPayable ? `Estimated Net Cash Payable: ₹${netGstPayable.toFixed(2)}` : `Net ITC Carry-Forward: ₹${Math.abs(netGstPayable).toFixed(2)}`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-6 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Output Tax Liability (Sales)</span>
              <p className="text-lg font-black font-mono text-slate-900">₹{totalOutputTax.toFixed(2)}</p>
              <p className="text-[10px] text-slate-500">From {salesInvoices.length} outward tax invoices</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Eligible ITC (Purchases + Services)</span>
              <p className="text-lg font-black font-mono text-emerald-700">₹{grandTotalInputTax.toFixed(2)}</p>
              <p className="text-[10px] text-slate-500">Purchases: ₹{(totalInputCgstPurchases + totalInputSgstPurchases + totalInputIgstPurchases).toFixed(0)} | Services: ₹{(expenseBreakdown.expenseCgst + expenseBreakdown.expenseSgst + expenseBreakdown.expenseIgst).toFixed(0)}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Net Tax Settlement</span>
              <p className={`text-lg font-black font-mono ${isGstPayable ? "text-amber-700" : "text-blue-700"}`}>
                ₹{Math.abs(netGstPayable).toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-500">{isGstPayable ? "To be paid via Electronic Cash Ledger" : "Available to set off against future sales"}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
