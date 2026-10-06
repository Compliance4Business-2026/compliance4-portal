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

  // Live state for data pulled from backend/localStorage
  const [bills, setBills] = useState([]);
  const [salesRecords, setSalesRecords] = useState([]);
  const [expensesRecords, setExpensesRecords] = useState([]);
  const [bankTxns, setBankTxns] = useState([]);
  const [clientCoa, setClientCoa] = useState([]);

  // --- FETCH ALL MODULE DATA ON LOAD OR CLIENT CHANGE ---
  useEffect(() => {
    let isMounted = true;
    const API_BASE_URL = "https://compliance4-backend-1021821620394.asia-south1.run.app";

    async function fetchAllModuleData() {
      if (!activeClient) return;

      // 1. Try fetching from Backend API
      try {
        const [billsRes, salesRes, expRes, bankRes, coaRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/clients/${encodeURIComponent(activeClient)}/bills?stage=approved`).then(r => r.json()).catch(() => []),
          fetch(`${API_BASE_URL}/api/clients/${encodeURIComponent(activeClient)}/sales?status=approved`).then(r => r.json()).catch(() => []),
          fetch(`${API_BASE_URL}/api/clients/${encodeURIComponent(activeClient)}/expenses?status=approved`).then(r => r.json()).catch(() => []),
          fetch(`${API_BASE_URL}/api/clients/${encodeURIComponent(activeClient)}/bank-txns?status=reconciled`).then(r => r.json()).catch(() => []),
          fetch(`${API_BASE_URL}/api/clients/${encodeURIComponent(activeClient)}/coa`).then(r => r.json()).catch(() => [])
        ]);

        if (isMounted) {
          if (Array.isArray(billsRes) && billsRes.length > 0) setBills(billsRes);
          if (Array.isArray(salesRes) && salesRes.length > 0) setSalesRecords(salesRes);
          if (Array.isArray(expRes) && expRes.length > 0) setExpensesRecords(expRes);
          if (Array.isArray(bankRes) && bankRes.length > 0) setBankTxns(bankRes);
          if (Array.isArray(coaRes) && coaRes.length > 0) setClientCoa(coaRes);
        }
      } catch (err) {
        console.warn("API fetch warning, falling back to localStorage:", err);
      }

      // 2. Fallback / Merge with LocalStorage data to ensure 100% data visibility
      try {
        const localBills = JSON.parse(localStorage.getItem(`c4_approved_bills_${activeClient}`) || localStorage.getItem(`c4_pushed_bills_${activeClient}`) || "[]");
        const localSales = JSON.parse(localStorage.getItem(`c4_sales_${activeClient}`) || localStorage.getItem(`c4_normal_sales_invoices_${activeClient}`) || "[]");
        const localExp = JSON.parse(localStorage.getItem(`c4_other_expenses_${activeClient}`) || localStorage.getItem(`c4_other_expenses_pushed_${activeClient}`) || "[]");
        const localBank = JSON.parse(localStorage.getItem(`c4_bank_transactions_${activeClient}`) || "[]");
        const localCoa = JSON.parse(localStorage.getItem(`c4_coa_${activeClient}`) || "[]");

        if (isMounted) {
          setBills(prev => prev.length > 0 ? prev : localBills);
          setSalesRecords(prev => prev.length > 0 ? prev : localSales);
          setExpensesRecords(prev => prev.length > 0 ? prev : localExp);
          setBankTxns(prev => prev.length > 0 ? prev : localBank);
          setClientCoa(prev => prev.length > 0 ? prev : localCoa);
        }
      } catch (e) {
        console.error("Local storage read error:", e);
      }
    }

    fetchAllModuleData();
    return () => { isMounted = false; };
  }, [activeClient]);

  // --- BULLETPROOF DATE PARSER ---
  const parseToDate = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!isNaN(s) && Number(s) > 20000 && Number(s) < 60000) {
      return new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    const parts = s.split(/[\/\-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return new Date(parseInt(yr), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
    return null;
  };

  // --- PERIOD FILTERING LOGIC ---
  const isDateInPeriod = (rawDate) => {
    if (selectedPeriod === "All") return true;
    const d = parseToDate(rawDate);
    if (!d || isNaN(d.getTime())) return true; // Include if date unparseable so records aren't accidentally hidden

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
    if (selectedPeriod === "Custom") {
      if (!customStartDate || !customEndDate) return true;
      const targetTime = new Date(yr, mo - 1, d.getDate()).setHours(0,0,0,0);
      const startTime = new Date(customStartDate).setHours(0,0,0,0);
      const endTime = new Date(customEndDate).setHours(23,59,59,999);
      return targetTime >= startTime && targetTime <= endTime;
    }
    return true;
  };

  const filteredSales = useMemo(() => salesRecords.filter(s => isDateInPeriod(s.invoiceDate || s.date || s.voucherDate)), [salesRecords, selectedPeriod, customStartDate, customEndDate]);
  const filteredBills = useMemo(() => bills.filter(b => isDateInPeriod(b.billDate || b.invoice_date || b.date)), [bills, selectedPeriod, customStartDate, customEndDate]);
  const filteredExpenses = useMemo(() => expensesRecords.filter(e => isDateInPeriod(e.voucherDate || e.date)), [expensesRecords, selectedPeriod, customStartDate, customEndDate]);

  // --- P&L CALCULATIONS & CATEGORY BREAKDOWN ---
  const plBreakdown = useMemo(() => {
    let directCogs = 0;
    const indirectCategories = {};

    filteredBills.forEach(b => {
      const amt = parseFloat(b.taxable_amount || b.taxableAmount || b.grand_total || 0);
      directCogs += amt;

      const lines = b.accounting_ledgers || b.items || [];
      lines.forEach(l => {
        const cat = l.category || l.ledger_name || "General Purchase Expenses";
        indirectCategories[cat] = (indirectCategories[cat] || 0) + parseFloat(l.amount || 0);
      });
    });

    filteredExpenses.forEach(e => {
      const cat = e.group || e.expenseLedger || "Administrative & General Expenses";
      indirectCategories[cat] = (indirectCategories[cat] || 0) + parseFloat(e.amount || e.taxableAmount || 0);
    });

    const totalIndirect = Object.values(indirectCategories).reduce((a, b) => a + b, 0);
    return { directCogs, indirectCategories, totalIndirect };
  }, [filteredBills, filteredExpenses]);

  const kpiData = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + parseFloat(s.taxableAmount || s.grand_total || s.amount || 0), 0);
    const totalGross = filteredSales.reduce((acc, s) => acc + parseFloat(s.grandTotal || s.grand_total || s.amount || 0), 0);
    
    const totalCost = plBreakdown.directCogs + plBreakdown.totalIndirect;
    const netProfit = totalRevenue - totalCost;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const accountsPayable = filteredBills.reduce((acc, b) => acc + parseFloat(b.grand_total || b.grandTotal || 0), 0) +
                            filteredExpenses.reduce((acc, e) => acc + parseFloat(e.grandTotal || e.amount || 0), 0);

    const accountsReceivable = filteredSales.reduce((acc, s) => acc + parseFloat(s.grandTotal || s.grand_total || s.amount || 0), 0);

    return {
      totalRevenue,
      totalGross,
      netProfit,
      netMargin,
      accountsPayable,
      accountsReceivable,
      salesCount: filteredSales.length
    };
  }, [filteredSales, filteredBills, filteredExpenses, plBreakdown]);

  // --- DOWNLOAD 1: CATEGORY-WISE P&L STATEMENT ---
  const handleDownloadDynamicPL = () => {
    const rows = [
      [`"STATEMENT OF PROFIT AND LOSS (${selectedPeriod})"`, "", ""],
      [`"Client Entity:","${activeClient}"`, "", ""],
      [`"Generated On:","${new Date().toLocaleDateString("en-IN")}"`, "", ""],
      [],
      ["SCHEDULE / CATEGORY NAME", "TYPE", "AMOUNT (₹)"],
      ["I. Revenue from Operations (Net Sales)", "Sales Register", kpiData.totalRevenue.toFixed(2)],
      ["Less: Cost of Goods Sold / Purchases (COGS)", "Direct Inventory Purchases", `-${plBreakdown.directCogs.toFixed(2)}`],
      ["GROSS PROFIT (I – COGS)", `${(kpiData.totalRevenue > 0 ? ((kpiData.totalRevenue - plBreakdown.directCogs)/kpiData.totalRevenue)*100 : 0).toFixed(1)}% GP`, (kpiData.totalRevenue - plBreakdown.directCogs).toFixed(2)],
      ["II. Indirect Operating Expenses (Client Categories)", "P&L Overheads", ""]
    ];

    const indirectEntries = Object.entries(plBreakdown.indirectCategories);
    if (indirectEntries.length === 0) {
      rows.push(["  • General Administrative Expenses", "Indirect Expense", "0.00"]);
    } else {
      indirectEntries.forEach(([cat, amt]) => {
        rows.push([`  • ${cat}`, "P&L Category Overhead", `-${amt.toFixed(2)}`]);
      });
    }

    rows.push(["Total Indirect Expenses", "-", `-${plBreakdown.totalIndirect.toFixed(2)}`]);
    rows.push([]);
    rows.push(["NET OPERATING PROFIT / (LOSS)", `${kpiData.netMargin.toFixed(1)}% NP Margin`, kpiData.netProfit.toFixed(2)]);

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(val => `"${String(val || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Profit_Loss_Category_Wise_${activeClient.replace(/\s+/g, "_")}_${selectedPeriod.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- DOWNLOAD 2 & 3: SUPPLIER-WISE AP & CUSTOMER-WISE AR REPORTS ---
  const handleDownloadARAPReport = (type = "AR") => {
    const isAR = type === "AR";

    if (!isAR) {
      // AP REPORT: Supplier-wise with invoices under each vendor
      const vendorMap = {};
      filteredBills.forEach(b => {
        const vendor = b.vendor_name || "Unassigned Vendor";
        if (!vendorMap[vendor]) vendorMap[vendor] = { invoices: [], totalPayable: 0 };
        const total = parseFloat(b.grand_total || b.grandTotal || 0);
        vendorMap[vendor].invoices.push({
          invNo: b.supplier_invoice_no || b.invoice_number || "N/A",
          date: b.billDate || b.invoice_date || b.date || "N/A",
          amount: total
        });
        vendorMap[vendor].totalPayable += total;
      });

      const headers = ["SUPPLIER / VENDOR NAME", "INVOICE NUMBER", "INVOICE DATE", "INVOICE AMOUNT (₹)", "TOTAL VENDOR OUTSTANDING (₹)"];
      const rows = [
        [`"ACCOUNTS PAYABLE (SUNDRY CREDITORS REPORT - ${selectedPeriod})"`, "", "", "", ""],
        [`"Client:","${activeClient}"`, "", "", "", ""],
        [],
        headers
      ];

      Object.entries(vendorMap).forEach(([vendor, data]) => {
        data.invoices.forEach((inv, idx) => {
          rows.push([
            idx === 0 ? vendor : "",
            inv.invNo,
            inv.date,
            inv.amount.toFixed(2),
            idx === 0 ? data.totalPayable.toFixed(2) : ""
          ]);
        });
        rows.push([]);
      });

      rows.push(["", "", "", "TOTAL AP OUTSTANDING:", kpiData.accountsPayable.toFixed(2)]);

      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(val => `"${String(val || "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const link = document.createElement("a");
      link.href = encodeURI(csvContent);
      link.download = `Accounts_Payable_Supplier_Wise_${activeClient.replace(/\s+/g, "_")}_${selectedPeriod.replace(/\s+/g, "_")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // AR REPORT: Customer-wise with invoices under each customer
    const customerMap = {};
    filteredSales.forEach(s => {
      const cust = s.customer_name || s.party_name || "Walk-in Customer";
      if (!customerMap[cust]) customerMap[cust] = { invoices: [], totalReceivable: 0 };
      const total = parseFloat(s.grandTotal || s.grand_total || s.taxableAmount || 0);
      customerMap[cust].invoices.push({
        invNo: s.invoice_number || "N/A",
        date: s.invoiceDate || s.date || "N/A",
        amount: total
      });
      customerMap[cust].totalReceivable += total;
    });

    const headers = ["CUSTOMER / DEBTOR NAME", "INVOICE NUMBER", "INVOICE DATE", "INVOICE AMOUNT (₹)", "TOTAL CUSTOMER RECEIVABLE (₹)"];
    const rows = [
      [`"ACCOUNTS RECEIVABLE (SUNDRY DEBTORS REPORT - ${selectedPeriod})"`, "", "", "", ""],
      [`"Client:","${activeClient}"`, "", "", "", ""],
      [],
      headers
    ];

    Object.entries(customerMap).forEach(([cust, data]) => {
      data.invoices.forEach((inv, idx) => {
        rows.push([
          idx === 0 ? cust : "",
          inv.invNo,
          inv.date,
          inv.amount.toFixed(2),
          idx === 0 ? data.totalReceivable.toFixed(2) : ""
        ]);
      });
      rows.push([]);
    });

    rows.push(["", "", "", "TOTAL AR RECEIVABLE:", kpiData.accountsReceivable.toFixed(2)]);

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(val => `"${String(val || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Accounts_Receivable_Customer_Wise_${activeClient.replace(/\s+/g, "_")}_${selectedPeriod.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- LAST 6 MONTHS TREND GRAPH DATA ---
  const last6MonthsData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short" });
      months.push({ key, label, sales: 0, cost: 0, netProfit: 0 });
    }
    salesRecords.forEach((inv) => {
      const d = parseToDate(inv.invoiceDate || inv.date);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const match = months.find((m) => m.key === key);
        if (match) match.sales += parseFloat(inv.taxableAmount || inv.grandTotal || 0);
      }
    });
    bills.forEach((b) => {
      const d = parseToDate(b.billDate || b.date || b.voucherDate);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const match = months.find((m) => m.key === key);
        if (match) match.cost += parseFloat(b.taxable_amount || b.taxableAmount || 0);
      }
    });
    months.forEach((m) => { m.netProfit = m.sales - m.cost; });
    return months;
  }, [salesRecords, bills]);

  const renderLineChart = (data, dataKey, strokeColor, fillColor) => {
    const width = 380;
    const height = 110;
    const padding = 16;
    const values = data.map((d) => d[dataKey]);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min = 0; max = max > 0 ? max * 1.5 : 100; }
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
          {data.map((d) => (<span key={d.key}>{d.label}</span>))}
        </div>
      </div>
    );
  };

  const grossProfit = kpiData.totalRevenue - plBreakdown.directCogs;
  const grossMargin = kpiData.totalRevenue > 0 ? (grossProfit / kpiData.totalRevenue) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto p-6 font-sans">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-4">
        
        {/* ACTION BAR & PERIOD SELECTOR */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Financial Statements & Reports</h4>
            <p className="text-[11px] text-slate-500">Direct one-click client download center for P&L, AR, and AP reports</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="September 2026">September 2026</option>
                <option value="August 2026">August 2026</option>
                <option value="July 2026">July 2026</option>
                <option value="June 2026">June 2026</option>
                <option value="May 2026">May 2026</option>
                <option value="April 2026">April 2026</option>
                <option value="FY2026-27">Financial Year 2026–27</option>
                <option value="FY2025-26">Financial Year 2025–26</option>
                <option value="Custom">Custom Date Range...</option>
                <option value="All">All-Time / Lifetime</option>
              </select>
            </div>

            {selectedPeriod === "Custom" && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent font-mono text-[11px] focus:outline-none"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent font-mono text-[11px] focus:outline-none"
                />
              </div>
            )}

            <button onClick={handleDownloadDynamicPL} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition shadow-xs cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Download P&L Statement
            </button>
            <button onClick={() => handleDownloadARAPReport("AR")} className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-3.5 py-2 rounded-lg transition cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Download AR Report
            </button>
            <button onClick={() => handleDownloadARAPReport("AP")} className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold px-3.5 py-2 rounded-lg transition cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Download AP Report
            </button>
          </div>
        </div>

        {/* 4 KPI CARDS */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Revenue From Operations</span>
            <p className="text-2xl font-black font-mono text-slate-900 mt-2">₹{kpiData.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 mt-2 border-t border-slate-100">
              <span>Gross: ₹{kpiData.totalGross.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-[10px]">{kpiData.salesCount} Bills</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net Operating Profit</span>
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
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Accounts Payable</span>
            <p className="text-2xl font-black font-mono text-slate-900 mt-2">₹{kpiData.accountsPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 mt-2 border-t border-slate-100">
              <span>Sundry Creditors</span>
              <span className="text-slate-500 font-semibold text-[10px]">Unpaid Outstandings</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Accounts Receivable</span>
            <p className="text-2xl font-black font-mono text-slate-900 mt-2">₹{kpiData.accountsReceivable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 mt-2 border-t border-slate-100">
              <span>Debtors & Aggregators</span>
              <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded text-[10px]">Pending Collection</span>
            </div>
          </div>
        </div>

        {/* MIDDLE: STATEMENT OF PROFIT AND LOSS */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Statement of Profit and Loss ({selectedPeriod === "Custom" ? `${customStartDate} to ${customEndDate}` : selectedPeriod})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Schedule III Classified by Client COA</span>
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
                <td className="py-2.5 px-6 font-mono text-slate-400 text-[11px]">Sales Register</td>
                <td className="py-2.5 px-6 text-right font-mono font-bold text-slate-900">₹{kpiData.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="py-2 px-6 pl-9 text-slate-600">Less: Cost of Goods Sold / Purchases (COGS)</td>
                <td className="py-2 px-6 font-mono text-slate-400 text-[11px]">Direct Inventory Purchases</td>
                <td className="py-2 px-6 text-right font-mono text-rose-600">-₹{plBreakdown.directCogs.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="bg-slate-50/80 font-bold border-y border-slate-200">
                <td className="py-2.5 px-6 text-slate-900 font-black">GROSS PROFIT (I – COGS)</td>
                <td className="py-2.5 px-6 font-mono text-indigo-700 text-[11px]">{grossMargin.toFixed(1)}% GP</td>
                <td className="py-2.5 px-6 text-right font-mono font-black text-slate-900">₹{grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="bg-white">
                <td colSpan="3" className="py-1.5 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">II. Indirect Operating Expenses (Client P&L Heads)</td>
              </tr>
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
                    <td className="py-1.5 px-6 text-right font-mono text-rose-600">-₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              )}
              <tr className="border-t border-slate-100 font-semibold text-slate-700">
                <td className="py-2 px-6 text-slate-800">Total Indirect Expenses</td>
                <td className="py-2 px-6 text-slate-400">-</td>
                <td className="py-2 px-6 text-right font-mono text-rose-600 font-bold">-₹{plBreakdown.totalIndirect.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <div className="bg-slate-900 text-white font-bold text-xs px-6 py-3.5 flex items-center justify-between border-t-2 border-slate-900 shrink-0">
            <span className="font-black uppercase tracking-wider text-xs">NET OPERATING PROFIT / (LOSS)</span>
            <span className="font-mono text-emerald-400 text-xs">{kpiData.netMargin.toFixed(1)}% NP Margin</span>
            <span className="font-mono font-black text-base text-emerald-400">
              {kpiData.netProfit < 0 ? "-" : ""}₹{Math.abs(kpiData.netProfit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* BOTTOM: 3 TREND LINE GRAPHS */}
        <div className="grid grid-cols-3 gap-4 shrink-0 pb-2">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600" /> Sales Trend Line
            </h4>
            {renderLineChart(last6MonthsData, "sales", "#10b981", "#10b981")}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-amber-600" /> Total Cost Trend Line
            </h4>
            {renderLineChart(last6MonthsData, "cost", "#f59e0b", "#f59e0b")}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-indigo-600" /> Net Profit Trend Line
            </h4>
            {renderLineChart(last6MonthsData, "netProfit", "#6366f1", "#6366f1")}
          </div>
        </div>

      </div>
    </div>
  );
}
