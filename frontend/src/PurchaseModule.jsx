import React, { useState, useRef, useEffect } from "react";
import { 
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
  Send,
  Edit2,
  Download,
  FileCode,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Sparkles
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

const GST_STATE_CODES = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
  "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
};

function validateGSTIN(gstin) {
  if (!gstin) return { isValid: false, reason: "Missing GSTIN" };
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) return { isValid: false, reason: "Must be 15 characters" };
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) return { isValid: false, reason: "Invalid pattern or 14th character is not 'Z'" };

  const stateCode = clean.substring(0, 2);
  const stateName = GST_STATE_CODES[stateCode];
  if (!stateName) return { isValid: false, reason: `Invalid State: ${stateCode}` };

  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let factor = 1;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const codePoint = chars.indexOf(clean[i]);
    let addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / 36) + (addend % 36);
    sum += addend;
  }
  const remainder = sum % 36;
  const checkCodePoint = (36 - remainder) % 36;
  const expectedCheckChar = chars[checkCodePoint];
  const isValid = (expectedCheckChar === clean[14]);

  return { 
    isValid, 
    stateName, 
    reason: isValid ? null : `Checksum failed (expected ${expectedCheckChar})` 
  };
}

export default function PurchaseModule({ activeClient = "Panasuria Confectionery" }) {
  const [purchaseSubTab, setPurchaseSubTab] = useState("needs_review");

  // Persistent Stores in localStorage
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

  const [pushedBills, setPushedBills] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_pushed_bills");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Memorized Item -> Ledger Store
  const [itemRules, setItemRules] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_purchase_item_rules");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("c4_pending_bills", JSON.stringify(pendingBills));
  }, [pendingBills]);

  useEffect(() => {
    localStorage.setItem("c4_approved_bills", JSON.stringify(approvedBills));
  }, [approvedBills]);

  useEffect(() => {
    localStorage.setItem("c4_pushed_bills", JSON.stringify(pushedBills));
  }, [pushedBills]);

  useEffect(() => {
    localStorage.setItem("c4_purchase_item_rules", JSON.stringify(itemRules));
  }, [itemRules]);

  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [notification, setNotification] = useState(null);

  // Review & Form State
  const [activeReviewBill, setActiveReviewBill] = useState(null);
  const [voucherMode, setVoucherMode] = useState("accounting");
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

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  const checkDuplicateInvoice = (invoiceNo, vendorName, currentId = null) => {
    if (!invoiceNo) return null;
    const cleanInv = invoiceNo.trim().toUpperCase();
    const cleanVen = (vendorName || "").trim().toLowerCase();

    const allBills = [
      ...pendingBills.map(b => ({ ...b, stage: "Needs Review" })),
      ...approvedBills.map(b => ({ ...b, stage: "Approved Invoices" })),
      ...pushedBills.map(b => ({ ...b, stage: "Pushed to Tally" }))
    ];

    return allBills.find(b => {
      if (currentId && b.id === currentId) return false;
      const bInv = (b.supplier_invoice_no || b.invoice_number || "").trim().toUpperCase();
      const bVen = (b.vendor_name || "").trim().toLowerCase();
      return bInv === cleanInv && (bVen === cleanVen || !cleanVen);
    });
  };

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

    const mappedAccountingLedgers = bill.accounting_ledgers || items.map(it => {
      const cleanKey = (it.item_name || it.description || "").trim().toLowerCase();
      const memorized = itemRules[cleanKey];
      return {
        description: it.description || "Raw Material",
        ledger_name: memorized || it.ledger_name || "Purchase: Beverages",
        amount: it.amount || 0,
        isAutoMatched: Boolean(memorized)
      };
    });

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
      items: items.map(it => {
        const cleanKey = (it.item_name || it.description || "").trim().toLowerCase();
        const memorized = itemRules[cleanKey];
        return {
          item_name: it.item_name || it.description || "General Item",
          description: it.description || "",
          qty: it.qty || 1,
          rate: it.rate || it.amount || 0,
          amount: it.amount || 0,
          memorized_ledger: memorized || null
        };
      }),
      accounting_ledgers: mappedAccountingLedgers
    });
  };

  const handleMultipleInvoiceUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingBill(true);
    let successCount = 0;
    let newExtractedBills = [];
    let duplicateWarningsCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Processing ${i + 1} of ${files.length}: ${file.name}...`);

      let persistentPreview = "";
      try {
        persistentPreview = await fileToBase64(file);
      } catch {
        persistentPreview = "";
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("company_name", activeClient);

      try {
        const res = await fetch(`${API_BASE_URL}/api/invoices/upload`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const extracted = await res.json();
          extracted.id = extracted.id || `inv_${Date.now()}_${i}`;
          extracted.file_preview_url = persistentPreview;

          if (extracted.items && extracted.items.length > 0) {
            extracted.accounting_ledgers = extracted.items.map(it => {
              const cleanKey = (it.item_name || it.description || "").trim().toLowerCase();
              const memorized = itemRules[cleanKey];
              return {
                description: it.description || it.item_name || "Supplies",
                ledger_name: memorized || "Purchase: General Goods",
                amount: it.amount || 0,
                isAutoMatched: Boolean(memorized)
              };
            });
          }

          const invNo = extracted.supplier_invoice_no || extracted.invoice_number;
          const duplicate = checkDuplicateInvoice(invNo, extracted.vendor_name);
          if (duplicate) {
            extracted.duplicateWarning = `Already present in ${duplicate.stage}`;
            duplicateWarningsCount++;
          }

          newExtractedBills.push(extracted);
          successCount++;
        }
      } catch (err) {
        console.error(`Failed to process ${file.name}:`, err);
      }
    }

    if (newExtractedBills.length > 0) {
      setPendingBills(prev => [...newExtractedBills, ...prev]);
      if (duplicateWarningsCount > 0) {
        notify(`Parsed ${successCount} bills (${duplicateWarningsCount} duplicate warnings detected)!`, "info");
      } else {
        notify(`Successfully extracted ${successCount} out of ${files.length} bills!`, "success");
      }
      setPurchaseSubTab("needs_review");
    } else {
      notify("Failed to parse the selected bills. Check file formats.", "error");
    }

    setIsUploadingBill(false);
    setUploadProgress("");
    if (invoiceInputRef.current) invoiceInputRef.current.value = "";
  };

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

  const handleLedgerSelection = (idx, newLedger, descriptionOrItemName) => {
    const updated = [...voucherData.accounting_ledgers];
    updated[idx].ledger_name = newLedger;
    updated[idx].isAutoMatched = true;
    setVoucherData({ ...voucherData, accounting_ledgers: updated });

    if (descriptionOrItemName) {
      const cleanKey = descriptionOrItemName.trim().toLowerCase();
      setItemRules(prev => ({
        ...prev,
        [cleanKey]: newLedger
      }));
      notify(`Memorized "${descriptionOrItemName}" → ${newLedger}`, "info");
    }
  };

  // AUTOMATIC TRANSITION TO NEXT BILL ON APPROVE
  const handleApproveInvoice = () => {
    setShowAllocationModal(false);
    const approvedVoucher = { ...voucherData, isApproved: true };

    const remainingPending = pendingBills.filter(b => b.id !== activeReviewBill.id);
    setPendingBills(remainingPending);
    setApprovedBills(prev => [approvedVoucher, ...prev.filter(b => b.id !== approvedVoucher.id)]);

    notify(`Invoice #${approvedVoucher.supplier_invoice_no} approved!`, "success");

    // Automatically shift to the next bill in the queue
    if (remainingPending.length > 0) {
      openReviewWorkspace(remainingPending[0]);
    } else {
      setActiveReviewBill(null);
      setPurchaseSubTab("approved");
    }
  };

  // AUTOMATIC TRANSITION TO NEXT BILL ON DELETE
  const handleDeleteCurrentReviewBill = () => {
    const remainingPending = pendingBills.filter(b => b.id !== activeReviewBill.id);
    setPendingBills(remainingPending);
    setApprovedBills(prev => prev.filter(b => b.id !== activeReviewBill.id));

    notify("Invoice deleted.", "info");

    // Automatically shift to the next bill in the queue
    if (remainingPending.length > 0) {
      openReviewWorkspace(remainingPending[0]);
    } else {
      setActiveReviewBill(null);
    }
  };

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
        setPushedBills(prev => [{ ...bill, pushed_at: new Date().toLocaleString() }, ...prev]);
      } else {
        throw new Error(data.error || "Tally transmission failed");
      }
    } catch (err) {
      notify(`Push failed: ${err.message}`, "error");
    }
  };

  const handleDownloadExcel = () => {
    if (approvedBills.length === 0) {
      notify("No approved invoices to export.", "error");
      return;
    }

    const headers = [
      "Voucher Date",
      "Supplier Invoice No",
      "Bill Date",
      "Vendor Name",
      "GSTIN",
      "Place of Supply",
      "Expense Ledger",
      "Taxable Value",
      "CGST Ledger",
      "CGST Amount",
      "SGST Ledger",
      "SGST Amount",
      "IGST Ledger",
      "IGST Amount",
      "Round Off",
      "Grand Total"
    ];

    const rows = approvedBills.map(b => [
      `"${b.voucher_date || b.invoice_date || ""}"`,
      `"${b.supplier_invoice_no || b.invoice_number || ""}"`,
      `"${b.bill_date || b.invoice_date || ""}"`,
      `"${(b.vendor_name || "").replace(/"/g, '""')}"`,
      `"${b.vendor_gstin || ""}"`,
      `"${b.source_of_supply || "Gujarat"}"`,
      `"${b.accounting_ledgers?.[0]?.ledger_name || "Purchase: General Goods"}"`,
      b.taxable_amount || 0,
      `"${b.cgst_ledger || "Input CGST"}"`,
      b.cgst || 0,
      `"${b.sgst_ledger || "Input SGST"}"`,
      b.sgst || 0,
      `"${b.igst_ledger || "Input IGST"}"`,
      b.igst || 0,
      b.round_off || 0,
      b.grand_total || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Approved_Invoices_${activeClient.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Exported Approved Invoices to Excel CSV!", "success");
  };

  const handleDownloadXML = () => {
    if (approvedBills.length === 0) {
      notify("No approved invoices to export.", "error");
      return;
    }

    let xmlVouchers = approvedBills.map(b => {
      const vDate = (b.voucher_date || b.invoice_date || "").replace(/-/g, "");
      const invoiceNo = b.supplier_invoice_no || b.invoice_number || "INV";
      const party = b.vendor_name || "Sundry Creditor";
      const total = parseFloat(b.grand_total) || 0;
      const taxable = parseFloat(b.taxable_amount) || 0;
      const cgst = parseFloat(b.cgst) || 0;
      const sgst = parseFloat(b.sgst) || 0;
      const igst = parseFloat(b.igst) || 0;
      const expenseLedger = b.accounting_ledgers?.[0]?.ledger_name || "Purchase: General Goods";

      return `
    <VOUCHER VCHTYPE="Purchase" ACTION="Create">
      <DATE>${vDate}</DATE>
      <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
      <REFERENCE>${invoiceNo}</REFERENCE>
      <PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>
      <NARRATION>Purchase Invoice #${invoiceNo} imported via Compliance4</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${party}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${total.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${expenseLedger}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${taxable.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      ${cgst > 0 ? `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${b.cgst_ledger || "Input CGST"}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${cgst.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>` : ""}
      ${sgst > 0 ? `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${b.sgst_ledger || "Input SGST"}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${sgst.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>` : ""}
      ${igst > 0 ? `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${b.igst_ledger || "Input IGST"}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${igst.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>` : ""}
    </VOUCHER>`;
    }).join("");

    const fullXML = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${activeClient}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">${xmlVouchers}</TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const blob = new Blob([fullXML], { type: "text/xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Tally_Import_Vouchers_${activeClient.replace(/\s+/g, "_")}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Downloaded Tally-compliant XML import file!", "success");
  };

  // FULL SCREEN SIDE-BY-SIDE REVIEW WORKSPACE
  if (activeReviewBill && voucherData) {
    const duplicateMatch = checkDuplicateInvoice(
      voucherData.supplier_invoice_no, 
      voucherData.vendor_name, 
      activeReviewBill.id
    );
    const gstCheck = validateGSTIN(voucherData.vendor_gstin);

    // Current invoice position in the queue
    const currentQueueIndex = pendingBills.findIndex(b => b.id === activeReviewBill.id);
    const hasNextBill = currentQueueIndex !== -1 && currentQueueIndex < pendingBills.length - 1;

    return (
      <div className="flex flex-col h-full bg-[#F8FAFC] text-slate-800 font-sans">
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
            {pendingBills.length > 0 && currentQueueIndex !== -1 && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-medium">
                {currentQueueIndex + 1} of {pendingBills.length}
              </span>
            )}
            {duplicateMatch && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                <AlertTriangle className="w-3 h-3 text-amber-700" />
                Duplicate: In {duplicateMatch.stage}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteCurrentReviewBill}
              className="text-xs font-medium text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition"
            >
              Delete Bill
            </button>
            <button
              onClick={() => setShowAllocationModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm"
            >
              <Check className="w-3.5 h-3.5" /> Approve Bill {hasNextBill ? "& Next →" : ""}
            </button>
          </div>
        </header>

        {/* DUPLICATE WARNING BAR */}
        {duplicateMatch && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Warning:</strong> An invoice with number <strong>#{voucherData.supplier_invoice_no}</strong> for <strong>{voucherData.vendor_name}</strong> already exists in <strong>{duplicateMatch.stage}</strong>.
              </span>
            </div>
            <span className="text-[11px] font-semibold text-amber-700">Verify to avoid double booking</span>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: PREVIEW */}
          <div className="w-1/2 bg-slate-200 border-r border-slate-300 relative overflow-hidden flex flex-col">
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
                  <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Attached Original Invoice</p>
                  <p className="text-xs text-slate-400 font-mono mt-1">#{voucherData.supplier_invoice_no}</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: VOUCHER FORM */}
          <div className="w-1/2 bg-white flex flex-col overflow-y-auto">
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
              <div className="flex items-center gap-2 mb-2">
                {Object.keys(itemRules).length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    <Sparkles className="w-3 h-3" /> Auto-Learning Active
                  </span>
                )}
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  AI Parsed
                </span>
              </div>
            </div>

            <div className="p-8 space-y-6">
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-600">GSTIN</label>
                      {voucherData.vendor_gstin && (
                        gstCheck.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            {gstCheck.stateName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded" title={gstCheck.reason}>
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            Invalid GSTIN
                          </span>
                        )
                      )}
                    </div>
                    <input
                      type="text"
                      value={voucherData.vendor_gstin || ""}
                      onChange={(e) => setVoucherData({ ...voucherData, vendor_gstin: e.target.value })}
                      className={`w-full text-xs font-mono border rounded-lg p-2 ${
                        gstCheck.isValid 
                          ? "border-slate-300 bg-white" 
                          : "border-rose-300 bg-rose-50/50"
                      }`}
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

              {/* ITEM MODE */}
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
                              <div className="flex items-center gap-1">
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
                                {it.isAutoMatched && (
                                  <span title="Auto-mapped from memorized rules" className="text-indigo-600 shrink-0">
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2">
                              <select
                                value={it.ledger_name}
                                onChange={(e) => handleLedgerSelection(idx, e.target.value, it.description)}
                                className={`w-full text-xs p-1 rounded font-medium border transition ${
                                  it.isAutoMatched
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold"
                                    : "bg-white border-slate-200 text-slate-700"
                                }`}
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

              {/* GST ROW & TOTALS */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex justify-between text-xs text-slate-600 font-medium">
                  <span>Sub Total (Taxable Value):</span>
                  <span className="font-mono">₹{(voucherData.taxable_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

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

        {/* APPROVE BILL MODAL */}
        {showAllocationModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Confirm Bill Approval</h3>
                <button onClick={() => setShowAllocationModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Save and approve invoice <strong>#{voucherData.supplier_invoice_no}</strong> from <strong>{voucherData.vendor_name}</strong> for <strong>₹{voucherData.grand_total}</strong>?
                </p>
                {duplicateMatch && (
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-800">
                    <p className="font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Duplicate Detected
                    </p>
                    <p className="text-[11px] mt-0.5">
                      This bill already exists in {duplicateMatch.stage}. Confirming will record an additional entry.
                    </p>
                  </div>
                )}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-[11px] text-slate-500">
                    This bill will be stored in <strong>Approved Invoices</strong> where it can be batch exported to Excel/XML or pushed directly to Tally Prime.
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
                  className="px-4 py-1.5 rounded font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                >
                  Save & Next <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // MAIN TAB VIEW
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Purchase Invoices</h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{activeClient}</p>
            {Object.keys(itemRules).length > 0 && (
              <span className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                <Sparkles className="w-2.5 h-2.5" />
                {Object.keys(itemRules).length} Rules Learned
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {purchaseSubTab === "approved" && approvedBills.length > 0 && (
            <>
              <button
                onClick={handleDownloadExcel}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition"
              >
                <Download className="w-3.5 h-3.5" /> Export Excel
              </button>
              <button
                onClick={handleDownloadXML}
                className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-lg transition border border-blue-200"
              >
                <FileCode className="w-3.5 h-3.5" /> Download Tally XML
              </button>
            </>
          )}

          <input
            type="file"
            ref={invoiceInputRef}
            onChange={handleMultipleInvoiceUpload}
            accept="application/pdf,image/*"
            multiple
            className="hidden"
          />
          <button
            disabled={isUploadingBill}
            onClick={() => invoiceInputRef.current?.click()}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {isUploadingBill ? uploadProgress || "Extracting..." : "Upload Bills (Multiple)"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
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

          <button
            onClick={() => setPurchaseSubTab("pushed")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
              purchaseSubTab === "pushed"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Pushed to Tally
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              purchaseSubTab === "pushed" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
            }`}>
              {pushedBills.length}
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
                <p className="text-xs text-slate-400 mt-0.5">Click "Upload Bills" to select one or multiple bills to parse with Gemini AI</p>
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
                  {pendingBills.map((b) => {
                    const duplicate = checkDuplicateInvoice(b.supplier_invoice_no || b.invoice_number, b.vendor_name, b.id);
                    const gstCheck = validateGSTIN(b.vendor_gstin);

                    return (
                      <tr 
                        key={b.id} 
                        onClick={() => openReviewWorkspace(b)}
                        className={`hover:bg-slate-50 cursor-pointer transition ${duplicate ? "bg-amber-50/40" : ""}`}
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{b.vendor_name || "Unknown Vendor"}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-slate-400 font-mono">{b.vendor_gstin || "No GSTIN"}</span>
                            {b.vendor_gstin && (
                              gstCheck.isValid ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" /> {gstCheck.stateName}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1 py-0.5 rounded">
                                  <ShieldAlert className="w-2.5 h-2.5 text-rose-600" /> Invalid
                                </span>
                              )
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-slate-800">
                          #{b.invoice_number || b.supplier_invoice_no}
                          {duplicate && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-700" /> Duplicate
                            </span>
                          )}
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
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: APPROVED INVOICES */}
        {purchaseSubTab === "approved" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {approvedBills.length === 0 ? (
              <div className="p-16 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No approved invoices waiting</p>
                <p className="text-xs text-slate-400 mt-0.5">Approve verified invoices in "Needs Review" to prepare for Tally sync or export</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Vendor</th>
                    <th className="px-6 py-3.5">Invoice No.</th>
                    <th className="px-6 py-3.5">Ledger Allocation</th>
                    <th className="px-6 py-3.5">Total Amount (₹)</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
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
                          {b.accounting_ledgers?.[0]?.ledger_name || "Purchase: General Goods"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-emerald-700">
                        ₹{(parseFloat(b.grand_total) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openReviewWorkspace(b)}
                            title="Edit invoice again"
                            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] px-2.5 py-1.5 rounded transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => {
                              setApprovedBills(prev => prev.filter(x => x.id !== b.id));
                              notify("Invoice removed from Approved tab.", "info");
                            }}
                            title="Remove invoice"
                            className="text-slate-400 hover:text-rose-600 p-1.5 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePushToTally(b)}
                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3.5 py-1.5 rounded transition shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" /> Push
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: PUSHED TO TALLY */}
        {purchaseSubTab === "pushed" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {pushedBills.length === 0 ? (
              <div className="p-16 text-center">
                <FileSpreadsheet className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No invoices pushed yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Invoices successfully sent to Tally Prime will appear here</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Vendor</th>
                    <th className="px-6 py-3.5">Invoice No.</th>
                    <th className="px-6 py-3.5">Pushed Date & Time</th>
                    <th className="px-6 py-3.5">Amount (₹)</th>
                    <th className="px-6 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pushedBills.map((b, idx) => (
                    <tr key={b.id || idx} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{b.vendor_name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{b.vendor_gstin}</p>
                      </td>
                      <td className="px-6 py-4 font-mono font-medium text-slate-800">
                        #{b.supplier_invoice_no || b.invoice_number}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {b.pushed_at || "Recent"}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-800">
                        ₹{(parseFloat(b.grand_total) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <Check className="w-3 h-3" /> In Tally
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

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
