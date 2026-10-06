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
import { api } from "./api";

export default function DashboardModule({ activeClient = "Pansuria Confectionery & Food" }) {
  const [cloudSummary, setCloudSummary] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("September 2026");
  const [customStartDate, setCustomStartDate] = useState("2026-09-01");
  const [customEndDate, setCustomEndDate] = useState("2026-09-30");

  // --- FETCH DASHBOARD SUMMARY FROM FIRESTORE ON LOAD / CLIENT SWITCH ---
  useEffect(() => {
    let isMounted = true;

    async function loadCloudDashboard() {
      try {
        const summary = await api.getDashboardSummary(activeClient);
        if (isMounted && summary) {
          setCloudSummary(summary);
        }
      } catch (err) {
        console.warn("Using local fallback calculations for dashboard:", err);
      }
    }

    if (activeClient) {
      loadCloudDashboard();
    }

    return () => {
      isMounted = false;
    };
  }, [activeClient]);

  // STRICT CLIENT DATA EXTRACTION & ITC ELIGIBILITY PROFILE
  const clientProfile = useMemo(() => {
    try {
      const profiles = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
      return profiles[activeClient] || { isItcEligible: true };
    } catch {
      return { isItcEligible: true };
    }
  }, [activeClient]);

  const isClientItcEligible = clientProfile.isItcEligible !== false;

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
      const data = localStorage.getItem(`c4_sales_${activeClient}`) || localStorage.getItem(`c4_normal_sales_invoices_${activeClient}`);
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

  // Sundry Creditors Filter from COA
  const sundryCreditorNames = useMemo(() => {
    return clientCoa
      .filter(
        (l) =>
          l.statementType === "Balance Sheet" &&
          (l.category.toLowerCase().includes("creditor") ||
            l.category.toLowerCase().includes("payable") ||
            l.category.toLowerCase().includes("vendor") ||
            l.category.toLowerCase().includes("supplier"))
      )
      .map((l) => l.name.toLowerCase().trim());
  }, [clientCoa]);

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

  // --- DASHBOARD-ONLY PERIOD FILTERING (Month-wise, Year-wise, Custom, All) ---
  const isDateInPeriod = (rawDate) => {
    if (selectedPeriod === "All") return true;
    const d = parseToDate(rawDate);
    if (!d || isNaN(d.getTime())) return false;

    const yr = d.getFullYear();
    const mo = d.getMonth() + 1; // 1 to 12

    if (selectedPeriod === "September 2026") {
      return yr === 2026 && mo === 9;
    }
    if (selectedPeriod === "August 2026") {
      return yr === 2026 && mo === 8;
    }
    if (selectedPeriod === "July 2026") {
      return yr === 2026 && mo === 7;
    }
    if (selectedPeriod === "June 2026") {
      return yr === 2026 && mo === 6;
    }
    if (selectedPeriod === "May 2026") {
      return yr === 2026 && mo === 5;
    }
    if (selectedPeriod === "April 2026") {
      return yr === 2026 && mo === 4;
    }
    if (selectedPeriod === "FY2026-27") {
      return (yr === 2026 && mo >= 4) || (yr === 2027 && mo <= 3);
    }
    if (selectedPeriod === "FY2025-26") {
      return (yr === 2025 && mo >= 4) || (yr === 2026 && mo <= 3);
    }
    if (selectedPeriod === "Custom") {
      if (!customStartDate || !customEndDate) return true;
      const targetTime = new Date(yr, mo - 1, d.getDate()).setHours(0,0,0,0);
      const startTime = new Date(customStartDate).setHours(0,0,0,0);
      const endTime = new Date(customEndDate).setHours(23,59,59,999);
      return targetTime >= startTime && targetTime <= endTime;
    }
    return true;
  };

  const filteredNormalSales = useMemo(() => normalSales.filter(inv => isDateInPeriod(inv.invoiceDate || inv.date)), [normalSales, selectedPeriod, customStartDate, customEndDate]);
  const filteredPosJournals = useMemo(() => posJournals.filter(jv => isDateInPeriod(jv.voucherDate)), [posJournals, selectedPeriod, customStartDate, customEndDate]);
  const filteredPurchases = useMemo(() => allPurchases.filter(b => isDateInPeriod(b.billDate || b.date || b.voucherDate)), [allPurchases, selectedPeriod, customStartDate, customEndDate]);
  const filteredOverheads = useMemo(() => allOverheads.filter(e => isDateInPeriod(e.voucherDate || e.date)), [allOverheads, selectedPeriod, customStartDate, customEndDate]);
  const filteredBankTransactions = useMemo(() => [...bankTransactions, ...bankPushed].filter(t => isDateInPeriod(t.date)), [bankTransactions, bankPushed, selectedPeriod, customStartDate, customEndDate]);

  // 1. REFINED P&L LEDGER NATURE RESOLVER
  const getLedgerPlNature = (ledgerName, coaList) => {
    if (!ledgerName) return "COGS";
    const clean = ledgerName.trim().toLowerCase();
    const matched = coaList.find((l) => l.name.trim().toLowerCase() === clean);

    if (matched) {
      if (matched.cogsClassification === "COGS") return "COGS";
      if (matched.cogsClassification === "Indirect") return "Indirect";
      if (matched.cogsClassification === "Revenue") return "Revenue";
      if (matched.cogsClassification === "Other Income") return "Other Income";

      const cat = (matched.category || "").toLowerCase();
      if (cat.includes("sales") || cat.includes("revenue") || cat.includes("turnover")) return "Revenue";
      if (cat.includes("other income") || cat.includes("interest")) return "Other Income";
      if (cat.includes("cogs") || cat.includes("cost of goods") || cat.includes("direct") || cat.includes("raw material") || cat.includes("purchase")) return "COGS";
      return "Indirect";
    }

    if (clean.includes("sales") || clean.startsWith("sale")) return "Revenue";
    if (clean.includes("interest") || clean.includes("other income")) return "Other Income";
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
    if (isIndirect) return "Indirect";

    return "COGS";
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

  // 2. SCHEDULE BREAKDOWN
  const plBreakdown = useMemo(() => {
    let directCogs = 0;
    let otherIncomeTotal = 0;
    const indirectCategories = {};

    filteredPurchases.forEach((bill) => {
      const lines = bill.accounting_ledgers || bill.items || [];
      if (lines.length > 0) {
        lines.forEach((line) => {
          const lName = line.ledger_name || line.ledger || "";
          const amt = parseFloat(line.amount) || 0;
          const nature = getLedgerPlNature(lName, clientCoa);

          if (nature === "COGS") {
            directCogs += amt;
          } else if (nature === "Indirect") {
            const cat = getCategoryForLedger(lName, clientCoa);
            indirectCategories[cat] = (indirectCategories[cat] || 0) + amt;
          }
        });
      } else {
        const bAmt = parseFloat(bill.taxable_amount || bill.taxableAmount) || 0;
        directCogs += bAmt;
      }

      const treatTaxAsExp = !isClientItcEligible || bill.treatTaxAsExpense;
      if (treatTaxAsExp) {
        const cgstAmt = parseFloat(bill.cgst) || 0;
        if (cgstAmt > 0) {
          const taxLedger = bill.cgst_ledger || "GST Expense on Purchase";
          const nature = getLedgerPlNature(taxLedger, clientCoa);
          if (nature === "Indirect") {
            const cat = getCategoryForLedger(taxLedger, clientCoa);
            indirectCategories[cat] = (indirectCategories[cat] || 0) + cgstAmt;
          } else {
            directCogs += cgstAmt;
          }
        }

        const sgstAmt = parseFloat(bill.sgst) || 0;
        if (sgstAmt > 0) {
          const taxLedger = bill.sgst_ledger || "GST Expense on Purchase";
          const nature = getLedgerPlNature(taxLedger, clientCoa);
          if (nature === "Indirect") {
            const cat = getCategoryForLedger(taxLedger, clientCoa);
            indirectCategories[cat] = (indirectCategories[cat] || 0) + sgstAmt;
          } else {
            directCogs += sgstAmt;
          }
        }

        const igstAmt = parseFloat(bill.igst) || 0;
        if (igstAmt > 0) {
          const taxLedger = bill.igst_ledger || "GST Expense on Purchase";
          const nature = getLedgerPlNature(taxLedger, clientCoa);
          if (nature === "Indirect") {
            const cat = getCategoryForLedger(taxLedger, clientCoa);
            indirectCategories[cat] = (indirectCategories[cat] || 0) + igstAmt;
          } else {
            directCogs += igstAmt;
          }
        }
      }
    });

    filteredOverheads.forEach((exp) => {
      const nature = getLedgerPlNature(exp.expenseLedger, clientCoa);
      const amt = parseFloat(exp.taxableAmount || exp.amount) || 0;

      if (nature === "Other Income") {
        otherIncomeTotal += amt;
      } else if (nature === "COGS") {
        directCogs += amt;
      } else {
        const cat = exp.group || "Administrative & General Expenses";
        indirectCategories[cat] = (indirectCategories[cat] || 0) + amt;
      }
    });

    const totalIndirect = Object.values(indirectCategories).reduce((acc, v) => acc + v, 0);

    return {
      directCogs,
      indirectCategories,
      totalIndirect,
      otherIncomeTotal
    };
  }, [filteredPurchases, filteredOverheads, clientCoa, isClientItcEligible]);

  // 3. TOP 4 KPI CALCULATIONS
  const kpiData = useMemo(() => {
    const normalRev = filteredNormalSales.reduce((acc, inv) => acc + (parseFloat(inv.taxableAmount) || 0), 0);
    const posRev = filteredPosJournals.reduce((acc, jv) => acc + (parseFloat(jv.totalTaxable) || 0), 0);
    const totalRevenue = normalRev + posRev;

    const normalGross = filteredNormalSales.reduce((acc, inv) => acc + (parseFloat(inv.grandTotal) || 0), 0);
    const posGross = filteredPosJournals.reduce((acc, jv) => acc + (parseFloat(jv.totalDebits) || 0), 0);
    const totalGross = normalGross + posGross;

    const totalCost = plBreakdown.directCogs + plBreakdown.totalIndirect;
    const netProfit = totalRevenue + plBreakdown.otherIncomeTotal - totalCost;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const validCreditorPurchases = filteredPurchases.filter((b) => {
      const vName = (b.vendor_name || "").toLowerCase().trim();
      return sundryCreditorNames.length === 0 || sundryCreditorNames.includes(vName) || Boolean(vName);
    });

    const totalVendorBills = validCreditorPurchases.reduce((acc, b) => acc + (parseFloat(b.grand_total || b.taxable_amount) || 0), 0);
    const totalPayableOverheads = filteredOverheads.reduce((acc, e) => acc + (parseFloat(e.grandTotal || e.amount) || 0), 0);
    const bankVendorPayments = filteredBankTransactions
      .filter((t) => t.type === "Payment" && (t.allocatedLedger || "").toLowerCase().includes("creditor"))
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const accountsPayable = Math.max(totalVendorBills + totalPayableOverheads - bankVendorPayments, 0);

    const totalDebtorInvoices = filteredNormalSales.reduce((acc, inv) => acc + (parseFloat(inv.grandTotal) || 0), 0);
    const bankDebtorReceipts = filteredBankTransactions
      .filter((t) => t.type === "Receipt" && (t.allocatedLedger || "").toLowerCase().includes("debtor"))
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    const aggregatorReceivables = filteredPosJournals.reduce((acc, jv) => {
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
      salesCount: filteredNormalSales.length + filteredPosJournals.length
    };
  }, [filteredNormalSales, filteredPosJournals, filteredPurchases, filteredOverheads, filteredBankTransactions, plBreakdown, sundryCreditorNames]);

  // --- GRANULAR CATEGORY-WISE P&L DOWNLOAD (FEATURE 4) ---
  const handleDownloadDynamicPL = () => {
    const rows = [
      [`"STATEMENT OF PROFIT AND LOSS (${selectedPeriod})"`, `""`, `""`],
      [`"Client Entity:","${activeClient}"`, `""`, `""`],
      [`"Generated On:","${new Date().toLocaleDateString("en-IN")}"`, `""`, `""`],
      [],
      ["SCHEDULE / CATEGORY NAME", "TYPE", "AMOUNT (₹)"],
      ["I. Revenue from Operations (Net Sales)", "Sales Register", kpiData.totalRevenue.toFixed(2)],
      ["Less: Cost of Goods Sold / Purchases (COGS)", "Direct Inventory Purchases", `-${plBreakdown.directCogs.toFixed(2)}`],
      ["GROSS PROFIT (I – COGS)", `${((kpiData.totalRevenue > 0 ? (kpiData.totalRevenue - plBreakdown.directCogs) / kpiData.totalRevenue : 0) * 100).toFixed(1)}% GP`, (kpiData.totalRevenue - plBreakdown.directCogs).toFixed(2)]
    ];

    if (plBreakdown.otherIncomeTotal > 0) {
      rows.push(["Add: Other / Non-Operating Income", "Non-Operating Income", `+${plBreakdown.otherIncomeTotal.toFixed(2)}`]);
    }

    rows.push(["II. Indirect Operating Expenses (Client P&L Heads)", "Uploaded COA", ""]);

    const indirectEntries = Object.entries(plBreakdown.indirectCategories);
    if (indirectEntries.length === 0) {
      rows.push(["No indirect operating expenses recorded", "Uploaded COA", "0.00"]);
    } else {
      indirectEntries.forEach(([cat, amt]) => {
        rows.push([`  • ${cat}`, "P&L Indirect Overhead", `-${amt.toFixed(2)}`]);
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

  // --- SUPPLIER-WISE AP & CUSTOMER-WISE AR REPORTS (FEATURE 5) ---
  const handleDownloadARAPReport = (type = "AR") => {
    const isAR = type === "AR";
    
    if (!isAR) {
      // SUPPLIER-WISE AP REPORT WITH INVOICES UNDER EACH VENDOR
      const vendorMap = {};
      filteredPurchases.forEach(b => {
        const vendor = b.vendor_name || "Unassigned Vendor";
        if (!vendorMap[vendor]) {
          vendorMap[vendor] = { invoices: [], totalPayable: 0 };
        }
        const grandTotal = parseFloat(b.grand_total || 0);
        vendorMap[vendor].invoices.push({
          invNo: b.supplier_invoice_no || b.invoice_number || "N/A",
          date: b.voucher_date || b.invoice_date || "N/A",
          amount: grandTotal
        });
        vendorMap[vendor].totalPayable += grandTotal;
      });

      const headers = ["SUPPLIER / VENDOR NAME", "INVOICE NUMBER", "INVOICE DATE", "INVOICE AMOUNT (₹)", "TOTAL VENDOR OUTSTANDING (₹)"];
      const rows = [
        [`"ACCOUNTS PAYABLE (SUNDRY CREDITORS REPORT - ${selectedPeriod})"`, `""`, `""`, `""`, `""`],
        [`"Client:","${activeClient}"`, `""`, `""`, `""`, `""`],
        [`"Generated On:","${new Date().toLocaleDateString("en-IN")}"`, `""`, `""`, `""`, `""`],
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

    // CUSTOMER-WISE AR REPORT WITH INVOICES UNDER EACH CUSTOMER
    const customerMap = {};
    filteredNormalSales.forEach(s => {
      const cust = s.customer_name || s.party_name || "Walk-in Customer";
      if (!customerMap[cust]) {
        customerMap[cust] = { invoices: [], totalReceivable: 0 };
      }
      const grandTotal = parseFloat(s.grand_total || s.taxableAmount || 0);
      customerMap[cust].invoices.push({
        invNo: s.invoice_number || "N/A",
        date: s.invoiceDate || s.date || "N/A",
        amount: grandTotal
      });
      customerMap[cust].totalReceivable += grandTotal;
    });

    const headers = ["CUSTOMER / DEBTOR NAME", "INVOICE NUMBER", "INVOICE DATE", "INVOICE AMOUNT (₹)", "TOTAL CUSTOMER RECEIVABLE (₹)"];
    const rows = [
      [`"ACCOUNTS RECEIVABLE (SUNDRY DEBTORS REPORT - ${selectedPeriod})"`, `""`, `""`, `""`, `""`],
      [`"Client:","${activeClient}"`, `""`, `""`, `""`, `""`],
      [`"Generated On:","${new Date().toLocaleDateString("en-IN")}"`, `""`, `""`, `""`, `""`],
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

  // 4. LAST 6 MONTHS TREND
  const last6MonthsData = useMemo(() => {
    const months = [];
    const now = new Date();

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
        
        {/* REPORT DOWNLOAD ACTION BAR & MONTH/YEAR PERIOD SELECTOR */}
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

            <button
              onClick={handleDownloadDynamicPL}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Download P&L Statement
            </button>
            <button
              onClick={() => handleDownloadARAPReport("AR")}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-3.5 py-2 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Download AR Report
            </button>
            <button
              onClick={() => handleDownloadARAPReport("AP")}
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold px-3.5 py-2 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Download AP Report
            </button>
          </div>
        </div>

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
                Statement of
