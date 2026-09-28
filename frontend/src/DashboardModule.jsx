import React, { useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  ArrowDownRight, 
  Scale, 
  Activity
} from "lucide-react";

export default function DashboardModule({ activeClient = "Pansuria Confectionery & Food" }) {
  // STRICT CLIENT DATA EXTRACTION (ONLY from activeClient)
  const clientCoa = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_coa_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  const normalSales = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_normal_sales_invoices_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  const posJournals = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_pos_journals_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  const approvedBills = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_approved_bills_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  const pushedBills = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_pushed_bills_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  const unpushedExpenses = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_other_expenses_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  const pushedExpenses = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_other_expenses_pushed_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  const bankTransactions = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_bank_transactions_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  const bankPushed = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_bank_pushed_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  const allPurchases = useMemo(() => [...approvedBills, ...pushedBills], [approvedBills, pushedBills]);
  const allOverheads = useMemo(() => [...unpushedExpenses, ...pushedExpenses], [unpushedExpenses, pushedExpenses]);

  // Date parser
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

  // CHECK COA EXPLICIT COLUMN: cogsClassification === "COGS"
  const isExplicitCogsLedger = (ledgerName, coaList) => {
    if (!ledgerName) return true;
    const clean = ledgerName.trim().toLowerCase();
    const matched = coaList.find((l) => l.name.trim().toLowerCase() === clean);

    if (matched) {
      // Direct user-chosen flag from COA
      if (matched.cogsClassification === "COGS") return true;
      if (matched.cogsClassification === "Indirect") return false;

      // Fallback if not yet explicitly saved on this ledger
      const cat = (matched.category || "").toLowerCase();
      if (
        cat.includes("cogs") ||
        cat.includes("cost of goods") ||
        cat.includes("direct") ||
        cat.includes("raw material")
      ) {
        return true;
      }
      return false;
    }

    // Default heuristics if ledger is not found in COA
    const isIndirect = 
      clean.includes("stationery") ||
      clean.includes("marketing") ||
      clean.includes("advertisement") ||
      clean.includes("printing") ||
      clean.includes("repair") ||
      clean.includes("software") ||
      clean.includes("audit") ||
      clean.includes("legal") ||
      clean.includes("rent");

    return !isIndirect;
  };

  const getCategoryForLedger = (ledgerName, coaList) => {
    if (!ledgerName) return "Administrative & General Expenses";
    const clean = ledgerName.trim().toLowerCase();
    const matched = coaList.find((l) => l.name.trim().toLowerCase() === clean);
    if (matched && matched.category) {
      return matched.category;
    }
    if (clean.includes("marketing") || clean.includes("advertisement")) {
      return "Selling & Distribution Expenses";
    }
    if (clean.includes("repair") || clean.includes("maintenance")) {
      return "Repairs & Maintenance";
    }
    return "Administrative & General Expenses";
  };

  // P&L SCHEDULE CLASSIFICATION
  const plBreakdown = useMemo(() => {
    let directCogs = 0;
    const indirectCategories = {};

    // 1. Process Purchase Register line by line
    allPurchases.forEach((bill) => {
      const lines = bill.accounting_ledgers || bill.items || [];
      if (lines.length > 0) {
        lines.forEach((line) => {
          const lName = line.ledger_name || line.ledger || "";
          const amt = parseFloat(line.amount) || 0;

          if (isExplicitCogsLedger(lName, clientCoa)) {
            directCogs += amt;
          } else {
            const cat = getCategoryForLedger(lName, clientCoa);
            indirectCategories[cat] = (indirectCategories[cat] || 0) + amt;
          }
        });
      } else {
        const bAmt = parseFloat(bill.taxableAmount) || 0;
        directCogs += bAmt;
      }
    });

    // 2. Process Other Expenses vouchers
    allOverheads.forEach((exp) => {
      const cat = exp.group || "Administrative & General Expenses";
      const amt = parseFloat(exp.taxableAmount || exp.amount) || 0;
      indirectCategories[cat] = (indirectCategories[cat] || 0) + amt;
    });

    const totalIndirect = Object.values(indirectCategories).reduce((acc, v) => acc + v, 0);

    return {
      directCogs,
      indirectCategories,
      totalIndirect
    };
  }, [allPurchases, allOverheads, clientCoa]);

  // TOP 4 KPI CALCULATIONS
  const kpiData = useMemo(() => {
    const normalRev = normalSales.reduce((acc, inv) => acc + (parseFloat(inv.taxableAmount) || 0), 0);
    const posRev = posJournals.reduce((acc, jv) => acc + (parseFloat(jv.totalTaxable) || 0), 0);
    const totalRevenue = normalRev + posRev;

    const normalGross = normalSales.reduce((acc, inv) => acc + (parseFloat(inv.grandTotal) || 0), 0);
    const posGross = posJournals.reduce((acc, jv) => acc + (parseFloat(jv.totalDebits) || 0), 0);
    const totalGross = normalGross + posGross;

    const totalCost = plBreakdown.directCogs + plBreakdown.totalIndirect;
    const netProfit = totalRevenue - totalCost;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const totalVendorBills = allPurchases.reduce((acc, b) => acc + (parseFloat(b.grandTotal || b.taxableAmount) || 0), 0);
    const totalPayableOverheads = allOverheads.reduce((acc, e) => acc + (parseFloat(e.grandTotal || e.amount) || 0), 0);
    const bankVendorPayments = [...bankTransactions, ...bankPushed]
      .filter((t) => t.type === "Payment" && (t.allocatedLedger || "").toLowerCase().includes("creditor"))
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const accountsPayable = Math.max(totalVendorBills + totalPayableOverheads - bankVendorPayments, 0);

    const totalDebtorInvoices = normalSales.reduce((acc, inv) => acc + (parseFloat(inv.grandTotal) || 0), 0);
    const bankDebtorReceipts = [...bankTransactions, ...bankPushed]
      .filter((t) => t.type === "Receipt" && (t.allocatedLedger || "").toLowerCase().includes("debtor"))
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

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
      salesCount: normalSales.length + posJournals.length
    };
  }, [normalSales, posJournals, allPurchases, allOverheads, bankTransactions, bankPushed, plBreakdown]);

  // LAST 6 MONTHS TREND
  const last6MonthsData = useMemo(() => {
    const months = [];
    const now = new Date(2026, 8, 28);

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short" });
      months.push({ key, label, sales: 0, cost: 0, netProfit: 0 });
    }

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

    allPurchases.forEach((b) => {
      const d = parseToDate(b.billDate || b.date || b.voucherDate);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const match = months.find((m) => m.key === key);
        if (match) match.cost += parseFloat(b.taxableAmount || 0);
      }
    });

    allOverheads.forEach((e) => {
      const d = parseToDate(e.voucherDate || e.date);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const match = months.find((m) => m.key === key);
        if (match) match.cost += parseFloat(e.taxableAmount || e.amount || 0);
      }
    });

    months.forEach((m) => {
      m.netProfit = m.sales - m.cost;
    });

    return months;
  }, [normalSales, posJournals, allPurchases, allOverheads]);

  const renderLineChart = (data, dataKey, strokeColor, fillColor) => {
    const width = 380;
    const height = 110;
    const padding = 16;

    const values = data.map((d) => d[dataKey]);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min = min > 0 ? 0 : min - 100;
      max = max > 0 ? max * 1.5 : 100;
    }
    const range = max - min || 1;

    const points = data.map((d, idx) => {
      const x = padding + (idx / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((d[dataKey] - min) / range) * (height - 2 * padding);
      return { x, y, val: d[dataKey], label: d.label };
    });

    const pathD = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, "");
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`;

    return (
      <div className="w-full flex flex-col justify-end mt-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#grad-${dataKey})`} />
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={strokeColor} strokeWidth="2" />
          ))}
        </svg>
        <div className="flex justify-between px-2 pt-1 text-[10px] font-bold text-slate-400 uppercase">
          {data.map((d) => (
            <span key={d.key}>{d.label}</span>
          ))}
        </div>
      </div>
    );
  };

  const grossProfit = kpiData.totalRevenue - plBreakdown.directCogs;
  const grossMargin = kpiData.totalRevenue > 0 ? (grossProfit / kpiData.totalRevenue) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto p-6 font-sans">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-4">
        
        {/* 1. TOP: 4 KPI CARDS */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Revenue From Operations
              </span>
              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black font-mono text-slate-900 mt-2">
              ₹{kpiData.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 mt-2 border-t border-slate-100">
              <span>Gross: ₹{kpiData.totalGross.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-[10px]">
                {kpiData.salesCount} Bills / JVs
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Net Operating Profit
              </span>
              <span className={`p-2 rounded-lg ${kpiData.netProfit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                {kpiData.netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </span>
            </div>
            <p className={`text-2xl font-black font-mono mt-2 ${kpiData.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
              {kpiData.netProfit < 0 ? "-" : ""}₹{Math.abs(kpiData.netProfit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 mt-2 border-t border-slate-100">
              <span>Margin:</span>
              <span className={`font-bold text-[10px] px-2 py-0.5 rounded ${kpiData.netProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {kpiData.netMargin.toFixed(1)}% NP
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Accounts Payable
              </span>
              <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <CreditCard className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black font-mono text-slate-900 mt-2">
              ₹{kpiData.accountsPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 mt-2 border-t border-slate-100">
              <span>Sundry Creditors</span>
              <span className="text-slate-500 font-semibold text-[10px]">Unpaid Outstandings</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Accounts Receivable
              </span>
              <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <ArrowDownRight className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black font-mono text-slate-900 mt-2">
              ₹{kpiData.accountsReceivable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 mt-2 border-t border-slate-100">
              <span>Debtors & Aggregators</span>
              <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded text-[10px]">
                Pending Collection
              </span>
            </div>
          </div>
        </div>

        {/* 2. MIDDLE: PROFIT AND LOSS STATEMENT */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Statement of Profit and Loss (Current Period)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Schedule III Classified by Client COA
            </span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-6">Schedule / Category Name</th>
                <th className="py-2.5 px-6">Type</th>
                <th className="py-2.5 px-6 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-xs">
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-6 font-bold text-slate-900">I. Revenue from Operations (Net Sales)</td>
                <td className="py-2.5 px-6 font-mono text-slate-400 text-[11px]">Sales Register</td>
                <td className="py-2.5 px-6 text-right font-mono font-bold text-slate-900">
                  ₹{kpiData.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* DIRECT COGS PURCHASES ONLY */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-6 pl-9 text-slate-600">Less: Cost of Goods Sold / Purchases (COGS)</td>
                <td className="py-2 px-6 font-mono text-slate-400 text-[11px]">COGS Tagged Purchases</td>
                <td className="py-2 px-6 text-right font-mono text-rose-600">
                  -₹{plBreakdown.directCogs.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* TRUE GROSS PROFIT */}
              <tr className="bg-slate-50/80 font-bold border-y border-slate-200">
                <td className="py-2.5 px-6 text-slate-900 font-black">GROSS PROFIT (I – COGS)</td>
                <td className="py-2.5 px-6 font-mono text-indigo-700 text-[11px]">
                  {grossMargin.toFixed(1)}% GP
                </td>
                <td className="py-2.5 px-6 text-right font-mono font-black text-slate-900">
                  ₹{grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>

              <tr className="bg-white">
                <td colSpan="3" className="py-1.5 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  II. Indirect Operating Expenses (Client P&L Heads)
                </td>
              </tr>

              {/* DYNAMIC COMBINED OVERHEADS */}
              {Object.keys(plBreakdown.indirectCategories).length === 0 ? (
                <tr>
                  <td className="py-1.5 px-6 pl-9 text-slate-400 italic">No indirect operating expenses recorded</td>
                  <td className="py-1.5 px-6 font-mono text-slate-400 text-[11px]">Uploaded COA</td>
                  <td className="py-1.5 px-6 text-right font-mono text-slate-400">₹0.00</td>
                </tr>
              ) : (
                Object.entries(plBreakdown.indirectCategories).map(([cat, amt]) => (
                  <tr key={cat} className="hover:bg-slate-50/50">
                    <td className="py-1.5 px-6 pl-9 text-slate-700">{cat}</td>
                    <td className="py-1.5 px-6 font-mono text-slate-400 text-[11px]">P&L Indirect Overhead</td>
                    <td className="py-1.5 px-6 text-right font-mono text-rose-600">
                      -₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}

              <tr className="border-t border-slate-100 font-semibold text-slate-700">
                <td className="py-2 px-6 text-slate-800">Total Indirect Expenses</td>
                <td className="py-2 px-6 text-slate-400">-</td>
                <td className="py-2 px-6 text-right font-mono text-rose-600 font-bold">
                  -₹{plBreakdown.totalIndirect.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="bg-slate-900 text-white font-bold text-xs px-6 py-3.5 flex items-center justify-between border-t-2 border-slate-900 shrink-0">
            <span className="font-black uppercase tracking-wider text-xs">
              NET OPERATING PROFIT / (LOSS)
            </span>
            <span className="font-mono text-emerald-400 text-xs">
              {kpiData.netMargin.toFixed(1)}% NP Margin
            </span>
            <span className="font-mono font-black text-base text-emerald-400">
              {kpiData.netProfit < 0 ? "-" : ""}₹{Math.abs(kpiData.netProfit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* 3. BOTTOM: 3 EXPANDED LINE GRAPHS (LAST 6 MONTHS) */}
        <div className="grid grid-cols-3 gap-4 shrink-0 pb-2">
          {/* GRAPH 1: SALES LINE GRAPH */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" /> Sales Trend Line
                </h4>
                <p className="text-[10px] text-slate-400">Monthly Turnover (Last 6 Months)</p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
                ₹{last6MonthsData.reduce((acc, m) => acc + m.sales, 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </div>
            {renderLineChart(last6MonthsData, "sales", "#10b981", "#10b981")}
          </div>

          {/* GRAPH 2: TOTAL COST LINE GRAPH */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-amber-600" /> Total Cost Trend Line
                </h4>
                <p className="text-[10px] text-slate-400">COGS Purchases + Overheads</p>
              </div>
              <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded">
                ₹{last6MonthsData.reduce((acc, m) => acc + m.cost, 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </div>
            {renderLineChart(last6MonthsData, "cost", "#f59e0b", "#f59e0b")}
          </div>

          {/* GRAPH 3: NET PROFIT LINE GRAPH */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-600" /> Net Profit Trend Line
                </h4>
                <p className="text-[10px] text-slate-400">Bottom-Line Margin per Month</p>
              </div>
              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded ${
                kpiData.netProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}>
                {last6MonthsData.reduce((acc, m) => acc + m.netProfit, 0) >= 0 ? "+" : ""}
                ₹{last6MonthsData.reduce((acc, m) => acc + m.netProfit, 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </div>
            {renderLineChart(last6MonthsData, "netProfit", "#6366f1", "#6366f1")}
          </div>
        </div>

      </div>
    </div>
  );
}
