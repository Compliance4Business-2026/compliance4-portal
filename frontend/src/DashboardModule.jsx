import React, { useState, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  CreditCard, 
  DollarSign, 
  Building2, 
  ShieldCheck, 
  FileText, 
  Scale, 
  Layers,
  BarChart3,
  Calendar
} from "lucide-react";

export default function DashboardModule({ activeClient = "Pansuria Confectionery & Food" }) {
  // Pull all transactional stores scoped to activeClient
  const normalSales = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(`c4_normal_sales_invoices_${activeClient}`) || "[]");
    } catch {
      return [];
    }
  }, [activeClient]);

  const posJournals = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(`c4_pos_journals_${activeClient}`) || "[]");
    } catch {
      return [];
    }
  }, [activeClient]);

  const approvedBills = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(`c4_approved_bills_${activeClient}`) || "[]");
    } catch {
      return [];
    }
  }, [activeClient]);

  const pushedBills = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(`c4_pushed_bills_${activeClient}`) || "[]");
    } catch {
      return [];
    }
  }, [activeClient]);

  const unpushedExpenses = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(`c4_other_expenses_${activeClient}`) || "[]");
    } catch {
      return [];
    }
  }, [activeClient]);

  const pushedExpenses = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(`c4_other_expenses_pushed_${activeClient}`) || "[]");
    } catch {
      return [];
    }
  }, [activeClient]);

  const bankTransactions = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(`c4_bank_transactions_${activeClient}`) || "[]");
    } catch {
      return [];
    }
  }, [activeClient]);

  const bankPushed = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(`c4_bank_pushed_${activeClient}`) || "[]");
    } catch {
      return [];
    }
  }, [activeClient]);

  // Master Lists
  const allPurchases = useMemo(() => [...approvedBills, ...pushedBills], [approvedBills, pushedBills]);
  const allOverheads = useMemo(() => [...unpushedExpenses, ...pushedExpenses], [unpushedExpenses, pushedExpenses]);

  // Parse Date Helper to normalize any format
  const parseToDate = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!isNaN(s) && Number(s) > 20000 && Number(s) < 60000) {
      return new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
    }
    const parts = s.split(/[\/\-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
      const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return new Date(yr, parseInt(parts[1]) - 1, parts[0]);
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  // 1. HEADER 4 CORE KPI TOTALS (CURRENT MONTH / ACTIVE)
  const kpiData = useMemo(() => {
    // A. Revenue from Operations
    const normalRev = normalSales.reduce((acc, inv) => acc + (parseFloat(inv.taxableAmount) || 0), 0);
    const posRev = posJournals.reduce((acc, jv) => acc + (parseFloat(jv.totalTaxable) || 0), 0);
    const totalRevenue = normalRev + posRev;

    // Gross Sales inclusive of Tax
    const normalGross = normalSales.reduce((acc, inv) => acc + (parseFloat(inv.grandTotal) || 0), 0);
    const posGross = posJournals.reduce((acc, jv) => acc + (parseFloat(jv.totalDebits) || 0), 0);
    const totalGross = normalGross + posGross;

    // B. Total Costs (COGS Purchases + Indirect Overheads)
    const cogsPurchases = allPurchases.reduce((acc, b) => acc + (parseFloat(b.taxableAmount) || 0), 0);
    const indirectOverheads = allOverheads.reduce((acc, e) => acc + (parseFloat(e.taxableAmount || e.amount) || 0), 0);
    const totalCost = cogsPurchases + indirectOverheads;

    // C. Net Profit
    const netProfit = totalRevenue - totalCost;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // D. Accounts Payable (Sundry Creditors / Vendors & Unsettled Overheads)
    const totalVendorBills = allPurchases.reduce((acc, b) => acc + (parseFloat(b.grandTotal || b.taxableAmount) || 0), 0);
    const totalPayableOverheads = allOverheads.reduce((acc, e) => acc + (parseFloat(e.grandTotal || e.amount) || 0), 0);
    // Deduct vendor payments made via Banking
    const bankVendorPayments = [...bankTransactions, ...bankPushed]
      .filter((t) => t.type === "Payment" && (t.allocatedLedger || "").toLowerCase().includes("creditor"))
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const accountsPayable = Math.max(totalVendorBills + totalPayableOverheads - bankVendorPayments, 0);

    // E. Accounts Receivable (Sundry Debtors / B2B Unpaid & Aggregator Balances)
    const totalDebtorInvoices = normalSales.reduce((acc, inv) => acc + (parseFloat(inv.grandTotal) || 0), 0);
    const bankDebtorReceipts = [...bankTransactions, ...bankPushed]
      .filter((t) => t.type === "Receipt" && (t.allocatedLedger || "").toLowerCase().includes("debtor"))
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    // Uncollected aggregator balances from POS Journal DR
    const aggregatorReceivables = posJournals.reduce((acc, jv) => {
      const zDel = parseFloat(jv.dr?.zomatoDelivery) || 0;
      const sDel = parseFloat(jv.dr?.swiggyDelivery) || 0;
      return acc + zDel + sDel;
    }, 0);
    const accountsReceivable = Math.max(totalDebtorInvoices - bankDebtorReceipts + aggregatorReceivables, 0);

    return {
      totalRevenue,
      totalGross,
      netProfit,
      netMargin,
      accountsPayable,
      accountsReceivable,
      cogsPurchases,
      indirectOverheads,
      salesCount: normalSales.length + posJournals.length,
      purchaseCount: allPurchases.length,
      overheadCount: allOverheads.length
    };
  }, [normalSales, posJournals, allPurchases, allOverheads, bankTransactions, bankPushed]);

  // 2. PROFIT & LOSS STATEMENT CATEGORIES BREAKDOWN (PRESERVED 100%)
  const overheadsByCategory = useMemo(() => {
    const groups = {};
    allOverheads.forEach((e) => {
      const cat = e.group || "Administrative & General Expenses";
      const amt = parseFloat(e.taxableAmount || e.amount) || 0;
      groups[cat] = (groups[cat] || 0) + amt;
    });
    return groups;
  }, [allOverheads]);

  // 3. GST POSITION SUMMARY (PRESERVED 100%)
  const gstPosition = useMemo(() => {
    const outputTaxSales = normalSales.reduce((acc, inv) => acc + (parseFloat(inv.cgst || 0) + parseFloat(inv.sgst || 0) + parseFloat(inv.igst || 0)), 0)
      + posJournals.reduce((acc, jv) => acc + (parseFloat(jv.credits?.cgst25 || 0) + parseFloat(jv.credits?.sgst25 || 0)), 0);

    const itcPurchases = allPurchases.reduce((acc, b) => acc + (parseFloat(b.cgst || 0) + parseFloat(b.sgst || 0) + parseFloat(b.igst || 0)), 0);
    const itcOverheads = allOverheads.reduce((acc, e) => acc + (parseFloat(e.cgst || 0) + parseFloat(e.sgst || 0) + parseFloat(e.igst || 0)), 0);
    const totalEligibleItc = itcPurchases + itcOverheads;
    const netTaxSettlement = totalEligibleItc - outputTaxSales;

    return {
      outputTaxSales,
      totalEligibleItc,
      netTaxSettlement,
      salesCount: normalSales.length + posJournals.length
    };
  }, [normalSales, posJournals, allPurchases, allOverheads]);

  // 4. MONTH-WISE TREND GENERATOR (LAST 6 MONTHS: APR 2026 -> SEP 2026)
  const last6MonthsData = useMemo(() => {
    const months = [];
    const now = new Date(2026, 8, 28); // September 2026 anchor

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short" });
      const fullLabel = d.toLocaleString("en-US", { month: "long", year: "numeric" });
      months.push({ key, label, fullLabel, sales: 0, cost: 0, netProfit: 0 });
    }

    // Accumulate Sales
    normalSales.forEach((inv) => {
      const d = parseToDate(inv.invoiceDate || inv.date);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const match = months.find((m) => m.key === key);
        if (match) match.sales += parseFloat(inv.taxableAmount || 0);
      }
    });

    posJournals.forEach((jv) => {
      const d = parseToDate(jv.voucherDate);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const match = months.find((m) => m.key === key);
        if (match) match.sales += parseFloat(jv.totalTaxable || 0);
      }
    });

    // Accumulate Purchases / COGS
    allPurchases.forEach((b) => {
      const d = parseToDate(b.billDate || b.date || b.voucherDate);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const match = months.find((m) => m.key === key);
        if (match) match.cost += parseFloat(b.taxableAmount || 0);
      }
    });

    // Accumulate Overheads
    allOverheads.forEach((e) => {
      const d = parseToDate(e.voucherDate || e.date);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const match = months.find((m) => m.key === key);
        if (match) match.cost += parseFloat(e.taxableAmount || e.amount || 0);
      }
    });

    // Calculate Net Profit
    months.forEach((m) => {
      m.netProfit = m.sales - m.cost;
    });

    return months;
  }, [normalSales, posJournals, allPurchases, allOverheads]);

  // Max peak calculations for proportional SVG chart heights
  const maxSales = Math.max(...last6MonthsData.map((m) => m.sales), 1000);
  const maxCost = Math.max(...last6MonthsData.map((m) => m.cost), 1000);
  const maxAbsProfit = Math.max(...last6MonthsData.map((m) => Math.abs(m.netProfit)), 1000);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto font-sans">
      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        
        {/* ========================================================================= */}
        {/* HEADER: 4 KPI CARDS (REVENUE, NET PROFIT, ACCOUNTS PAYABLE, RECEIVABLE)   */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-4 gap-4">
          
          {/* CARD 1: REVENUE FROM OPERATIONS */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Revenue From Operations
                </span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 mt-2">
                ₹{kpiData.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium pt-3 mt-2 border-t border-slate-100">
              <span>Gross: ₹{kpiData.totalGross.toLocaleString("en-IN", { maximumFractionDigits: 0 })}[cite: 10]</span>
              <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-[10px]">
                {kpiData.salesCount} Bills / JVs[cite: 10]
              </span>
            </div>
          </div>

          {/* CARD 2: NET OPERATING PROFIT / (LOSS) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Net Operating Profit[cite: 10]
                </span>
                <span className={`p-1.5 rounded-lg ${kpiData.netProfit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                  {kpiData.netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </span>
              </div>
              <p className={`text-2xl font-black font-mono mt-2 ${kpiData.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                {kpiData.netProfit < 0 ? "-" : ""}₹{Math.abs(kpiData.netProfit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}[cite: 10]
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium pt-3 mt-2 border-t border-slate-100">
              <span>Net Margin:</span>
              <span className={`font-bold text-[10px] px-2 py-0.5 rounded ${kpiData.netProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {kpiData.netMargin.toFixed(1)}% NP[cite: 10]
              </span>
            </div>
          </div>

          {/* CARD 3: ACCOUNTS PAYABLE (SUNDRY CREDITORS) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Accounts Payable
                </span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <CreditCard className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 mt-2">
                ₹{kpiData.accountsPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium pt-3 mt-2 border-t border-slate-100">
              <span>Sundry Creditors</span>
              <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">
                {kpiData.purchaseCount + kpiData.overheadCount} Vouchers
              </span>
            </div>
          </div>

          {/* CARD 4: ACCOUNTS RECEIVABLE (SUNDRY DEBTORS) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Accounts Receivable
                </span>
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <ArrowDownRight className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-slate-900 mt-2">
                ₹{kpiData.accountsReceivable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium pt-3 mt-2 border-t border-slate-100">
              <span>Sundry Debtors & Aggregators</span>
              <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded text-[10px]">
                Pending Collection
              </span>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* MIDDLE: STATEMENT OF PROFIT AND LOSS (100% PRESERVED & UNCHANGED)          */}
        {/* ========================================================================= */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Statement of Profit and Loss (September 2026 (Current Month))[cite: 10]
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Grouped strictly by Client's Uploaded COA[cite: 10]
            </span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-6">Schedule / Category Name[cite: 10]</th>
                <th className="py-2.5 px-6">Type[cite: 10]</th>
                <th className="py-2.5 px-6 text-right">Amount (₹)[cite: 10]</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {/* REVENUE */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-6 font-bold text-slate-900">I. Revenue from Operations (Net Sales)[cite: 10]</td>
                <td className="py-3 px-6 font-mono text-slate-400 text-[11px]">Sales Register[cite: 10]</td>
                <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">
                  ₹{kpiData.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}[cite: 10]
                </td>
              </tr>

              {/* COGS */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-6 pl-10 text-slate-600">Less: Cost of Goods Sold / Purchases (COGS)[cite: 10]</td>
                <td className="py-2.5 px-6 font-mono text-slate-400 text-[11px]">Purchase Register[cite: 10]</td>
                <td className="py-2.5 px-6 text-right font-mono text-rose-600">
                  -₹{kpiData.cogsPurchases.toLocaleString("en-IN", { minimumFractionDigits: 2 })}[cite: 10]
                </td>
              </tr>

              {/* GROSS PROFIT */}
              <tr className="bg-slate-50/80 font-bold border-y border-slate-200">
                <td className="py-3 px-6 text-slate-900 font-black">GROSS PROFIT (I – COGS)[cite: 10]</td>
                <td className="py-3 px-6 font-mono text-indigo-700 text-xs">
                  {kpiData.totalRevenue > 0 ? (((kpiData.totalRevenue - kpiData.cogsPurchases) / kpiData.totalRevenue) * 100).toFixed(1) : 0}% GP[cite: 10]
                </td>
                <td className="py-3 px-6 text-right font-mono font-black text-slate-900">
                  ₹{(kpiData.totalRevenue - kpiData.cogsPurchases).toLocaleString("en-IN", { minimumFractionDigits: 2 })}[cite: 10]
                </td>
              </tr>

              {/* INDIRECT OVERHEADS HEADER */}
              <tr className="bg-white">
                <td colSpan="3" className="py-2.5 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  II. Indirect Operating Expenses (Client-Defined P&L Heads)[cite: 10]
                </td>
              </tr>

              {/* DYNAMIC CATEGORIES ACCUMULATED FROM OVERHEADS */}
              {Object.keys(overheadsByCategory).length === 0 ? (
                <tr>
                  <td className="py-2 px-6 pl-10 text-slate-500 italic">No indirect overheads booked[cite: 10]</td>
                  <td className="py-2 px-6 font-mono text-slate-400 text-[11px]">Uploaded COA[cite: 10]</td>
                  <td className="py-2 px-6 text-right font-mono text-slate-400">₹0.00[cite: 10]</td>
                </tr>
              ) : (
                Object.entries(overheadsByCategory).map(([cat, amt]) => (
                  <tr key={cat} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-6 pl-10 text-slate-700 font-semibold">{cat}[cite: 10]</td>
                    <td className="py-2.5 px-6 font-mono text-slate-400 text-[11px]">Uploaded COA[cite: 10]</td>
                    <td className="py-2.5 px-6 text-right font-mono text-rose-600 font-medium">
                      -₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}[cite: 10]
                    </td>
                  </tr>
                ))
              )}

              {/* TOTAL INDIRECT EXPENSES */}
              <tr className="border-t border-slate-100 font-semibold text-slate-700">
                <td className="py-2.5 px-6 text-slate-800">Total Indirect Expenses[cite: 10]</td>
                <td className="py-2.5 px-6 text-slate-400">-</td>
                <td className="py-2.5 px-6 text-right font-mono text-rose-600 font-bold">
                  -₹{kpiData.indirectOverheads.toLocaleString("en-IN", { minimumFractionDigits: 2 })}[cite: 10]
                </td>
              </tr>
            </tbody>
            <tfoot>
              {/* NET OPERATING PROFIT / LOSS BANNER */}
              <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-900">
                <td className="py-4 px-6 text-sm font-black uppercase tracking-wider">
                  NET OPERATING PROFIT / (LOSS)[cite: 10]
                </td>
                <td className="py-4 px-6 font-mono text-emerald-400 text-xs">
                  {kpiData.netMargin.toFixed(1)}% NP Margin[cite: 10]
                </td>
                <td className="py-4 px-6 text-right font-mono font-black text-base text-emerald-400">
                  {kpiData.netProfit < 0 ? "-" : ""}₹{Math.abs(kpiData.netProfit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}[cite: 10]
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* GST POSITION SUMMARY STRIP (PRESERVED) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                GST Position Summary (GSTR-3B Preliminary – September 2026 (Current Month))[cite: 10]
              </h4>
            </div>
            <span className="text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
              Net ITC Carry-Forward: ₹{Math.max(gstPosition.netTaxSettlement, 0).toFixed(2)}[cite: 10]
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Output Tax (Sales)[cite: 10]</span>
              <p className="text-base font-black font-mono text-slate-900 mt-1">
                ₹{gstPosition.outputTaxSales.toFixed(2)}[cite: 10]
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{gstPosition.salesCount} Invoices[cite: 10]</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Total Eligible ITC[cite: 10]</span>
              <p className="text-base font-black font-mono text-slate-900 mt-1">
                ₹{gstPosition.totalEligibleItc.toFixed(2)}[cite: 10]
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Purchases + Eligible Overheads[cite: 10]</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Net Tax Settlement[cite: 10]</span>
              <p className="text-base font-black font-mono text-indigo-700 mt-1">
                ₹{gstPosition.netTaxSettlement.toFixed(2)}[cite: 10]
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Available to set off against future sales[cite: 10]</p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM: 3 ANALYTICAL TREND GRAPHS (LAST 6 MONTHS)                        */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-3 gap-6 pt-2">
          
          {/* GRAPH 1: SALES OF LAST 6 MONTHS */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-emerald-600" /> Revenue / Sales Trend
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Last 6 Months (Apr '26 - Sep '26)</p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                ₹{last6MonthsData.reduce((acc, m) => acc + m.sales, 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* BAR CHART AREA */}
            <div className="pt-6 pb-2 flex items-end justify-between h-44 gap-2 px-2">
              {last6MonthsData.map((m) => {
                const heightPct = Math.max(Math.round((m.sales / maxSales) * 100), 6);
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <span className="text-[9px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                      ₹{m.sales >= 1000 ? `${(m.sales / 1000).toFixed(1)}k` : m.sales}
                    </span>
                    <div 
                      style={{ height: `${heightPct}%` }}
                      className="w-full max-w-[28px] bg-emerald-500 hover:bg-emerald-600 rounded-t transition-all shadow-xs"
                      title={`${m.fullLabel}: ₹${m.sales.toFixed(2)}`}
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GRAPH 2: TOTAL COST OF LAST 6 MONTHS (COGS + OVERHEADS) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-amber-600" /> Total Cost Trend
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Purchases (COGS) + Overheads</p>
              </div>
              <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                ₹{last6MonthsData.reduce((acc, m) => acc + m.cost, 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* BAR CHART AREA */}
            <div className="pt-6 pb-2 flex items-end justify-between h-44 gap-2 px-2">
              {last6MonthsData.map((m) => {
                const heightPct = Math.max(Math.round((m.cost / maxCost) * 100), 6);
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <span className="text-[9px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                      ₹{m.cost >= 1000 ? `${(m.cost / 1000).toFixed(1)}k` : m.cost}
                    </span>
                    <div 
                      style={{ height: `${heightPct}%` }}
                      className="w-full max-w-[28px] bg-amber-500 hover:bg-amber-600 rounded-t transition-all shadow-xs"
                      title={`${m.fullLabel}: ₹${m.cost.toFixed(2)}`}
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GRAPH 3: NET PROFIT / LOSS OF LAST 6 MONTHS */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-indigo-600" /> Net Profit Trend
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Bottom-line Earnings per Month</p>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                kpiData.netProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}>
                {last6MonthsData.reduce((acc, m) => acc + m.netProfit, 0) >= 0 ? "+" : ""}
                ₹{last6MonthsData.reduce((acc, m) => acc + m.netProfit, 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* BAR CHART AREA WITH POSITIVE/NEGATIVE DYNAMICS */}
            <div className="pt-6 pb-2 flex items-end justify-between h-44 gap-2 px-2">
              {last6MonthsData.map((m) => {
                const isPositive = m.netProfit >= 0;
                const heightPct = Math.max(Math.round((Math.abs(m.netProfit) / maxAbsProfit) * 100), 6);
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <span className={`text-[9px] font-mono opacity-0 group-hover:opacity-100 transition whitespace-nowrap ${
                      isPositive ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {m.netProfit < 0 ? "-" : ""}₹{Math.abs(m.netProfit) >= 1000 ? `${(Math.abs(m.netProfit) / 1000).toFixed(1)}k` : Math.abs(m.netProfit)}
                    </span>
                    <div 
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[28px] rounded-t transition-all shadow-xs ${
                        isPositive 
                          ? "bg-emerald-500 hover:bg-emerald-600" 
                          : "bg-rose-500 hover:bg-rose-600"
                      }`}
                      title={`${m.fullLabel}: ₹${m.netProfit.toFixed(2)}`}
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
