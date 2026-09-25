import React, { useState, useRef, useEffect } from "react";
import { 
  Building2, 
  FileText, 
  CreditCard, 
  TrendingUp, 
  Settings, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Check,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Plus,
  Trash2,
  X,
  Send
} from "lucide-react";

const API_BASE_URL = 
  import.meta.env.VITE_BACKEND_URL || 
  "https://compliance4-backend-1021821620394.asia-south1.run.app";

const SUGGESTED_EXPENSE_LEDGERS = [
  "Purchase: Beverages",
  "Purchase: Dairy Products",
  "Purchase: Dessert / Bakery",
  "Purchase: Frozen Items",
  "Purchase: Groceries",
  "Purchase: Sauces",
  "Purchase: Vegetables",
  "Purchase: General Goods",
  "Packaging Materials",
  "Kitchen Consumables",
  "Printing & Stationery",
  "Repair & Maintenance"
];

const SUGGESTED_GST_LEDGERS = [
  "Input CGST",
  "Input SGST",
  "Input IGST",
  "CGST Input Tax",
  "SGST Input Tax",
  "IGST Input Tax",
  "GST Input 2.5%",
  "GST Input 6%",
  "GST Input 9%",
  "GST Input 14%"
];

const SUGGESTED_ITEMS = [
  "Vanilla Flavoring Extract",
  "Chocolate Compound 35.4%",
  "Dairy Whipping Cream",
  "Whole Milk 1L",
  "Baking Flour / Maida",
  "Granulated Sugar",
  "Cocoa Powder Dark",
  "Monin Flavored Syrups",
  "Paper Coffee Cups 250ml",
  "General Bakery Item"
];

export default function App() {
  const [activeTab, setActiveTab] = useState("purchase");
  const [purchaseSubTab, setPurchaseSubTab] = useState("needs_review"); // "needs_review" | "approved"
  const [activeClient, setActiveClient] = useState("Panasuria Confectionery");

  // Persistent Invoices Store in localStorage
  const [pendingBills, setPendingBills] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_pending_bills");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [approvedBills, setApprovedBills] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_approved_bills");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("c4_pending_bills", JSON.stringify(pendingBills));
  }, [pendingBills]);

  useEffect(() => {
    localStorage.setItem("c4_approved_bills", JSON.stringify(approvedBills));
  }, [approvedBills]);

  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const [notification, setNotification] = useState(null);

  // Review & Form State
  const [activeReviewBill, setActiveReviewBill] = useState(null);
  const [voucherMode, setVoucherMode] = useState("accounting"); // "item" | "accounting"
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [voucherData, setVoucherData] = useState(null);

  const invoiceInputRef = useRef(null);

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Convert File to Base64 for Persistent Offline Image Viewing
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  // Open Full-Screen Review
  const openReviewWorkspace = (bill) => {
    setActiveReviewBill(bill);
    setZoomLevel(1);

    const items = bill.items && bill.items.length > 0 ? bill.items : [
      {
        item_name: bill.vendor_name ? "General Purchase" : "Bakery Raw Material",
        description: bill.vendor_name || "General Supplies",
        qty: 1,
        rate: bill.taxable_amount || 0,
        amount: bill.taxable_amount || 0
      }
    ];

    setVoucherData({
      ...bill,
      voucher_type: bill.voucher_type || "Purchase",
      voucher_date: bill.voucher_date || bill.invoice_date || new Date().toISOString().split("T")[0],
      supplier_invoice_no: bill.supplier_invoice_no || bill.invoice_number || "",
      bill_date: bill.bill_date || bill.invoice_date || new Date().toISOString().split("T")[0],
      source_of_supply: bill.source_of_supply || bill.place_of_supply || "Gujarat",
      destination_of_supply: bill.destination_of_supply || "Gujarat",
      cgst_ledger: bill.cgst_ledger || "Input CGST",
      sgst_ledger: bill.sgst_ledger || "Input SGST",
      igst_ledger: bill.igst_ledger || "Input IGST",
      round_off: bill.round_off || 0.00,
      items: items.map(it => ({
        item_name: it.item_name || it.description || "General Item",
        description: it.description || "",
        qty: it.qty || 1,
        rate: it.rate || it.amount || 0,
        amount: it.amount || 0
      })),
      accounting_ledgers: bill.accounting_ledgers || items.map(it => ({
        description: it.description || "Raw Material",
        ledger_name: it.ledger_name || "Purchase: Beverages",
        amount: it.amount || 0
      }))
    });
  };

  // Upload Invoice
  const handleInvoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingBill(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", activeClient);

    let persistentPreview = "";
    try {
      persistentPreview = await fileToBase64(file);
    } catch {
      persistentPreview = "";
    }

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
      extracted.id = extracted.id || `inv_${Date.now()}`;
      extracted.file_preview_url = persistentPreview;

      setPendingBills(prev => [extracted, ...prev]);
      setPurchaseSubTab("needs_review");
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

  // Recalculate Totals
  const updateTotals = (updated) => {
    let subtotal = 0;
    if (voucherMode === "item") {
      subtotal = (updated.items || []).reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
    } else {
      subtotal = (updated.accounting_ledgers || []).reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
    }

    const cgst = parseFloat(updated.cgst) || 0;
    const sgst = parseFloat(updated.sgst) || 0;
    const igst = parseFloat(updated.igst) || 0;
    const roundOff = parseFloat(updated.round_off) || 0;
    const grandTotal = subtotal + cgst + sgst + igst + roundOff;

    setVoucherData({
      ...updated,
      taxable_amount: subtotal,
      grand_total: parseFloat(grandTotal.toFixed(2))
    });
  };

  // Move from "Needs Review" to "Approved"
  const handleApproveInvoice = () => {
    setShowAllocationModal(false);
    const approvedVoucher = { ...voucherData, isApproved: true };

    setPendingBills(prev => prev.filter(b => b.id !== activeReviewBill.id));
    setApprovedBills(prev => [approvedVoucher, ...prev.filter(b => b.id !== approvedVoucher.id)]);
    setActiveReviewBill(null);
    setPurchaseSubTab("approved");
    notify(`Invoice #${approvedVoucher.supplier_invoice_no} approved! Ready to push to Tally.`, "success");
  };

  // Push to Tally Prime from Approved Tab
  const handlePushToTally = async (bill) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tally/push-voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bill, company_name: activeClient }),
      });

      const data = await res.json();
      if (data.status === "success" || data.status === "dispatched") {
        notify(`Invoice #${bill.supplier_invoice_no || bill.invoice_number} synced with Tally Prime!`, "success");
        setApprovedBills(prev => prev.filter(b => b.id !== bill.id));
      } else {
        throw new Error(data.error || "Tally transmission failed");
      }
    } catch (err) {
      notify(`Push failed: ${err.message}`, "error");
    }
  };

  // ---------------------------------------------------------------------------
  // FULL SCREEN SIDE-BY-SIDE REVIEW WORKSPACE
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
                setApprovedBills(prev => prev.filter(b => b.id !== activeReviewBill.id));
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
              <Check className="w-3.5 h-3.5" /> Approve Bill
            </button>
          </div>
        </header>

        {/* SPLIT SCREEN BODY */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: FULL-BLEED DOCUMENT PREVIEW (Header Uncropped) */}
          <div className="w-1/2 bg-slate-200 border-r border-slate-300 relative overflow-hidden flex flex-col">
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-slate-300 shadow-sm rounded-lg p-1">
              <button 
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 2.5))}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono px-2 text-slate-600">{Math.round(zoomLevel * 100)}%</span>
              <button 
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.4))}
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

            {/* Scrollable image starting directly at 0,0 top margin */}
            <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
              {voucherData.file_preview_url ? (
                <img
                  src={voucherData.file_preview_url}
                  alt="Original Document"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: "top center",
                    maxWidth: "96%",
                    marginTop: "8px"
                  }}
                  className="bg-white shadow-xl rounded border border-slate-300 transition-transform duration-100"
                />
              ) : (
                <div className="text-center p-12 bg-white/70 border border-dashed border-slate-400 rounded-xl mt-12">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Attached Original Invoice</p>
                  <p className="text-xs text-slate-400 font-mono mt-1">#{voucherData.supplier_invoice_no}</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: ACCOUNTING VOUCHER FORM */}
          <div className="w-1/2 bg-white flex flex-col overflow-y-auto">
            {/* Mode Toggle */}
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
              {/* VOUCHER HEADER FIELDS */}
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
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Supplier Invoice No.</label>
                  <input
                    type="text"
                    value={voucherData.supplier_invoice_no}
                    onChange={(e) => setVoucherData({ ...voucherData, supplier_invoice_no: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Bill Date</label>
                  <input
                    type="date"
                    value={voucherData.bill_date}
                    onChange={(e) => setVoucherData({ ...voucherData, bill_date: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              {/* VENDOR DETAILS */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Vendor Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Vendor Name (Sundry Creditor)</label>
                    <input
                      type="text"
                      value={voucherData.vendor_name || ""}
                      onChange={(e) => setVoucherData({ ...voucherData, vendor_name: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={voucherData.vendor_gstin || ""}
                      onChange={(e) => setVoucherData({ ...voucherData, vendor_gstin: e.target.value })}
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Place of Supply</label>
                    <input
                      type="text"
                      value={voucherData.source_of_supply || ""}
                      onChange={(e) => setVoucherData({ ...voucherData, source_of_supply: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2"
                    />
                  </div>
                </div>
              </div>

              {/* ITEM MODE: INCLUDES SELECTABLE ITEM DROPDOWN */}
              {voucherMode === "item" && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Inventory Items</h4>
                    <button
                      onClick={() => {
                        const newItems = [...(voucherData.items || []), {
                          item_name: "General Bakery Item",
                          description: "",
                          qty: 1,
                          rate: 0,
                          amount: 0
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
                          <th className="p-2.5 w-48">Select Item</th>
                          <th className="p-2.5">Description</th>
                          <th className="p-2.5 w-16">Qty</th>
                          <th className="p-2.5 w-20">Rate (₹)</th>
                          <th className="p-2.5 w-24">Amount (₹)</th>
                          <th className="p-2.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(voucherData.items || []).map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2">
                              <select
                                value={it.item_name}
                                onChange={(e) => {
                                  const updated = [...voucherData.items];
                                  updated[idx].item_name = e.target.value;
                                  setVoucherData({ ...voucherData, items: updated });
                                }}
                                className="w-full text-xs p-1 bg-white border border-slate-200 rounded font-medium"
                              >
                                {SUGGESTED_ITEMS.map((item) => (
                                  <option key={item} value={item}>{item}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={it.description}
                                onChange={(e) => {
                                  const updated = [...voucherData.items];
                                  updated[idx].description = e.target.value;
                                  setVoucherData({ ...voucherData, items: updated });
                                }}
                                className="w-full text-xs p-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={it.qty}
                                onChange={(e) => {
                                  const updated = [...voucherData.items];
                                  updated[idx].qty = parseFloat(e.target.value) || 0;
                                  updated[idx].amount = (updated[idx].qty * updated[idx].rate);
                                  updateTotals({ ...voucherData, items: updated });
                                }}
                                className="w-full text-xs p-1 border border-slate-200 rounded"
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
                                  updated[idx].amount = (updated[idx].qty * updated[idx].rate);
                                  updateTotals({ ...voucherData, items: updated });
                                }}
                                className="w-full text-xs font-mono p-1 border border-slate-200 rounded"
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

              {/* ACCOUNTING MODE */}
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
                          <th className="p-2.5">Item Description</th>
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
                                className="w-full text-xs p-1 border border-slate-200 rounded"
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
                                className="w-full text-xs p-1 bg-white border border-slate-200 rounded font-medium"
                              >
                                {SUGGESTED_EXPENSE_LEDGERS.map((led) => (
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
                                className="w-full text-xs font-mono p-1 border border-slate-200 rounded font-medium"
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

              {/* GST LEDGER SELECTION & TOTALS */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex justify-between text-xs text-slate-600 font-medium">
                  <span>Sub Total (Taxable Value):</span>
                  <span className="font-mono">₹{(voucherData.taxable_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

                {/* CGST Row */}
                <div className="grid grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">CGST Ledger</label>
                    <select
                      value={voucherData.cgst_ledger}
                      onChange={(e) => setVoucherData({ ...voucherData, cgst_ledger: e.target.value })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded font-medium"
                    >
                      {SUGGESTED_GST_LEDGERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">CGST Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={voucherData.cgst || 0}
                      onChange={(e) => updateTotals({ ...voucherData, cgst: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs font-mono border border-slate-300 rounded p-1.5"
                    />
                  </div>
                </div>

                {/* SGST Row */}
                <div className="grid grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">SGST Ledger</label>
                    <select
                      value={voucherData.sgst_ledger}
                      onChange={(e) => setVoucherData({ ...voucherData, sgst_ledger: e.target.value })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded font-medium"
                    >
                      {SUGGESTED_GST_LEDGERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">SGST Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={voucherData.sgst || 0}
                      onChange={(e) => updateTotals({ ...voucherData, sgst: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs font-mono border border-slate-300 rounded p-1.5"
                    />
                  </div>
                </div>

                {/* IGST Row */}
                <div className="grid grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">IGST Ledger</label>
                    <select
                      value={voucherData.igst_ledger}
                      onChange={(e) => setVoucherData({ ...voucherData, igst_ledger: e.target.value })}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded font-medium"
                    >
                      {SUGGESTED_GST_LEDGERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">IGST Amount (₹)</label>
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

        {/* APPROVE BILL CONFIRMATION MODAL */}
        {showAllocationModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Confirm Bill Approval
                </h3>
                <button onClick={() => setShowAllocationModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Are you ready to approve invoice <strong>#{voucherData.supplier_invoice_no}</strong> from <strong>{voucherData.vendor_name}</strong> for <strong>₹{voucherData.grand_total}</strong>?
                </p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-[11px] text-slate-500">
                    Once approved, this voucher moves into the <strong>Approved Invoices</strong> tab where it can be directly transmitted into Tally Prime.
                  </p>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 text-xs">
                <button
                  onClick={() => setShowAllocationModal(false)}
                  className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveInvoice}
                  className="px-4 py-1.5 rounded font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Approve & Move to Sync
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN WORKSPACE (2 TABS: Needs Review & Approved)
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

      {/* PURCHASES LISTING */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Purchase Invoices</h2>
            <p className="text-xs text-slate-500">{activeClient}</p>
          </div>
          <div className="flex items-center gap-3">
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
              {isUploadingBill ? "Extracting with Gemini..." : "Upload Bills"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {/* TAB HEADERS: Needs Review vs Approved */}
          <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
            <button
              onClick={() => setPurchaseSubTab("needs_review")}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
                purchaseSubTab === "needs_review"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Needs Review
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                purchaseSubTab === "needs_review" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"
              }`}>
                {pendingBills.length}
              </span>
            </button>

            <button
              onClick={() => setPurchaseSubTab("approved")}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
                purchaseSubTab === "approved"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Approved Invoices
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                purchaseSubTab === "approved" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
              }`}>
                {approvedBills.length}
              </span>
            </button>
          </div>

          {/* TAB 1: NEEDS REVIEW */}
          {purchaseSubTab === "needs_review" && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {pendingBills.length === 0 ? (
                <div className="p-16 text-center">
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No invoices needing review</p>
                  <p className="text-xs text-slate-400 mt-0.5">Upload a bill to extract details using Gemini AI</p>
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
                    {pendingBills.map((b) => (
                      <tr 
                        key={b.id} 
                        onClick={() => openReviewWorkspace(b)}
                        className="hover:bg-slate-50 cursor-pointer transition"
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{b.vendor_name || "Unknown Vendor"}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{b.vendor_gstin || "No GSTIN"}</p>
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-slate-800">
                          #{b.invoice_number || b.supplier_invoice_no}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {b.invoice_date || b.bill_date}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-700">
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
                            Review & Verify
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 2: APPROVED INVOICES (PUSHABLE TO TALLY) */}
          {purchaseSubTab === "approved" && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {approvedBills.length === 0 ? (
                <div className="p-16 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No approved invoices</p>
                  <p className="text-xs text-slate-400 mt-0.5">Approve verified invoices in "Needs Review" to sync them to Tally Prime</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
                    <tr>
                      <th className="px-6 py-3.5">Vendor</th>
                      <th className="px-6 py-3.5">Invoice No.</th>
                      <th className="px-6 py-3.5">Ledger Allocation</th>
                      <th className="px-6 py-3.5">Total Amount (₹)</th>
                      <th className="px-6 py-3.5 text-right">Tally Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {approvedBills.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{b.vendor_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{b.vendor_gstin}</p>
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-slate-800">
                          #{b.supplier_invoice_no || b.invoice_number}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          <span className="bg-slate-100 px-2 py-1 rounded text-[11px] font-medium">
                            {b.accounting_ledgers?.[0]?.ledger_name || "Purchase"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-emerald-700">
                          ₹{(parseFloat(b.grand_total) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handlePushToTally(b)}
                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3.5 py-1.5 rounded transition shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" /> Push to Tally
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>

      {/* FLOATING TOAST */}
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
