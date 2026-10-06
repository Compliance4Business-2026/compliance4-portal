import React, { useState, useEffect, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  ArrowDownRight, 
  Scale, 
  Activity,
  Download,
  Calendar
} from "lucide-react";

export default function DashboardModule({ activeClient = "Pansuria Confectionery & Food" }) {
  const [selectedPeriod, setSelectedPeriod] = useState("September 2026");
  const [customStartDate, setCustomStartDate] = useState("2026-09-01");
  const [customEndDate, setCustomEndDate] = useState("2026-09-30");

  const [bills, setBills] = useState([]);
  const [salesRecords, setSalesRecords] = useState([]);
  const [expensesRecords, setExpensesRecords] = useState([]);
  const [clientCoa, setClientCoa] = useState([]);

  // --- FETCH DATA & CLIENT COA ---
  useEffect(() => {
    let isMounted = true;
    const API_BASE_URL = "https://compliance4-backend-1021821620394.asia-south1.run.app";

    async function fetchData() {
      if (!activeClient) return;
      try {
        const [billsRes, salesRes, expRes, coaRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/clients/${encodeURIComponent(activeClient)}/bills?stage=approved`).then(r => r.json()).catch(() => []),
          fetch(`${API_BASE_URL}/api/clients/${encodeURIComponent(activeClient)}/sales?status=approved`).then(r => r.json()).catch(() => []),
          fetch(`${API_BASE_URL}/api/clients/${encodeURIComponent(activeClient)}/expenses?status=approved`).then(r => r.json()).catch(() => []),
          fetch(`${API_BASE_URL}/api/clients/${encodeURIComponent(activeClient)}/coa`).then(r => r.json()).catch(() => [])
        ]);

        if (isMounted) {
          if (Array.isArray(billsRes)) setBills(billsRes);
          if (Array.isArray(salesRes)) setSalesRecords(salesRes);
          if (Array.isArray(expRes)) setExpensesRecords(expRes);
          if (Array.isArray(coaRes)) setClientCoa(coaRes);
        }
      } catch (err) {
        console.warn("API fetch error:", err);
      }

      // LocalStorage Fallback
      try {
        const localBills = JSON.parse(localStorage.getItem(`c4_approved_bills_${activeClient}`) || localStorage.getItem(`c4_pushed_bills_${activeClient}`) || "[]");
        const localSales = JSON.parse(localStorage.getItem(`c4_sales_${activeClient}`) || localStorage.getItem(`c4_normal_sales_invoices_${activeClient}`) || "[]");
        const localExp = JSON.parse(localStorage.getItem(`c4_other_expenses_${activeClient}`) || "[]");
        const localCoa = JSON.parse(localStorage.getItem(`c4_coa_${activeClient}`) || "[]");

        if (isMounted) {
          setBills(prev => prev.length > 0 ? prev : localBills);
          setSalesRecords(prev => prev.length > 0 ? prev : localSales);
          setExpensesRecords(prev => prev.length > 0 ? prev : localExp);
          setClientCoa(prev => prev.length > 0 ? prev : localCoa);
        }
      } catch (e) {
        console.error("Storage error:", e);
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, [activeClient]);

  const parseToDate = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!isNaN(s) && Number(s) > 20000 && Number(s) < 60000) {
      return new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
    }
    const d = new Date(s);
    return !isNaN(d.getTime()) ? d : null;
  };

  const isDateInPeriod = (rawDate) => {
    if (selectedPeriod === "All") return true;
    const d = parseToDate(rawDate);
    if (!d) return true;

    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;

    if (selectedPeriod === "September 2026") return yr === 2026 && mo === 9;
    if (selectedPeriod === "August 2026") return yr === 2026 && mo === 8;
    if (selectedPeriod === "July 2026") return yr === 2026 && mo === 7;
    if (selectedPeriod === "June 2026") return yr === 2026 && mo === 6;
    if (selectedPeriod === "May 2026") return yr === 2026 && mo === 5;
    if (selectedPeriod === "April 2026") return yr === 2026 && mo === 4;
    if (selectedPeriod === "FY2026-27") return (yr === 2026 && mo >= 4) || (yr === 2027 && mo <= 3);
    if (selectedPeriod === "FY2025-26") return (yr === 2025 && mo >= 4) || (yr === 2026 && mo <= 3);
    return true;
  };

  const filteredSales = useMemo(() => salesRecords.filter(s => isDateInPeriod(s.invoiceDate || s.date)), [salesRecords, selectedPeriod]);
  const filteredBills = useMemo(() => bills.filter(b => isDateInPeriod(b.billDate || b.invoice_date || b.date)), [bills, selectedPeriod]);
  const filteredExpenses = useMemo(() => expensesRecords.filter(e => isDateInPeriod(e.voucherDate || e.date)), [expensesRecords, selectedPeriod]);

  // --- STRICT COA NATURE & CATEGORY RESOLVER ---
  const getLedgerNatureAndCategory = (ledgerName) => {
    if (!ledgerName) return { nature: "Indirect", category: "Administrative Expenses" };
    const clean = ledgerName.trim().toLowerCase();

    // Match strictly against client COA
    const matched = clientCoa.find(l => l.name.trim().toLowerCase() === clean);
    if (matched) {
      const cat = (matched.category || "").toLowerCase();
      // COGS is STRICTLY Purchases or Direct Expenses category
      if (cat.includes("purchase") || cat.includes("direct") || cat.includes("cogs") || cat.includes("raw material")) {
        return { nature: "COGS", category: matched.category };
      }
      return { nature: "Indirect", category: matched.category || "Administrative Expenses" };
    }

    // Fallback keyword check if not explicitly found in COA
    if (clean.startsWith("purchase") || clean.includes("direct") || clean.includes("raw material")) {
      return { nature: "COGS", category: "Purchases" };
    }

    return { nature: "Indirect", category: "Administrative Expenses" };
  };

  // --- P&L BREAKDOWN (STRICT COA COMPLIANT) ---
  const plBreakdown = useMemo(() => {
    let directCogs = 0;
    const indirectCategories = {};

    filteredBills.forEach(b => {
      const lines = b.accounting_ledgers || b.items || [];
      if (lines.length > 0) {
        lines.forEach(l => {
          const lName = l.ledger_name || l.ledger || "";
          const amt = parseFloat(l.amount || 0);
          const { nature, category } = getLedgerNatureAndCategory(lName);

          if (nature === "COGS") {
            directCogs += amt;
          } else {
            indirectCategories[category] = (indirectCategories[category] || 0) + amt;
          }
        });
      } else {
        const amt = parseFloat(b.taxable_amount || b.taxableAmount || b.grand_total || 0);
        const lName = b.expense_ledger || "Purchases";
        const { nature, category } = getLedgerNatureAndCategory(lName);
        if (nature === "COGS") directCogs += amt;
        else indirectCategories[category] = (indirectCategories[category] || 0) + amt;
      }
    });

    filteredExpenses.forEach(e => {
      const lName = e.expenseLedger || e.ledger || "";
      const amt = parseFloat(e.amount || e.taxableAmount || 0);
      const { nature, category } = getLedgerNatureAndCategory(lName);

      if (nature === "COGS") {
        directCogs += amt;
      } else {
        indirectCategories[category] = (indirectCategories[category] || 0) + amt;
      }
    });

    const totalIndirect = Object.values(indirectCategories).reduce((a, b) => a + b, 0);
    return { directCogs, indirectCategories, totalIndirect };
  }, [filteredBills, filteredExpenses, clientCoa]);

  const kpiData = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + parseFloat(s.taxableAmount || s.grand_total || s.amount || 0), 0);
    const totalGross = filteredSales.reduce((acc, s) => acc + parseFloat(s.grandTotal || s.grand_total || s.amount || 0), 0);
    
    const totalCost = plBreakdown.directCogs + plBreakdown.totalIndirect;
    const netProfit = totalRevenue - totalCost;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const accountsPayable = filteredBills.reduce((acc, b) => acc + parseFloat(b.grand_total || b.grandTotal || 0), 0);
    const accountsReceivable = totalGross;

    return { totalRevenue, totalGross, netProfit, netMargin, accountsPayable, accountsReceivable, salesCount: filteredSales.length };
  }, [filteredSales, filteredBills, plBreakdown]);

  // --- DOWNLOAD CATEGORY-WISE P&L ---
  const handleDownloadDynamicPL = () => {
    const rows = [
      [`"STATEMENT OF PROFIT AND LOSS (${selectedPeriod})"`, "", ""],
      [`"Client:","${activeClient}"`, "", ""],
      [],
      ["SCHEDULE / CATEGORY NAME", "TYPE", "AMOUNT (₹)"],
      ["I. Revenue from Operations (Net Sales)", "Sales Register", kpiData.totalRevenue.toFixed(2)],
      ["Less: Cost of Goods Sold (COGS - Purchases & Direct Expenses)", "Direct COGS", `-${plBreakdown.directCogs.toFixed(2)}`],
      ["GROSS PROFIT (I – COGS)", "GP", (kpiData.totalRevenue - plBreakdown.directCogs).toFixed(2)],
      ["II. Indirect Operating Expenses (COA Categories)", "Overheads", ""]
    ];

    Object.entries(plBreakdown.indirectCategories).forEach(([cat, amt]) => {
      rows.push([cat, "Indirect Overhead", `-${amt.toFixed(2)}`]);
    });

    rows.push(["Total Indirect Expenses", "-", `-${plBreakdown.totalIndirect.toFixed(2)}`]);
    rows.push([]);
    rows.push(["NET OPERATING PROFIT / (LOSS)", `${kpiData.netMargin.toFixed(1)}% NP`, kpiData.netProfit.toFixed(2)]);

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(val => `"${String(val || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Profit_Loss_Category_Wise_${activeClient.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const grossProfit = kpiData.totalRevenue - plBreakdown.directCogs;
  const grossMargin = kpiData.totalRevenue > 0 ? (grossProfit / kpiData.totalRevenue) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto p-6 font-sans">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-4">
        
        {/* TOP ACTION BAR */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Financial Statements & Reports</h4>
            <p className="text-[11px] text-slate-500">COA-compliant P&L, AR, and AP reports</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5"
            >
              <option value="September 2026">September 2026</option>
              <option value="August 2026">August 2026</option>
              <option value="July 2026">July 2026</option>
              <option value="FY2026-27">Financial Year 2026–27</option>
              <option value="All">All-Time / Lifetime</option>
            </select>
            <button onClick={handleDownloadDynamicPL} className="bg-slate-900 text-white text-xs font-bold px-3.5 py-2 rounded-lg cursor-pointer">
              Download P&L Statement
            </button>
          </div>
        </div>

        {/* 4 KPI CARDS */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Revenue</span>
            <p className="text-2xl font-black font-mono text-slate-900 mt-2">₹{kpiData.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Net Operating Profit</span>
            <p className={`text-2xl font-black font-mono mt-2 ${kpiData.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
              ₹{kpiData.netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Accounts Payable</span>
            <p className="text-2xl font-black font-mono text-slate-900 mt-2">₹{kpiData.accountsPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Accounts Receivable</span>
            <p className="text-2xl font-black font-mono text-slate-900 mt-2">₹{kpiData.accountsReceivable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* P&L TABLE */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase">Statement of Profit and Loss ({selectedPeriod})</h3>
            <span className="text-[11px] text-slate-400">COA-Compliant Classification</span>
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
              <tr>
                <td className="py-2.5 px-6 font-bold text-slate-900">I. Revenue from Operations (Net Sales)</td>
                <td className="py-2.5 px-6 text-slate-400">Sales Register</td>
                <td className="py-2.5 px-6 text-right font-mono font-bold">₹{kpiData.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="py-2 px-6 pl-9 text-slate-600">Less: Cost of Goods Sold (Purchases & Direct Expenses)</td>
                <td className="py-2 px-6 text-slate-400">Direct COGS</td>
                <td className="py-2 px-6 text-right font-mono text-rose-600">-₹{plBreakdown.directCogs.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="bg-slate-50 font-bold border-y border-slate-200">
                <td className="py-2.5 px-6 text-slate-900">GROSS PROFIT (I – COGS)</td>
                <td className="py-2.5 px-6 text-indigo-700">{grossMargin.toFixed(1)}% GP</td>
                <td className="py-2.5 px-6 text-right font-mono font-bold">₹{grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td colSpan="3" className="py-1.5 px-6 text-[10px] font-bold text-slate-400 uppercase">II. Indirect Operating Expenses (COA Categories)</td>
              </tr>
              {Object.entries(plBreakdown.indirectCategories).map(([cat, amt]) => (
                <tr key={cat} className="hover:bg-slate-50">
                  <td className="py-1.5 px-6 pl-9 text-slate-700">{cat}</td>
                  <td className="py-1.5 px-6 text-slate-400">Indirect Overhead</td>
                  <td className="py-1.5 px-6 text-right font-mono text-rose-600">-₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-100 font-semibold">
                <td className="py-2 px-6">Total Indirect Expenses</td>
                <td className="py-2 px-6">-</td>
                <td className="py-2 px-6 text-right font-mono text-rose-600">-₹{plBreakdown.totalIndirect.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <div className="bg-slate-900 text-white font-bold text-xs px-6 py-3.5 flex items-center justify-between">
            <span>NET OPERATING PROFIT / (LOSS)</span>
            <span className="font-mono text-emerald-400 text-base">₹{kpiData.netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
