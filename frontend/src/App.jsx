import React, { useState, useRef, useEffect } from "react";
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
  Check,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Plus,
  Trash2,
  X,
  Search,
  ChevronDown
} from "lucide-react";

const API_BASE_URL = 
  import.meta.env.VITE_BACKEND_URL || 
  "https://compliance4-backend-1021821620394.asia-south1.run.app";

// Pre-configured ledger presets for Cafe / Restaurant Accounting
const SUGGESTED_LEDGERS = [
  "Purchase: Beverages",
  "Purchase: Dairy Products",
  "Purchase: Dessert / Bakery",
  "Purchase: Frozen Items",
  "Purchase: Groceries",
  "Purchase: Sauces",
  "Purchase: Vegetables",
  "Purchase: General Goods",
  "Rent Expenses",
  "Staff Salary & Wages",
  "Packaging Materials",
  "Electricity Expenses",
  "Printing & Stationery"
];

export default function App() {
  const [activeTab, setActiveTab] = useState("purchase");
  const [activeClient, setActiveClient] = useState("Panasuria Confectionery");
  const [pendingBills, setPendingBills] = useState([]);
  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const [notification, setNotification] = useState(null);

  // Split-screen Review & Voucher Form State
  const [activeReviewBill, setActiveReviewBill] = useState(null);
  const [voucherMode, setVoucherMode] = useState("accounting"); // "item" or "accounting"
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showAllocationModal, setShowAllocationModal] = useState(false);

  // Form Fields for Active Voucher
  const [voucherData, setVoucherData] = useState(null);

  const invoiceInputRef = useRef(null);

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Open Full-Page Review Workspace
  const openReviewWorkspace = (bill) => {
    setActiveReviewBill(bill);
    setZoomLevel(1);
    
    // Ensure item and accounting ledger lists exist
    const items = bill.items && bill.items.length > 0 ? bill.items : [
      {
        description: "General Supplies",
        qty: 1,
        rate: bill.taxable_amount || 0,
        discount: 0,
        amount: bill.taxable_amount || 0,
        ledger: "Purchase: General Goods"
      }
    ];

    setVoucherData({
      ...bill,
      voucher_type: "Purchase",
      voucher_date: bill.invoice_date || new Date().toISOString().split("T")[0],
      supplier_invoice_no: bill.invoice_number || "",
      bill_date: bill.invoice_date || new Date().toISOString().split("T")[0],
      source_of_supply: bill.place_of_supply || "Gujarat",
      destination_of_supply: "Gujarat",
      purchase_ledger: "Purchase: General Goods",
      narration: `Purchase from ${bill.vendor_name || "Vendor"}`,
      items: items,
      accounting_ledgers: items.map(it => ({
        description: it.description,
        ledger_name: it.ledger || "Purchase: General Goods",
        amount: it.amount || 0
      })),
      round_off: 0.00
    });
  };

  // Upload Invoice and Auto-Open Review
  const handleInvoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingBill(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", activeClient);

    const localPreviewUrl = URL.createObjectURL(file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/invoices/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errObj = await res.json().catch(() => null);
        throw new Error(errObj?.detail || `Server returned status ${res.status}`);
      }

      const extracted = await res.json();
      extracted.file_preview_url = localPreviewUrl;

      setPendingBills(prev => [extracted, ...prev]);
      notify(`Extracted #${extracted.invoice_number || "Bill"} successfully!`, "success");
      openReviewWorkspace(extracted);
    } catch (err) {
      console.error(err);
      notify(`Extraction failed: ${err.message}`, "error");
    } finally {
      setIsUploadingBill(false);
      if (invoiceInputRef.current) invoiceInputRef.current.value = "";
    }
  };

  // Update Calculations
  const updateTotals = (updatedVoucher) => {
    let subtotal = 0;
    if (voucherMode === "item") {
      subtotal = (updatedVoucher.items || []).reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
    } else {
      subtotal = (updatedVoucher.accounting_ledgers || []).reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
    }

    const cgst = parseFloat(updatedVoucher.cgst) || 0;
    const sgst = parseFloat(updatedVoucher.sgst) || 0;
    const igst = parseFloat(updatedVoucher.igst) || 0;
    const roundOff = parseFloat(updatedVoucher.round_off) || 0;
    const grandTotal = subtotal + cgst + sgst + igst + roundOff;

    setVoucherData({
      ...updatedVoucher,
      taxable_amount: subtotal,
      grand_total: parseFloat(grandTotal.toFixed(2))
    });
  };

  // Submit to Tally
  const executeTallyPush = async () => {
    setShowAllocationModal(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tally/push-voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bill: voucherData, company_name: activeClient }),
      });

      const data = await res.json();
      if (data.status === "success" || data.status === "dispatched") {
        notify(`Invoice #${voucherData.supplier_invoice_no} pushed to Tally Prime!`, "success");
        setPendingBills(prev => prev.filter(b => b.id !== activeReviewBill.id));
        setActiveReviewBill(null);
      } else {
        throw new Error(data.error || "Tally transmission failed");
      }
    } catch (err) {
      notify(`Push failed: ${err.message}`, "error");
    }
  };

  // ---------------------------------------------------------------------------
  // FULL PAGE REVIEW WORKSPACE (Side-by-Side)
  // ---------------------------------------------------------------------------
  if (activeReviewBill && voucherData) {
    return (
      <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-800 font-sans">
        {/* TOP BAR */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveReviewBill(null)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Invoices
            </button>
            <h2 className="text-sm font-bold text-slate-800">
              {voucherData.vendor_name || "Invoice Review"}
            </h2>
            <span className="text-xs text-slate-400">| #{voucherData.supplier_invoice_no}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPendingBills(prev => prev.filter(b => b.id !== activeReviewBill.id));
                setActiveReviewBill(null);
              }}
              className="text-xs font-medium text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition"
            >
              Delete Bill
            </button>
            <button
              onClick={() => setShowAllocationModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm"
            >
              <Check className="w-3.5 h-3.5" /> Approve & Push Tally
            </button>
          </div>
        </header>

        {/* SPLIT SCREEN BODY */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT PANE: INVOICE PREVIEW & ZOOM */}
          <div className="w-1/2 bg-slate-200/80 border-r border-slate-300 flex flex-col relative overflow-hidden">
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-slate-300 shadow-sm rounded-lg p-1">
              <button 
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono px-2 text-slate-600">{Math.round(zoomLevel * 100)}%</span>
              <button 
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setZoomLevel(1)}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Document Viewer Container */}
            <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
              {activeReviewBill.file_preview_url ? (
                <img
                  src={activeReviewBill.file_preview_url}
                  alt="Invoice Document"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center" }}
                  className="max-w-full bg-white shadow-xl rounded border border-slate-300 transition-transform duration-150"
                />
              ) : (
                <div className="text-center p-8 bg-white/60 border border-dashed border-slate-400 rounded-xl">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Attached Original Invoice</p>
                  <p className="text-xs text-slate-400 font-mono mt-1">#{voucherData.supplier_invoice_no}</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANE: ACCOUNTING VOUCHER FORM */}
          <div className="w-1/2 bg-white flex flex-col overflow-y-auto">
            {/* Mode Switcher Tabs */}
            <div className="border-b border-slate-200 px-8 pt-4 pb-0 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setVoucherMode("item")}
                  className={`pb-3 text-xs font-bold transition border-b-2 ${
                    voucherMode === "item"
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Item Mode
                </button>
                <button
                  onClick={() => setVoucherMode("accounting")}
                  className={`pb-3 text-xs font-bold transition border-b-2 ${
                    voucherMode === "accounting"
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Accounting Mode
                </button>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded mb-2">
                AI Parsed
              </span>
            </div>

            <div className="p-8 space-y-6">
              {/* SECTION: VOUCHER & INVOICE DETAILS */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Voucher Type</label>
                  <input
                    type="text"
                    disabled
                    value={voucherData.voucher_type}
                    className="w-full text-xs border border-slate-200 bg-slate-50 rounded-lg p-2 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Voucher Date</label>
                  <input
                    type="date"
                    value={voucherData.voucher_date}
                    onChange={(e) => setVoucherData({ ...voucherData, voucher_date: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Supplier Invoice No.</label>
                  <input
                    type="text"
                    value={voucherData.supplier_invoice_no}
                    onChange={(e) => setVoucherData({ ...voucherData, supplier_invoice_no: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Bill Date</label>
                  <input
                    type="date"
                    value={voucherData.bill_date}
                    onChange={(e) => setVoucherData({ ...voucherData, bill_date: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* SECTION: VENDOR DETAILS */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Vendor Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Vendor Name (Sundry Creditor)</label>
                    <input
                      type="text"
                      value={voucherData.vendor_name || ""}
                      onChange={(e) => setVoucherData({ ...voucherData, vendor_name: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 font-semibold focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={voucherData.vendor_gstin || ""}
                      onChange={(e) => setVoucherData({ ...voucherData, vendor_gstin: e.target.value })}
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Place of Supply</label>
                    <input
                      type="text"
                      value={voucherData.source_of_supply || ""}
                      onChange={(e) => setVoucherData({ ...voucherData, source_of_supply: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: ITEM MODE GRID */}
              {voucherMode === "item" && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Item Details</h4>
                    <button
                      onClick={() => {
                        const newItems = [...(voucherData.items || []), {
                          description: "",
                          qty: 1,
                          rate: 0,
                          discount: 0,
                          amount: 0,
                          ledger: voucherData.purchase_ledger
                        }];
                        updateTotals({ ...voucherData, items: newItems });
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-900 hover:text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Item
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="p-2.5">Description</th>
                          <th className="p-2.5 w-16">Qty</th>
                          <th className="p-2.5 w-24">Rate (₹)</th>
                          <th className="p-2.5 w-24">Amount (₹)</th>
                          <th className="p-2.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(voucherData.items || []).map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2">
                              <input
                                type="text"
                                value={it.description}
                                onChange={(e) => {
                                  const updated = [...voucherData.items];
                                  updated[idx].description = e.target.value;
                                  setVoucherData({ ...voucherData, items: updated });
                                }}
                                className="w-full text-xs p-1 border border-transparent hover:border-slate-200 rounded focus:border-slate-400 focus:outline-none"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={it.qty}
                                onChange={(e) => {
                                  const updated = [...voucherData.items];
                                  updated[idx].qty = parseFloat(e.target.value) || 0;
                                  updated[idx].amount = (updated[idx].qty * updated[idx].rate) - (updated[idx].discount || 0);
                                  updateTotals({ ...voucherData, items: updated });
                                }}
                                className="w-full text-xs p-1 border border-transparent hover:border-slate-200 rounded focus:border-slate-400 focus:outline-none"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={it.rate}
                                onChange={(e) => {
                                  const updated = [...voucherData.items];
                                  updated[idx].rate = parseFloat(e.target.value) || 0;
                                  updated[idx].amount = (updated[idx].qty * updated[idx].rate) - (updated[idx].discount || 0);
                                  updateTotals({ ...voucherData, items: updated });
                                }}
                                className="w-full text-xs font-mono p-1 border border-transparent hover:border-slate-200 rounded focus:border-slate-400 focus:outline-none"
                              />
                            </td>
                            <td className="p-2 font-mono font-medium text-slate-800">
                              ₹{(parseFloat(it.amount) || 0).toFixed(2)}
                            </td>
                            <td className="p-2 text-right">
                              <button
                                onClick={() => {
                                  const updated = voucherData.items.filter((_, i) => i !== idx);
                                  updateTotals({ ...voucherData, items: updated });
                                }}
                                className="text-slate-300 hover:text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION: ACCOUNTING MODE GRID */}
              {voucherMode === "accounting" && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Expense Ledgers</h4>
                    <button
                      onClick={() => {
                        const newLedgers = [...(voucherData.accounting_ledgers || []), {
                          description: "Additional Charge",
                          ledger_name: "Purchase: General Goods",
                          amount: 0
                        }];
                        updateTotals({ ...voucherData, accounting_ledgers: newLedgers });
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-900 hover:text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Ledger
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="p-2.5">Item Narration</th>
                          <th className="p-2.5">Ledger Name</th>
                          <th className="p-2.5 w-28">Amount (₹)</th>
                          <th className="p-2.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(voucherData.accounting_ledgers || []).map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2">
                              <input
                                type="text"
                                value={it.description}
                                onChange={(e) => {
                                  const updated = [...voucherData.accounting_ledgers];
                                  updated[idx].description = e.target.value;
                                  setVoucherData({ ...voucherData, accounting_ledgers: updated });
                                }}
                                className="w-full text-xs p-1 border border-transparent hover:border-slate-200 rounded focus:border-slate-400 focus:outline-none"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={it.ledger_name}
                                onChange={(e) => {
                                  const updated = [...voucherData.accounting_ledgers];
                                  updated[idx].ledger_name = e.target.value;
                                  setVoucherData({ ...voucherData, accounting_ledgers: updated });
                                }}
                                className="w-full text-xs p-1 bg-white border border-slate-200 rounded focus:border-slate-400 focus:outline-none font-medium"
                              >
                                {SUGGESTED_LEDGERS.map((led) => (
                                  <option key={led} value={led}>{led}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={it.amount}
                                onChange={(e) => {
                                  const updated = [...voucherData.accounting_ledgers];
                                  updated[idx].amount = parseFloat(e.target.value) || 0;
                                  updateTotals({ ...voucherData, accounting_ledgers: updated });
                                }}
                                className="w-full text-xs font-mono p-1 border border-transparent hover:border-slate-200 rounded focus:border-slate-400 focus:outline-none font-medium"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <button
                                onClick={() => {
                                  const updated = voucherData.accounting_ledgers.filter((_, i) => i !== idx);
                                  updateTotals({ ...voucherData, accounting_ledgers: updated });
                                }}
                                className="text-slate-300 hover:text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION: SUMMARY & GST BREAKDOWN */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-600 font-medium">
                  <span>Sub Total (Taxable Value):</span>
                  <span className="font-mono">₹{(voucherData.taxable_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">CGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={voucherData.cgst || 0}
                      onChange={(e) => updateTotals({ ...voucherData, cgst: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs font-mono border border-slate-300 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">SGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={voucherData.sgst || 0}
                      onChange={(e) => updateTotals({ ...voucherData, sgst: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs font-mono border border-slate-300 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">IGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={voucherData.igst || 0}
                      onChange={(e) => updateTotals({ ...voucherData, igst: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs font-mono border border-slate-300 rounded p-1.5"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="text-xs text-slate-500">Round Off Adjustment (₹):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={voucherData.round_off || 0}
                    onChange={(e) => updateTotals({ ...voucherData, round_off: parseFloat(e.target.value) || 0 })}
                    className="w-24 text-right text-xs font-mono border border-slate-300 rounded p-1"
                  />
                </div>

                <div className="flex justify-between items-center text-sm font-bold text-slate-900 pt-3 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span className="font-mono text-base">₹{(voucherData.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BILL ALLOCATION MODAL (Tally Reference Tracking) */}
        {showAllocationModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Bill Allocation for {voucherData.vendor_name}
                </h3>
                <button onClick={() => setShowAllocationModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Type of Ref</label>
                    <select className="w-full border border-slate-300 rounded p-2 bg-slate-50 font-medium">
                      <option>New Reference</option>
                      <option>Against Reference</option>
                      <option>Advance</option>
                      <option>On Account</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Name / Ref No.</label>
                    <input
                      type="text"
                      readOnly
                      value={voucherData.supplier_invoice_no}
                      className="w-full border border-slate-200 rounded p-2 bg-slate-50 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Due Date</label>
                    <input
                      type="date"
                      defaultValue={voucherData.voucher_date}
                      className="w-full border border-slate-300 rounded p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Allocated Amount (₹)</label>
                    <input
                      type="number"
                      readOnly
                      value={voucherData.grand_total}
                      className="w-full border border-slate-200 rounded p-2 bg-slate-50 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-100 text-xs">
                <span className="text-slate-500">Net Bill Amount: ₹{voucherData.grand_total}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAllocationModal(false)}
                    className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeTallyPush}
                    className="px-4 py-1.5 rounded font-semibold bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    Confirm & Allocate
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN LISTING VIEW
  // ---------------------------------------------------------------------------
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
            Dashboard
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
            Purchases
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
            Sales
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
            Banking
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
            Settings
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

      {/* MAIN LISTING WORKSPACE */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900 capitalize">Purchases</h2>
            <p className="text-xs text-slate-500">{activeClient}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => notify("Connecting to Tally Prime XML server on port 9000...", "info")}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sync
            </button>
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
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {isUploadingBill ? "Extracting..." : "Upload Bills"}
            </button>
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Pending Verification ({pendingBills.length})
              </h3>
              <p className="text-xs text-slate-400">Click any row to open the side-by-side review workspace</p>
            </div>

            {pendingBills.length === 0 ? (
              <div className="p-16 text-center">
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No pending bills</p>
                <p className="text-xs text-slate-400 mt-0.5">Click "Upload Bills" to start parsing invoices with Gemini AI</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Vendor</th>
                    <th className="px-6 py-3.5">Invoice No.</th>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Taxable (₹)</th>
                    <th className="px-6 py-3.5">Total Amount (₹)</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingBills.map((b, idx) => (
                    <tr 
                      key={b.id || idx} 
                      onClick={() => openReviewWorkspace(b)}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{b.vendor_name || "Unknown Party"}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{b.vendor_gstin || "No GSTIN"}</p>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700 font-mono">
                        #{b.invoice_number}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {b.invoice_date}
                      </td>
                      <td className="px-6 py-4 font-mono font-medium text-slate-800">
                        ₹{(parseFloat(b.taxable_amount) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        ₹{(parseFloat(b.grand_total) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openReviewWorkspace(b)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] px-3 py-1.5 rounded transition"
                        >
                          Review & Push
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* FLOATING ERROR/SUCCESS BANNER */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 max-w-md px-4 py-3 rounded-lg shadow-xl border text-sm flex items-start gap-3 transition-all z-50 ${
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
