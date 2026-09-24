import React, { useState } from 'react';
import { 
  Building2, FileText, Landmark, ShoppingBag, FolderArchive, 
  Settings, CheckCircle2, AlertCircle, Plus, Eye, Download, 
  Send, RefreshCw, ZoomIn, ZoomOut, RotateCcw, ArrowLeft, ArrowRight
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState('The Marx Ventures');
  const [activeMonthArchive, setActiveMonthArchive] = useState('2026-08');

  const clients = ['The Marx Ventures', 'Indbuy Global Pvt Ltd', 'Pansuria Confectionery'];

  // Sample Purchase Bill state for demonstration
  const [reviewIndex, setReviewIndex] = useState(null);
  const [pendingBills, setPendingBills] = useState([
    {
      id: "inv-1",
      file_name: "Regenta_Foods_August.pdf",
      vendor_name: "REGENTA M FOODS",
      vendor_ledger: "REGENTA M FOODS",
      vendor_gstin: "24AAECR4960M1Z4",
      source_state: "Gujarat",
      destination_state: "Gujarat",
      invoice_number: "RM/26-21/6751",
      invoice_date: "2026-08-24",
      subtotal: 7820.00,
      cgst: 195.50,
      sgst: 195.50,
      igst: 0.00,
      round_off: 0.00,
      grand_total: 8211.00,
      items: [
        { description: "Monin Yuzu Fruit Mix 1ltr", qty: 4, rate: 1650, amount: 6600, ledger: "Purchase: Beverages" },
        { description: "Monin French Vanilla 700ml", qty: 2, rate: 610, amount: 1220, ledger: "Purchase: Dairy Products" }
      ]
    }
  ]);

  // Sample Bank Reconciliation records (lean format, no GST column)
  const [bankTxns, setBankTxns] = useState([
    { id: 1, date: "2026-08-01", narration: "UPI-5267823901-swiggy-orders@hdfc", debit: 0, credit: 380.00, type: "Receipt", ledger: "UPI Collection", verified: true },
    { id: 2, date: "2026-08-01", narration: "CASH DEPOSIT - SELF / PLATINUM", debit: 0, credit: 4500.00, type: "Contra", ledger: "Cash in Hand", verified: true },
    { id: 3, date: "2026-08-02", narration: "NEFT-UTIB0001004-MANSURA CONFECTION", debit: 527.96, credit: 0, type: "Payment", ledger: "MANSURA CONFECTIONERY", verified: true },
    { id: 4, date: "2026-08-02", narration: "UPI-910391039129-tea-refreshment", debit: 180.00, credit: 0, type: "Payment", ledger: "Staff Welfare Expense", verified: false }
  ]);

  // Sample Sales Invoices
  const [salesList, setSalesList] = useState([
    { inv_no: "INV-123", customer: "Asiana Food & Beverage Llp", date: "2026-09-24", amount: 693.00, status: "CREDIT", pos: "Haryana" },
    { inv_no: "GST-122/26-27", customer: "Penguin Overseas", date: "2026-09-24", amount: 10172.00, status: "CREDIT", pos: "Haryana" }
  ]);

  // Modals and Drawers
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocType, setAllocType] = useState('New Reference');
  const [zoomLevel, setZoomLevel] = useState(100);

  // Approve Purchase Bill Handlers
  const handleApproveBill = () => {
    setShowAllocateModal(false);
    setPendingBills(pendingBills.filter((_, idx) => idx !== reviewIndex));
    setReviewIndex(null);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-4 z-20 shadow-sm">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center text-white font-serif font-bold text-xl shadow-md">C4</div>
            <div>
              <div className="font-serif font-bold text-brand-navy tracking-tight">Compliance4</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold">Operations Hub</div>
            </div>
          </div>

          {/* Client Organization Picker */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">Active Client</label>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-navy" />
              <select 
                value={selectedClient} 
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-brand-navy focus:outline-none cursor-pointer"
              >
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Executive Dashboard', icon: FileText },
              { id: 'purchase', label: 'Purchase Invoices', icon: ShoppingBag, count: pendingBills.length },
              { id: 'bank', label: 'Bank Statement', icon: Landmark, count: bankTxns.filter(t => !t.verified).length },
              { id: 'sales', label: 'Sales Invoicing', icon: FileText },
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
                      ? 'bg-brand-navy text-white shadow-md' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${isActive ? 'bg-white text-brand-navy' : 'bg-red-100 text-red-700'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Info / Direct Tally Ping Status */}
        <div className="p-3 bg-brand-mint/60 border border-green-200 rounded-xl">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Tally Port 9000
            </span>
            <span className="font-bold text-emerald-700 text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full">ONLINE</span>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-brand-mint/20">
        {/* Top Header Banner */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between z-10">
          <div>
            <h1 className="text-lg font-serif font-bold text-brand-navy capitalize">{activeTab.replace('_', ' ')}</h1>
            <p className="text-xs text-slate-400 font-medium">Organization: <span className="font-bold text-slate-600">{selectedClient}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 font-semibold bg-slate-100 px-3 py-1.5 rounded-full">
              FY 2026–27
            </div>
            <button className="flex items-center gap-1.5 bg-brand-navy text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm hover:bg-slate-800">
              <RefreshCw className="w-3.5 h-3.5" /> Sync Tally
            </button>
          </div>
        </header>

        {/* DYNAMIC CONTENT ROUTER */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* 1. EXECUTIVE DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-5">
                {[
                  { title: "Monthly Sales", val: "₹1,84,320", trend: "+12.4%", sub: "vs last month" },
                  { title: "Monthly Purchases", val: "₹1,12,650", trend: "-4.2%", sub: "18 Invoices verified" },
                  { title: "Bank Net Liquidity", val: "₹9,71,450", trend: "Normal", sub: "HDFC A/c 8050" },
                  { title: "Total Receivables", val: "₹34,800", trend: "2 Overdue", sub: "Credit customer outstandings" }
                ].map((card, i) => (
                  <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{card.title}</div>
                    <div className="text-2xl font-serif font-bold text-brand-navy mt-1">{card.val}</div>
                    <div className="text-xs text-slate-500 mt-2 flex items-center justify-between">
                      <span>{card.sub}</span>
                      <span className="font-bold text-emerald-600">{card.trend}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="font-serif font-bold text-brand-navy">Purchase Verification Queue</h3>
                  <p className="text-xs text-slate-500">You have {pendingBills.length} purchase invoices awaiting review for {selectedClient}.</p>
                  <button onClick={() => setActiveTab('purchase')} className="px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl shadow">
                    Review Invoices &rarr;
                  </button>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="font-serif font-bold text-brand-navy">Unassigned Bank Transactions</h3>
                  <p className="text-xs text-slate-500">{bankTxns.filter(t => !t.verified).length} transactions require ledger assignment.</p>
                  <button onClick={() => setActiveTab('bank')} className="px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl shadow">
                    Open Bank Reconciliation &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. PURCHASE WORKSPACE */}
          {activeTab === 'purchase' && reviewIndex === null && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                <div>
                  <h2 className="text-sm font-bold text-brand-navy">Pending Purchase Invoices ({pendingBills.length})</h2>
                  <p className="text-xs text-slate-400">Review AI extractions, verify tax slabs, and push to Tally.</p>
                </div>
                <button className="flex items-center gap-1.5 px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl shadow">
                  <Plus className="w-3.5 h-3.5" /> Upload Invoices
                </button>
              </div>

              {pendingBills.map((b, idx) => (
                <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-bold text-brand-navy text-base">{b.vendor_name}</div>
                    <div className="text-xs text-slate-500">
                      Invoice <b>#{b.invoice_number}</b> &nbsp;|&nbsp; Date: {b.invoice_date} &nbsp;|&nbsp; GSTIN: {b.vendor_gstin}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-lg font-bold text-brand-navy">₹{b.grand_total.toLocaleString()}</div>
                      <div className="text-[11px] text-slate-400">Taxable: ₹{b.subtotal.toLocaleString()}</div>
                    </div>
                    <button 
                      onClick={() => setReviewIndex(idx)} 
                      className="px-5 py-2.5 bg-brand-navy text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800"
                    >
                      Review & Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SPLIT-SCREEN PURCHASE BILL REVIEW */}
          {activeTab === 'purchase' && reviewIndex !== null && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex">
              <div className="w-1/2 h-full bg-[#525659] flex flex-col border-r border-slate-700">
                <div className="flex items-center justify-between px-4 py-2 bg-[#1E293B] text-white text-xs">
                  <span className="font-semibold">{pendingBills[reviewIndex].file_name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setZoomLevel(z => Math.min(z + 20, 200))} className="p-1 bg-slate-700 rounded"><ZoomIn className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setZoomLevel(z => Math.max(z - 20, 60))} className="p-1 bg-slate-700 rounded"><ZoomOut className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setZoomLevel(100)} className="p-1 bg-slate-700 rounded"><RotateCcw className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
                  <div style={{ width: `${zoomLevel}%` }} className="bg-white p-8 rounded shadow-2xl min-h-[700px] text-center text-slate-400 font-mono text-xs">
                    [ Document Preview: {pendingBills[reviewIndex].file_name} ]
                  </div>
                </div>
              </div>

              <div className="w-1/2 h-full bg-white flex flex-col justify-between p-8 overflow-y-auto">
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b pb-4">
                    <h2 className="text-lg font-serif font-bold text-brand-navy">Review Voucher: {pendingBills[reviewIndex].vendor_name}</h2>
                    <button onClick={() => setReviewIndex(null)} className="text-xs text-slate-400 hover:text-slate-700">&times; Close</button>
                  </div>

                  {/* Vendor Details */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-500 block mb-1">Vendor Name</label>
                      <input type="text" readOnly value={pendingBills[reviewIndex].vendor_name} className="w-full p-2 border rounded bg-slate-50 font-semibold" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-500 block mb-1">Tally Sundry Creditor Ledger</label>
                      <input type="text" defaultValue={pendingBills[reviewIndex].vendor_ledger} className="w-full p-2 border border-blue-400 rounded font-semibold" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-500 block mb-1">GSTIN</label>
                      <input type="text" readOnly value={pendingBills[reviewIndex].vendor_gstin} className="w-full p-2 border rounded bg-slate-50" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-500 block mb-1">Place of Supply (POS)</label>
                      <input type="text" readOnly value={pendingBills[reviewIndex].destination_state} className="w-full p-2 border rounded bg-slate-50" />
                    </div>
                  </div>

                  {/* Items Grid */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-600 text-xs uppercase tracking-wider block">Line Item Ledgers</label>
                    <table className="w-full text-xs text-left border">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="p-2">Item Description</th>
                          <th className="p-2">Qty</th>
                          <th className="p-2">Amount</th>
                          <th className="p-2">Tally Purchase Ledger</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingBills[reviewIndex].items.map((itm, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2 font-medium">{itm.description}</td>
                            <td className="p-2">{itm.qty}</td>
                            <td className="p-2 font-bold">₹{itm.amount}</td>
                            <td className="p-2">
                              <input type="text" defaultValue={itm.ledger} className="w-full p-1 border rounded text-blue-900 font-semibold" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Taxes Summary */}
                  <div className="bg-slate-50 p-4 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between text-slate-500"><span>Taxable:</span><span>₹{pendingBills[reviewIndex].subtotal}</span></div>
                    <div className="flex justify-between text-slate-500"><span>CGST + SGST:</span><span>₹{pendingBills[reviewIndex].cgst + pendingBills[reviewIndex].sgst}</span></div>
                    <div className="flex justify-between text-slate-500"><span>Round-off:</span><span>₹0.00</span></div>
                    <div className="flex justify-between text-base font-bold text-brand-navy pt-2 border-t">
                      <span>Grand Total:</span>
                      <span>₹{pendingBills[reviewIndex].grand_total}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6 border-t">
                  <button onClick={() => setShowAllocateModal(true)} className="flex-1 py-3 bg-brand-navy text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800">
                    ✅ Approve & Allocate
                  </button>
                  <button onClick={() => setReviewIndex(null)} className="px-6 py-3 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. LEAN BANK STATEMENT GRID */}
          {activeTab === 'bank' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h2 className="text-base font-bold text-brand-navy">Bank Statement Reconciliation (HDFC Bank - 8050)</h2>
                  <p className="text-xs text-slate-400">Review narrations, auto-learn ledger allocations, and push to Tally.</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50">
                    Upload Statement (PDF / Excel)
                  </button>
                  <button className="px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl shadow">
                    Save Verified Rules
                  </button>
                </div>
              </div>

              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-2">Date</th>
                    <th className="py-3 px-2">Description / Narration</th>
                    <th className="py-3 px-2">Type</th>
                    <th className="py-3 px-2">Assigned Tally Ledger</th>
                    <th className="py-3 px-2 text-right">Debit (₹)</th>
                    <th className="py-3 px-2 text-right">Credit (₹)</th>
                    <th className="py-3 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bankTxns.map(row => (
                    <tr key={row.id} className="border-b hover:bg-slate-50/80 transition">
                      <td className="py-3 px-2 font-medium">{row.date}</td>
                      <td className="py-3 px-2 max-w-xs truncate font-medium text-slate-700" title={row.narration}>{row.narration}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.type === 'Payment' ? 'bg-amber-100 text-amber-800' :
                          row.type === 'Receipt' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <input 
                          type="text" 
                          defaultValue={row.ledger} 
                          className="p-1 border border-slate-200 rounded font-semibold text-brand-navy w-48 focus:border-blue-500 focus:outline-none" 
                        />
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-slate-700">{row.debit > 0 ? `₹${row.debit.toFixed(2)}` : '-'}</td>
                      <td className="py-3 px-2 text-right font-bold text-emerald-600">{row.credit > 0 ? `₹${row.credit.toFixed(2)}` : '-'}</td>
                      <td className="py-3 px-2 text-center">
                        {row.verified ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Verified</span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. SALES INVOICES */}
          {activeTab === 'sales' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h2 className="text-base font-bold text-brand-navy">Sales Invoices Register</h2>
                  <p className="text-xs text-slate-400">Generate GST tax invoices, share on WhatsApp, and track customer outstandings.</p>
                </div>
                <button onClick={() => setShowSalesModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl shadow">
                  <Plus className="w-3.5 h-3.5" /> Create Sale Invoice
                </button>
              </div>

              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-2">Invoice No</th>
                    <th className="py-3 px-2">Customer Company</th>
                    <th className="py-3 px-2">Date</th>
                    <th className="py-3 px-2">Place of Supply</th>
                    <th className="py-3 px-2">Total Amount</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salesList.map(s => (
                    <tr key={s.inv_no} className="border-b hover:bg-slate-50/80">
                      <td className="py-3 px-2 font-bold text-brand-navy">{s.inv_no}</td>
                      <td className="py-3 px-2 font-medium">{s.customer}</td>
                      <td className="py-3 px-2">{s.date}</td>
                      <td className="py-3 px-2">{s.pos}</td>
                      <td className="py-3 px-2 font-bold">₹{s.amount.toFixed(2)}</td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right flex justify-end gap-2">
                        <button className="p-1 text-slate-500 hover:text-brand-navy"><Eye className="w-4 h-4" /></button>
                        <button className="p-1 text-slate-500 hover:text-brand-navy"><Download className="w-4 h-4" /></button>
                        <button className="p-1 text-emerald-600 hover:text-emerald-800"><Send className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 5. MONTH ARCHIVES (REQUIREMENT #5) */}
          {activeTab === 'archives' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h2 className="text-base font-bold text-brand-navy">Archived Records Repository</h2>
                  <p className="text-xs text-slate-400">View approved historical vouchers organized strictly by financial period.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600">Select Month:</label>
                  <input 
                    type="month" 
                    value={activeMonthArchive} 
                    onChange={(e) => setActiveMonthArchive(e.target.value)} 
                    className="text-xs p-2 border rounded-xl font-bold text-brand-navy bg-slate-50"
                  />
                </div>
              </div>

              <div className="p-8 text-center text-slate-400 font-medium text-xs">
                Showing all approved Purchase and Bank vouchers archived under <b>{activeMonthArchive}</b>.
              </div>
            </div>
          )}

        </div>
      </main>

      {/* BILL ALLOCATION MODAL ON APPROVE */}
      {showAllocateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-serif font-bold text-brand-navy text-base">Tally Bill Allocation</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-500 block mb-1">Type of Reference</label>
                <select value={allocType} onChange={(e) => setAllocType(e.target.value)} className="w-full p-2 border rounded font-semibold">
                  <option>New Reference</option>
                  <option>Against Reference</option>
                  <option>Advance</option>
                  <option>On Account</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1">Supplier Invoice Number</label>
                <input type="text" readOnly value={pendingBills[reviewIndex]?.invoice_number} className="w-full p-2 border rounded bg-slate-50 font-bold" />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1">Target Monthly Archive</label>
                <input type="month" defaultValue="2026-08" className="w-full p-2 border rounded font-semibold" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={() => setShowAllocateModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600">Cancel</button>
              <button onClick={handleApproveBill} className="px-5 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl shadow">Confirm & Allocate</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE SALES INVOICE DRAWER / MODAL */}
      {showSalesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-4">
            <h3 className="font-serif font-bold text-brand-navy text-base">New GST Tax Invoice</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-500 block mb-1">Customer / M/S</label>
                <input type="text" placeholder="Search customer..." className="w-full p-2 border rounded font-semibold" />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1">Place of Supply (State)</label>
                <input type="text" defaultValue="Gujarat" className="w-full p-2 border rounded font-semibold" />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1">Invoice Prefix & No</label>
                <input type="text" defaultValue="INV-124" className="w-full p-2 border rounded font-bold text-brand-navy" />
              </div>
              <div>
                <label className="font-bold text-slate-500 block mb-1">Invoice Date</label>
                <input type="date" defaultValue="2026-09-24" className="w-full p-2 border rounded" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={() => setShowSalesModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600">Cancel</button>
              <button onClick={() => setShowSalesModal(false)} className="px-5 py-2 bg-brand-navy text-white text-xs font-bold rounded-xl shadow">Save & Generate PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
