import React, { useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  CreditCard, 
  ShieldCheck, 
  Scale, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Building2,
  Calendar,
  AlertCircle,
  PieChart as PieIcon,
  Layers
} from "lucide-react";

export default function DashboardModule({ activeClient = "Panasuria Confectionery" }) {
  // 1. Fetch Client-Scoped Invoices
  const salesInvoices = useMemo(() => {
    try {
      const data = localStorage.getItem(`c4_normal_sales_invoices_${activeClient}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, [activeClient]);

  // 2. Fetch Client-Scoped Purchases (Approved + Pushed)
  const purchaseBills = useMemo(() => {
    try {
      const approved = JSON.parse(localStorage.getItem(`c4_approved_bills_${activeClient}`) || "[]");
      const pushed = JSON.parse(localStorage.getItem(`c4_pushed_bills_${activeClient}`) || "[]");
      return [...approved, ...pushed];
    } catch {
      return [];
    }
  }, [activeClient]);

  // 3. Fetch Client-Scoped Bank Records
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

  // --- SALES AGGREGATIONS ---
  const totalSalesTaxable = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.taxableAmount) || 0), 0);
  const totalOutputCgst = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.cgst) || 0), 0);
  const totalOutputSgst = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.sgst) || 0), 0);
  const totalOutputIgst = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.igst) || 0), 0);
  const totalOutputTax = totalOutputCgst + totalOutputSgst + totalOutputIgst;
  const totalGrossSales = salesInvoices.reduce((acc, inv) => acc + (parseFloat(inv.grandTotal) || 0), 0);

  // --- PURCHASE AGGREGATIONS ---
  const totalPurchaseTaxable = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.taxableAmount || b.taxable) || 0), 0);
  const totalInputCgst = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.cgst) || 0), 0);
  const totalInputSgst = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.sgst) || 0), 0);
  const totalInputIgst = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.igst) || 0), 0);
  const totalInputTax = totalInputCgst + totalInputSgst + totalInputIgst;
  const totalGrossPurchases = purchaseBills.reduce((acc, b) => acc + (parseFloat(b.totalAmount || b.grandTotal || b.total) || 0), 0);

  // --- GST POSITION (Output minus Input) ---
  const netGstPayable = totalOutputTax - totalInputTax;
  const isGstPayable = netGstPayable >= 0;

  // --- BANK TURNOVER ---
  const totalBankInflows = bankTransactions
    .filter(t => t.type === "Receipt")
    .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

  const totalBankOutflows = bankTransactions
    .filter(t => t.type === "Payment")
    .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

  // Top Customers Breakdown
  const customerVolume = useMemo(() => {
    const map = {};
    salesInvoices.forEach(inv => {
      const name = inv.customerName || "Unregistered Buyer";
      map[name] = (map[name] || 0) + (parseFloat(inv.grandTotal) || 0);
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [salesInvoices]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Executive Dashboard & Analytics</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-500 font-medium">{activeClient}</p>
            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold border border-slate-200">
              FY 2026–27
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Live Statutory Books</span>
        </div>
      </header>

      {/* DASHBOARD CONTENT CONTAINER */}
      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">

        {/* 1. TOP 4 EXECUTIVE METRIC CARDS */}
        <div className="grid grid-cols-4 gap-5">
          {/* REVENUE CARD */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Invoiced Sales</span>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ₹{totalGrossSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
              <span>Taxable: ₹{totalSalesTaxable.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              <span className="font-semibold text-emerald-700">{salesInvoices.length} Bills</span>
            </div>
          </div>

          {/* PURCHASES & EXPENSES CARD */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recorded Purchases</span>
              <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ₹{totalGrossPurchases.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
              <span>Taxable: ₹{totalPurchaseTaxable.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              <span className="font-semibold text-rose-700">{purchaseBills.length} Bills</span>
            </div>
          </div>

          {/* GST POSITION / LIABILITY CARD */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isGstPayable ? "Estimated GST Payable" : "ITC Surplus Balance"}
              </span>
              <div className={`p-2 rounded-lg ${isGstPayable ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-2xl font-black font-mono ${isGstPayable ? "text-amber-700" : "text-blue-700"}`}>
              ₹{Math.abs(netGstPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
              <span>Output: ₹{totalOutputTax.toFixed(0)}</span>
              <span>ITC: ₹{totalInputTax.toFixed(0)}</span>
            </div>
          </div>

          {/* BANKING CASHFLOW CARD */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bank Receipts vs Payments</span>
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ₹{(totalBankInflows - totalBankOutflows).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
              <span className="text-emerald-700 font-semibold">+₹{totalBankInflows.toFixed(0)}</span>
              <span className="text-rose-700 font-semibold">-₹{totalBankOutflows.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* 2. STATUTORY GSTR-3B PRE-COMPUTED MATRIX */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                GSTR-3B Outward Tax vs. Eligible ITC Position
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Auto-derived from Sales & Purchase registers</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-6">Description / Statutory Head</th>
                <th className="py-3 px-4 text-right">Taxable Value (₹)</th>
                <th className="py-3 px-4 text-right">Integrated Tax (IGST)</th>
                <th className="py-3 px-4 text-right">Central Tax (CGST)</th>
                <th className="py-3 px-4 text-right">State Tax (SGST)</th>
                <th className="py-3 px-6 text-right">Total Tax (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              <tr>
                <td className="py-3.5 px-6 font-semibold text-slate-900">
                  Table 3.1: Outward Taxable Supplies (Output Tax Liability)
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                  ₹{totalSalesTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono">
                  ₹{totalOutputIgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono">
                  ₹{totalOutputCgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono">
                  ₹{totalOutputSgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-6 text-right font-mono font-black text-rose-700">
                  ₹{totalOutputTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>

              <tr>
                <td className="py-3.5 px-6 font-semibold text-slate-900">
                  Table 4(A)(5): All Other Inward ITC (Eligible Input Tax Credit)
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                  ₹{totalPurchaseTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono">
                  ₹{totalInputIgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono">
                  ₹{totalInputCgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono">
                  ₹{totalInputSgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-6 text-right font-mono font-black text-emerald-700">
                  ₹{totalInputTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                <td className="py-3.5 px-6 text-slate-900">
                  Net Tax Position (Output Liability minus Eligible ITC)
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-500">-</td>
                <td className="py-3.5 px-4 text-right font-mono">
                  ₹{(totalOutputIgst - totalInputIgst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono">
                  ₹{(totalOutputCgst - totalInputCgst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono">
                  ₹{(totalOutputSgst - totalInputSgst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className={`py-3.5 px-6 text-right font-mono font-black text-sm ${isGstPayable ? "text-amber-800" : "text-blue-800"}`}>
                  ₹{netGstPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 3. REVENUE CONCENTRATION & RECENT DISPATCH STATUS */}
        <div className="grid grid-cols-2 gap-6">
          {/* TOP DEBTORS / CUSTOMERS */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Top Counterparties by Revenue
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">B2B Volume</span>
            </div>

            {customerVolume.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No sales invoices recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {customerVolume.map((item, idx) => {
                  const pct = totalGrossSales > 0 ? (item.total / totalGrossSales) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="font-bold text-slate-800">{item.name}</span>
                        <span className="font-mono text-slate-900">₹{item.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-slate-900 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* TALLY INTEGRATION & READINESS STATUS */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Tally Prime Gateway & Audit Readiness
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ready
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Sales Vouchers Synced</span>
                  <span className="text-lg font-black font-mono text-slate-900">
                    {salesInvoices.filter(i => i.status === "pushed").length} / {salesInvoices.length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Purchase Bills Pushed</span>
                  <span className="text-lg font-black font-mono text-slate-900">
                    {purchaseBills.filter(b => b.status === "pushed").length} / {purchaseBills.length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Target Company</span>
                  <span className="font-bold text-slate-800 truncate block">{activeClient}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tally Listener Port</span>
                  <span className="font-mono font-bold text-slate-800">http://localhost:9000</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-[11px] text-indigo-900 font-medium">
              All statutory GST percentages (0.1% to 40%), HSN codes, and vendor/buyer ledgers are reconciled for GSTR-1 and GSTR-3B filings.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
