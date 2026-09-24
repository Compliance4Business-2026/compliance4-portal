import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, FileText, Landmark, ShoppingBag, FolderArchive, 
  Settings, CheckCircle2, AlertCircle, Plus, Eye, Download, 
  Send, RefreshCw, ZoomIn, ZoomOut, RotateCcw, ArrowLeft, ArrowRight, 
  UploadCloud, Loader2, Check
} from 'lucide-react';

const API_BASE_URL = "https://compliance4-backend-1021821620394.asia-south1.run.app";

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState('Panasuria Confectionery');
  const [clients, setClients] = useState(['Panasuria Confectionery', 'The Marx Ventures', 'Indbuy Global Pvt Ltd']);
  const [activeMonthArchive, setActiveMonthArchive] = useState('2026-09');

  // Live Data States
  const [pendingBills, setPendingBills] = useState([]);
  const [bankTxns, setBankTxns] = useState([]);
  const [salesList, setSalesList] = useState([]);
  
  // Loading & Processing Flags
  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const [isUploadingBank, setIsUploadingBank] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Hidden File Inputs
  const invoiceInputRef = useRef(null);
  const bankInputRef = useRef(null);

  // Split-screen Invoice Review Modal
  const [reviewIndex, setReviewIndex] = useState(null);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Helper notification toaster
  const notify = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // 1. Handle Invoice File Upload & Gemini Extraction
  const handleInvoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingBill(true);
    notify(`Processing ${file.name} with Gemini AI...`);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", selectedClient);

    try {
      const res = await fetch(`${API_BASE_URL}/api/invoices/upload`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const extractedBill = await res.json();
      setPendingBills((prev) => [extractedBill, ...prev]);
      notify(`Invoice from ${extractedBill.vendor_name || 'Vendor'} extracted successfully!`);
    } catch (err) {
      console.error(err);
      notify("Extraction error: Check backend connectivity or file format.");
    } finally {
      setIsUploadingBill(false);
      if (invoiceInputRef.current) invoiceInputRef.current.value = "";
    }
  };

  // 2. Handle Bank Statement Upload & Reconciliation
  const handleBankUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingBank(true);
    notify(`Reconciling bank statement ${file.name}...`);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", selectedClient);
    formData.append("bank_ledger", "HDFC Bank");

    try {
      const res = await fetch(`${API_BASE_URL}/api/bank/reconcile-file`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const txns = await res.json();
      setBankTxns(txns);
      notify(`Loaded ${txns.length} bank transactions with auto-assigned ledgers!`);
    } catch (err) {
      console.error(err);
      notify("Bank parsing error: Verify format.");
    } finally {
      setIsUploadingBank(false);
      if (bankInputRef.current) bankInputRef.current.value = "";
    }
  };

  // 3. Push Approved Purchase Invoice to Tally Prime
  const handleApproveAndPush = async (bill) => {
    notify(`Dispatching ${bill.invoice_number} to Tally Prime port 9000...`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tally/push-voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bill: bill, company_name: selectedClient })
      });
      const data = await res.json();
      if (data.status === "success") {
        notify("Pushed to Tally Prime successfully!");
        setPendingBills((prev) => prev.filter((b) => b.id !== bill.id));
        setReviewIndex(null);
      } else {
        notify("Tally Bridge responded with a warning.");
      }
    } catch (err) {
      notify("Could not reach local Tally daemon on port 9000.");
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F4F7F5] overflow-hidden text-slate-800">
      
      {/* Hidden File Input Triggers */}
      <input 
        type="file" 
        ref={invoiceInputRef} 
        onChange={handleInvoiceUpload} 
        accept=".pdf,.png,.jpg,.jpeg" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={bankInputRef} 
        onChange={handleBankUpload} 
        accept=".pdf,.xlsx,.xls,.csv" 
        className="hidden" 
      />

      {/* Floating Status Notification Toast */}
      {statusMessage && (
        <div className="fixed bottom-6 right-6 bg-[#0D2240] text-white px-5 py-3 rounded-xl shadow-2xl z-50 text-xs font-semibold flex items-center gap-2 border border-slate-700 animate-in slide-in-from-bottom">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          {statusMessage}
        </div>
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-4 z-20 shadow-sm">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-[#0D2240] flex items-center justify-center text-white font-serif font-bold text-xl shadow-md">
              C4
            </div>
            <div>
              <div className="font-serif font-bold text-[#0D2240] tracking-tight">Compliance4</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold">Operations Hub</div>
            </div>
          </div>

          {/* Client Organization Selector */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
              Active Client
            </label>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0D2240]" />
              <select 
                value={selectedClient} 
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-[#0D2240] focus:outline-none cursor-pointer"
              >
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Executive Dashboard', icon: FileText },
              { id: 'purchase', label: 'Purchase Invoices', icon: ShoppingBag, count: pendingBills.length },
              { id: 'bank', label: 'Bank Statement', icon: Landmark, count: bankTxns.filter(t => !t.verified).length },
              { id: 'sales', label: 'Sales Invoicing', icon: FileText, count: salesList.length },
              { id: 'archives', label: 'Month Archives', icon: FolderArchive },
              { id: 'settings', label: 'Master Settings', icon: Settings }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setReviewIndex(null); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive 
                      ? 'bg-[#0D2240] text-white shadow-md' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${isActive ? 'bg-white text-[#0D2240]' : 'bg-red-100 text-red-700'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tally Connectivity Status Badge */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Tally Port 9000
            </span>
            <span className="font-bold text-emerald-700 text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full">ONLINE</span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between z-10">
          <div>
            <h1 className="text-lg font-serif font-bold text-[#0D2240] capitalize">{activeTab.replace('_', ' ')}</h1>
            <p className="text-xs text-slate-400 font-medium">Organization: <span className="font-bold text-slate-600">{selectedClient}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 font-semibold bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              FY 2026–27
            </div>
            <button 
              onClick={() => notify("Syncing active ledger balances with Tally Prime...")}
              className="flex items-center gap-1.5 bg-[#0D2240] text-white text-xs font-bold px-4 py-2 rounded-full shadow hover:bg-slate-800 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sync Tally
            </button>
          </div>
        </header>

        {/* PAGE VIEWS */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* 1. DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-5">
                {[
                  { title: "Monthly Sales", val: "₹0.00", sub: "0 Invoices generated" },
                  { title: "Monthly Purchases", val: `₹${pendingBills.reduce((acc, b) => acc + (b.grand_total || 0), 0).toLocaleString('en-IN')}`, sub: `${pendingBills.length} Invoices pending` },
                  { title: "Bank Net Liquidity", val: "₹0.00", sub: `${bankTxns.length} Transactions loaded` },
                  { title: "Total Receivables", val: "₹0.00", sub: "0 Overdue balances" }
                ].map((card, i) => (
                  <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{card.title}</div>
                    <div className="text-2xl font-serif font-bold text-[#0D2240] mt-1">{card.val}</div>
                    <div className="text-xs text-slate-500 mt-2">{card.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="font-serif font-bold text-[#0D2240]">Purchase Verification Queue</h3>
                  <p className="text-xs text-slate-500">
                    {pendingBills.length > 0 ? `You have ${pendingBills.length} purchase invoices awaiting review.` : 'No invoices in the queue.'}
                  </p>
                  <button 
                    onClick={() => setActiveTab('purchase')} 
                    className="px-4 py-2 bg-[#0D2240] text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800"
                  >
                    Review Invoices &rarr;
                  </button>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="font-serif font-bold text-[#0D2240]">Bank Statement Reconciliation</h3>
                  <p className="text-xs text-slate-500">
                    {bankTxns.length > 0 ? `${bankTxns.length} transactions ready for auto-ledger assignment.` : 'No bank statements loaded.'}
                  </p>
                  <button 
                    onClick={() => setActiveTab('bank')} 
                    className="px-4 py-2 bg-[#0D2240] text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800"
                  >
                    Open Bank Reconciliation &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. PURCHASE BILLS TAB */}
          {activeTab === 'purchase' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-[#0D2240]">Pending Purchase Invoices ({pendingBills.length})</h2>
                  <p className="text-xs text-slate-400">Review AI extractions, verify tax slabs, and push to Tally.</p>
                </div>
                <button 
                  onClick={() => invoiceInputRef.current?.click()}
                  disabled={isUploadingBill}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#0D2240] text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800 disabled:opacity-50"
                >
                  {isUploadingBill ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} 
                  Upload Invoices
                </button>
              </div>

              {pendingBills.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-[#0D2240] text-sm">No Pending Invoices</div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Click "Upload Invoices" to select a PDF or image bill. Gemini AI will automatically extract party details, items, and GST taxes.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingBills.map((bill, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0D2240] text-sm">{bill.vendor_name || 'Unknown Vendor'}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">#{bill.invoice_number}</span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-3">
                          <span>Date: {bill.invoice_date}</span>
                          <span>GSTIN: {bill.vendor_gstin || 'Unregistered'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-base font-serif font-bold text-[#0D2240]">₹{bill.grand_total?.toLocaleString('en-IN')}</div>
                          <div className="text-[11px] text-slate-400">Taxable: ₹{bill.taxable_amount?.toLocaleString('en-IN')}</div>
                        </div>
                        <button 
                          onClick={() => setReviewIndex(idx)}
                          className="px-4 py-2 bg-[#0D2240] text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800"
                        >
                          Review & Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. BANK STATEMENT TAB */}
          {activeTab === 'bank' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h2 className="text-base font-bold text-[#0D2240]">Bank Statement Reconciliation</h2>
                  <p className="text-xs text-slate-400">Upload statement to auto-learn counterparty rules and push directly to Tally Prime.</p>
                </div>
                <button 
                  onClick={() => bankInputRef.current?.click()}
                  disabled={isUploadingBank}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
                >
                  {isUploadingBank ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                  Upload Statement (PDF / Excel)
                </button>
              </div>

              {bankTxns.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-xs text-slate-400 font-medium">No transactions loaded for this period.</p>
                  <p className="text-[11px] text-slate-400">Upload your bank statement file to view lean transactions without GST columns and start auto-mapping.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[10px]">
                        <th className="py-3 px-2">Date</th>
                        <th className="py-3 px-2">Description / Narration</th>
                        <th className="py-3 px-2">Type</th>
                        <th className="py-3 px-2">Assigned Tally Ledger</th>
                        <th className="py-3 px-2 text-right">Debit (₹)</th>
                        <th className="py-3 px-2 text-right">Credit (₹)</th>
                        <th className="py-3 px-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {bankTxns.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 px-2 font-mono text-slate-500">{t.date}</td>
                          <td className="py-3 px-2 max-w-xs truncate">{t.narration}</td>
                          <td className="py-3 px-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.type === 'Receipt' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <input 
                              type="text" 
                              defaultValue={t.ledger} 
                              className="w-full p-1.5 border border-slate-200 rounded font-semibold text-[#0D2240] focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="py-3 px-2 text-right font-mono">{t.debit > 0 ? `₹${t.debit.toLocaleString('en-IN')}` : '-'}</td>
                          <td className="py-3 px-2 text-right font-mono">{t.credit > 0 ? `₹${t.credit.toLocaleString('en-IN')}` : '-'}</td>
                          <td className="py-3 px-2 text-center">
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Verified
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4. SALES INVOICING TAB */}
          {activeTab === 'sales' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h2 className="text-base font-bold text-[#0D2240]">Sales Invoices Register</h2>
                  <p className="text-xs text-slate-400">Generate GST tax invoices, share on WhatsApp, and track customer outstandings.</p>
                </div>
                <button onClick={() => setShowSalesModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-[#0D2240] text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800">
                  <Plus className="w-3.5 h-3.5" /> Create Sale Invoice
                </button>
              </div>

              {salesList.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-xs text-slate-400 font-medium">No sales invoices generated yet.</p>
                  <p className="text-[11px] text-slate-400">Click "Create Sale Invoice" above to issue customer bills with auto-calculated GST and QR payment codes.</p>
                </div>
              ) : null}
            </div>
          )}

          {/* 5. MONTH ARCHIVES TAB */}
          {activeTab === 'archives' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h2 className="text-base font-bold text-[#0D2240]">Archived Records Repository</h2>
                  <p className="text-xs text-slate-400">Access approved historical vouchers organized strictly by financial month.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600">Select Month:</label>
                  <input 
                    type="month" 
                    value={activeMonthArchive} 
                    onChange={(e) => setActiveMonthArchive(e.target.value)} 
                    className="text-xs p-2 border rounded-xl font-bold text-[#0D2240] bg-slate-50 focus:outline-none"
                  />
                </div>
              </div>
              <div className="py-12 text-center text-slate-400 text-xs">
                No archived records found under <b>{activeMonthArchive}</b> for {selectedClient}.
              </div>
            </div>
          )}

        </div>
      </main>

      {/* SPLIT-SCREEN VERIFICATION MODAL */}
      {reviewIndex !== null && pendingBills[reviewIndex] && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="font-serif font-bold text-[#0D2240] text-sm">
                  Review Voucher: {pendingBills[reviewIndex].vendor_name}
                </span>
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                  {pendingBills[reviewIndex].invoice_number}
                </span>
              </div>
              <button onClick={() => setReviewIndex(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
                &times;
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Document Viewer */}
              <div className="w-1/2 bg-slate-900 border-r border-slate-200 p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-300 text-xs border-b border-slate-700 pb-2 mb-2">
                  <span>Document View</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setZoomLevel(z => Math.max(50, z - 10))} className="p-1 hover:text-white"><ZoomOut className="w-4 h-4" /></button>
                    <span>{zoomLevel}%</span>
                    <button onClick={() => setZoomLevel(z => Math.min(200, z + 10))} className="p-1 hover:text-white"><ZoomIn className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 rounded-xl border border-slate-800 text-slate-500 text-xs">
                  {pendingBills[reviewIndex].file_url ? (
                    <iframe src={pendingBills[reviewIndex].file_url} className="w-full h-full border-none rounded-xl" title="Invoice Preview" />
                  ) : (
                    <span>Original Document Stream Available</span>
                  )}
                </div>
              </div>

              {/* Right Column: AI Extraction & Ledger Allocations */}
              <div className="w-1/2 p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-400 block mb-1">Vendor Name</label>
                    <input 
                      type="text" 
                      defaultValue={pendingBills[reviewIndex].vendor_name} 
                      className="w-full p-2 border border-slate-300 rounded-lg font-semibold text-[#0D2240]"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-400 block mb-1">Tally Sundry Creditor</label>
                    <input 
                      type="text" 
                      defaultValue={pendingBills[reviewIndex].vendor_ledger || pendingBills[reviewIndex].vendor_name} 
                      className="w-full p-2 border border-slate-300 rounded-lg font-semibold text-[#0D2240]"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-400 block mb-1">GSTIN</label>
                    <input 
                      type="text" 
                      defaultValue={pendingBills[reviewIndex].vendor_gstin} 
                      className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-400 block mb-1">Place of Supply</label>
                    <input 
                      type="text" 
                      defaultValue={pendingBills[reviewIndex].place_of_supply || "Gujarat"} 
                      className="w-full p-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-bold text-xs text-[#0D2240] uppercase tracking-wider mb-2">Line Items & Expense Ledgers</h4>
                  <div className="space-y-2">
                    {(pendingBills[reviewIndex].items || []).map((itm, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800">{itm.description}</div>
                          <div className="text-[11px] text-slate-400">Qty: {itm.qty || 1} &times; ₹{itm.rate}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-[#0D2240]">₹{itm.amount}</span>
                          <input 
                            type="text" 
                            defaultValue={itm.ledger || "Purchase: General Goods"} 
                            className="text-xs p-1 border rounded bg-white font-semibold text-slate-700"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Taxable Amount</span>
                    <span className="font-mono">₹{pendingBills[reviewIndex].taxable_amount}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>CGST + SGST / IGST</span>
                    <span className="font-mono">₹{((pendingBills[reviewIndex].cgst || 0) + (pendingBills[reviewIndex].sgst || 0) + (pendingBills[reviewIndex].igst || 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#0D2240] pt-2 border-t">
                    <span>Grand Total</span>
                    <span className="font-mono">₹{pendingBills[reviewIndex].grand_total}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button 
                    onClick={() => setReviewIndex(null)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleApproveAndPush(pendingBills[reviewIndex])}
                    className="px-5 py-2 bg-[#0D2240] text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Approve & Push to Tally
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE SALES INVOICE MODAL */}
      {showSalesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-serif font-bold text-[#0D2240] text-base">Generate GST Tax Invoice</h3>
              <button onClick={() => setShowSalesModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-500 block mb-1">Customer / M/S</label>
                <input type="text" placeholder="Enter customer trade name..." className="w-full p-2 border border-slate-300 rounded-lg font-semibold focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1">Place of Supply (State)</label>
                <input type="text" defaultValue="Gujarat" className="w-full p-2 border border-slate-300 rounded-lg font-semibold" />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1">Invoice Prefix & Number</label>
                <input type="text" defaultValue="INV-001" className="w-full p-2 border border-slate-300 rounded-lg font-bold text-[#0D2240]" />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1">Invoice Date</label>
                <input type="date" defaultValue="2026-09-24" className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={() => setShowSalesModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => setShowSalesModal(false)} className="px-5 py-2 bg-[#0D2240] text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800">Save & Generate PDF</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
