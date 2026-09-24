import React, { useState, useRef } from "react";
import { 
  Building2, 
  FileText, 
  CreditCard, 
  TrendingUp, 
  Archive, 
  Settings, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Check
} from "lucide-react";

// Configurable backend URL (defaults to your live Cloud Run instance)
const API_BASE_URL = 
  import.meta.env.VITE_BACKEND_URL || 
  "https://compliance4-backend-1021821620394.asia-south1.run.app";

export default function App() {
  const [activeTab, setActiveTab] = useState("purchase");
  const [activeClient, setActiveClient] = useState("Panasuria Confectionery");
  const [pendingBills, setPendingBills] = useState([]);
  const [bankTxns, setBankTxns] = useState([]);
  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const [isUploadingBank, setIsUploadingBank] = useState(false);
  const [notification, setNotification] = useState(null);

  const invoiceInputRef = useRef(null);
  const bankInputRef = useRef(null);

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  // ---------------------------------------------------------------------------
  // 1. INVOICE UPLOAD & EXTRACT (With Clear Surface Error Messages)
  // ---------------------------------------------------------------------------
  const handleInvoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingBill(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", activeClient);

    try {
      const res = await fetch(`${API_BASE_URL}/api/invoices/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMsg = errorData?.detail || `Server returned status ${res.status}`;
        throw new Error(errorMsg);
      }

      const extractedBill = await res.json();
      setPendingBills((prev) => [extractedBill, ...prev]);
      notify(`Invoice from ${extractedBill.vendor_name || "Vendor"} extracted successfully!`, "success");
    } catch (err) {
      console.error(err);
      notify(`Extraction failed: ${err.message}`, "error");
    } finally {
      setIsUploadingBill(false);
      if (invoiceInputRef.current) invoiceInputRef.current.value = "";
    }
  };

  // ---------------------------------------------------------------------------
  // 2. BANK STATEMENT UPLOAD & RECONCILIATION
  // ---------------------------------------------------------------------------
  const handleBankUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingBank(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", activeClient);
    formData.append("bank_ledger", "HDFC Bank");

    try {
      const res = await fetch(`${API_BASE_URL}/api/bank/reconcile-file`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMsg = errorData?.detail || `Server returned status ${res.status}`;
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setBankTxns(data);
      notify(`Reconciled ${data.length} transactions successfully!`, "success");
    } catch (err) {
      console.error(err);
      notify(`Reconciliation error: ${err.message}`, "error");
    } finally {
      setIsUploadingBank(false);
      if (bankInputRef.current) bankInputRef.current.value = "";
    }
  };

  // ---------------------------------------------------------------------------
  // 3. PUSH VOUCHER TO TALLY PRIME (PORT 9000)
  // ---------------------------------------------------------------------------
  const handlePushToTally = async (bill) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tally/push-voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bill, company_name: activeClient }),
      });

      const data = await res.json();
      if (data.status === "success" || data.status === "dispatched") {
        notify(`Invoice #${bill.invoice_number} synced with Tally Prime!`, "success");
        setPendingBills((prev) => prev.filter((b) => b.id !== bill.id));
      } else {
        throw new Error(data.error || "Tally sync failed");
      }
    } catch (err) {
      notify(`Tally push failed: ${err.message}`, "error");
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 shadow-sm">
        <div className="flex items-center gap-3 px-2 py-3 border-b border-slate-100">
          <div className="h-10 w-10 bg-[#0F172A] text-white rounded-lg flex items-center justify-center font-bold text-lg tracking-wider">
            C4
          </div>
          <div>
            <h1 className="font-semibold text-slate-900 leading-tight">Compliance4</h1>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Operations Hub</p>
          </div>
        </div>

        <div className="my-5 px-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
            Active Client
          </label>
          <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700">
            <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate">{activeClient}</span>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "dashboard"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Executive Dashboard
          </button>
          <button
            onClick={() => setActiveTab("purchase")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "purchase"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            Purchase Invoices
          </button>
          <button
            onClick={() => setActiveTab("bank")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "bank"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Bank Statement
          </button>
          <button
            onClick={() => setActiveTab("sales")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "sales"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Sales Invoicing
          </button>
          <button
            onClick={() => setActiveTab("archives")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "archives"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Archive className="w-4 h-4" />
            Month Archives
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "settings"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Settings className="w-4 h-4" />
            Master Settings
          </button>
        </nav>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-emerald-800">Tally Port 9000</span>
          </div>
          <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
            Online
          </span>
        </div>
      </aside>

      {/* MAIN BODY CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900 capitalize leading-snug">
              {activeTab === "purchase" ? "Purchase Invoices" : activeTab.replace("-", " ")}
            </h2>
            <p className="text-xs text-slate-500">Organization: {activeClient}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2.5 py-1 rounded border border-slate-200">
              FY 2026–27
            </span>
            <button
              onClick={() => notify("Initiating full sync cycle with Tally Prime...", "info")}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Tally
            </button>
          </div>
        </header>

        {/* TAB WORKSPACE */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "purchase" && (
            <div className="space-y-6">
              {/* ACTION CARD */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Pending Purchase Invoices ({pendingBills.length})
                  </h3>
                  <p className="text-sm text-slate-500">
                    Review AI extractions, verify tax slabs, and push to Tally.
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    ref={invoiceInputRef}
                    onChange={handleInvoiceUpload}
                    accept="application/pdf,image/*"
                    className="hidden"
                  />
                  <button
                    disabled={isUploadingBill}
                    onClick={() => invoiceInputRef.current?.click()}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-50 shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    {isUploadingBill ? "Extracting via Gemini..." : "Upload Invoices"}
                  </button>
                </div>
              </div>

              {/* TABLE OR EMPTY STATE */}
              {pendingBills.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-xl p-16 text-center bg-white">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="font-semibold text-slate-800 text-sm mb-1">No Pending Invoices</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Click "Upload Invoices" to select a PDF or image bill. Gemini AI will automatically extract party details, items, and GST taxes.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Vendor / Party</th>
                        <th className="px-5 py-3">Invoice Details</th>
                        <th className="px-5 py-3">Taxable Value</th>
                        <th className="px-5 py-3">Taxes (GST)</th>
                        <th className="px-5 py-3">Grand Total</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingBills.map((b, idx) => (
                        <tr key={b.id || idx} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">{b.vendor_name}</p>
                            <p className="text-xs text-slate-400">{b.vendor_gstin || "GSTIN Unspecified"}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-slate-800">#{b.invoice_number}</p>
                            <p className="text-xs text-slate-400">{b.invoice_date}</p>
                          </td>
                          <td className="px-5 py-4 font-mono font-medium text-slate-800">
                            ₹{Number(b.taxable_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-4 text-xs font-mono text-slate-600">
                            ₹{Number((b.cgst || 0) + (b.sgst || 0) + (b.igst || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-4 font-mono font-bold text-slate-900">
                            ₹{Number(b.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => handlePushToTally(b)}
                              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Push to Tally
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "bank" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Bank Statement Reconciliation
                  </h3>
                  <p className="text-sm text-slate-500">
                    Upload statement (.xlsx, .csv) for auto-ledger categorization.
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    ref={bankInputRef}
                    onChange={handleBankUpload}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  <button
                    disabled={isUploadingBank}
                    onClick={() => bankInputRef.current?.click()}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-50 shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    {isUploadingBank ? "Reconciling..." : "Upload Statement"}
                  </button>
                </div>
              </div>

              {bankTxns.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Narration</th>
                        <th className="px-5 py-3">Mapped Ledger</th>
                        <th className="px-5 py-3">Debit (₹)</th>
                        <th className="px-5 py-3">Credit (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bankTxns.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-mono text-xs text-slate-500">{t.date}</td>
                          <td className="px-5 py-3 font-medium text-slate-800 max-w-xs truncate">{t.narration}</td>
                          <td className="px-5 py-3">
                            <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-1 rounded">
                              {t.ledger}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-mono text-slate-800">
                            {t.debit > 0 ? `₹${Number(t.debit).toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-5 py-3 font-mono text-emerald-700 font-semibold">
                            {t.credit > 0 ? `₹${Number(t.credit).toLocaleString("en-IN")}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab !== "purchase" && activeTab !== "bank" && (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              <h3 className="text-base font-semibold text-slate-800 mb-1 capitalize">{activeTab} Module</h3>
              <p className="text-xs text-slate-400">Ready for statutory reporting integration.</p>
            </div>
          )}
        </div>
      </main>

      {/* FLOATING ERROR / INFO TOAST */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 max-w-md px-4 py-3 rounded-lg shadow-xl border text-sm flex items-start gap-3 transition-all transform duration-200 z-50 ${
            notification.type === "error"
              ? "bg-rose-950 text-rose-100 border-rose-800"
              : "bg-slate-900 text-white border-slate-800"
          }`}
        >
          {notification.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-mono text-xs break-all leading-relaxed">
            {notification.msg}
          </div>
        </div>
      )}
    </div>
  );
}
