import React, { useState } from 'react';
import { 
  Building2, FileText, Landmark, ShoppingBag, FolderArchive, 
  Settings, CheckCircle2, AlertCircle, Plus, Eye, Download, 
  Send, RefreshCw, ZoomIn, ZoomOut, RotateCcw, ArrowLeft, ArrowRight, UploadCloud
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState('Default Client Organization');
  const [activeMonthArchive, setActiveMonthArchive] = useState('2026-09');

  // Starts completely clean - zero dummy vendors
  const [clients, setClients] = useState(['Default Client Organization']);
  const [pendingBills, setPendingBills] = useState([]);
  const [bankTxns, setBankTxns] = useState([]);
  const [salesList, setSalesList] = useState([]);

  // Split-screen purchase review modal state
  const [reviewIndex, setReviewIndex] = useState(null);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocType, setAllocType] = useState('New Reference');
  const [zoomLevel, setZoomLevel] = useState(100);

  return (
    <div className="flex h-screen w-full bg-[#F4F7F5] overflow-hidden text-slate-800">
      
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
              Active Organization
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

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between z-10">
          <div>
            <h1 className="text-lg font-serif font-bold text-[#0D2240] capitalize">{activeTab.replace('_', ' ')}</h1>
            <p className="text-xs text-slate-400 font-medium">Client Organization: <span className="font-bold text-slate-600">{selectedClient}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 font-semibold bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              FY 2026–27
            </div>
            <button className="flex items-center gap-1.5 bg-[#0D2240] text-white text-xs font-bold px-4 py-2 rounded-full shadow hover:bg-slate-800 transition">
              <RefreshCw className="w-3.5 h-3.5" /> Sync Tally
            </button>
          </div>
        </header>

        {/* PAGE CONTENT ROUTER */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* 1. DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-5">
                {[
                  { title: "Monthly Sales", val: "₹0.00", sub: "0 Invoices generated" },
                  { title: "Monthly Purchases", val: "₹0.00", sub: "0 Invoices processed" },
                  { title: "Bank Net Liquidity", val: "₹0.00", sub: "Reconciliation pending" },
                  { title: "Total Receivables", val: "₹0.00", sub: "Zero overdue balances" }
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
                  <p className="text-xs text-slate-500">No invoices pending review. Upload purchase bills to start AI item parsing.</p>
                  <button onClick={() => setActiveTab('purchase')} className="px-4 py-2 bg-[#0D2240] text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800">
                    Go to Purchases &rarr;
                  </button>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="font-serif font-bold text-[#0D2240]">Bank Reconciliation Feed</h3>
                  <p className="text-xs text-slate-500">No bank transactions loaded. Upload Excel or PDF statement to auto-match ledgers.</p>
                  <button onClick={() => setActiveTab('bank')} className="px-4 py-2 bg-[#0D2240] text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800">
                    Open Bank Feed &rarr;
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
                  <h2 className="text-sm font-bold text-[#0D2240]">Purchase Invoices Queue</h2>
                  <p className="text-xs text-slate-400">Review AI extracted bills, verify tax allocations, and push to Tally Prime.</p>
                </div>
                <button className="flex items-center gap-1.5 px-4 py-2 bg-[#0D2240] text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800">
                  <Plus className="w-3.5 h-3.5" /> Upload Invoices
                </button>
              </div>

              {pendingBills.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-[#0D2240] text-sm">No Pending Invoices</div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Click "Upload Invoices" above to upload your PDF or image bills. Gemini AI will extract vendor details, line items, and taxes automatically.
                  </p>
                </div>
              ) : null}
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
                <div className="flex gap-2">
                  <button className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition">
                    Upload Statement (PDF / Excel)
                  </button>
                </div>
              </div>

              {bankTxns.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-xs text-slate-400 font-medium">No transactions loaded for this period.</p>
                  <p className="text-[11px] text-slate-400">Upload your bank statement file to view lean transactions (without GST columns) and start auto-mapping.</p>
                </div>
              ) : null}
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
                No archived vouchers found under <b>{activeMonthArchive}</b> for {selectedClient}.
              </div>
            </div>
          )}

        </div>
      </main>

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
