import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Check, 
  ChevronLeft, 
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
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
  Sparkles,
  Search
} from "lucide-react";
import { api } from "./api";

const API_BASE_URL = 
  import.meta.env.VITE_BACKEND_URL || 
  "https://compliance4-backend-1021821620394.asia-south1.run.app";

const FALLBACK_EXPENSE_LEDGERS = [
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

// ROBUST POP-OUT SEARCHABLE TYPEAHEAD COMBOBOX
function SearchableLedgerSelect({ value, onChange, coaList = [], fallbackOptions = [], placeholder = "Type ledger name..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const filteredGroups = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const groups = {};

    if (coaList && coaList.length > 0) {
      coaList.forEach((l) => {
        const name = l.name || "";
        const cat = l.category || "General Accounts";
        if (!term || name.toLowerCase().includes(term) || cat.toLowerCase().includes(term)) {
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(l);
        }
      });
    }

    if (Object.keys(groups).length === 0) {
      const defaultGroup = "Standard Accounts";
      groups[defaultGroup] = fallbackOptions
        .filter((name) => !term || name.toLowerCase().includes(term))
        .map((name) => ({ name, category: defaultGroup }));
    }

    return groups;
  }, [coaList, fallbackOptions, searchTerm]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={isOpen ? searchTerm : (value || "")}
          onFocus={() => {
            setSearchTerm("");
            setIsOpen(true);
          }}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          className="w-full text-xs font-semibold border border-slate-300 rounded p-1.5 bg-white text-slate-800 pr-7 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
      </div>

      {isOpen && (
        <div 
          className="absolute left-0 top-full mt-1 w-[320px] max-h-64 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-y-auto z-[999] divide-y divide-slate-100"
          style={{ minWidth: "100%" }}
        >
          {Object.keys(filteredGroups).length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center italic">
              No matching ledger in Client COA
            </div>
          ) : (
            Object.entries(filteredGroups).map(([groupName, ledgers]) => (
              <div key={groupName} className="py-1">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 flex items-center justify-between">
                  <span>{groupName}</span>
                  <span className="font-mono text-[9px] text-slate-400">{ledgers.length}</span>
                </div>
                {ledgers.map((l) => (
                  <button
                    key={l.id || l.name}
                    type="button"
                    onClick={() => {
                      onChange(l.name);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between hover:bg-slate-100 ${
                      value === l.name ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-800 font-medium"
                    }`}
                  >
                    <span className="truncate pr-2">{l.name}</span>
                    <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      {l.statementType === "Balance Sheet" ? "B/S" : (l.cogsClassification === "COGS" ? "COGS" : "P&L")}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function PurchaseModule({ activeClient = "Pansuria Confectionery & Food" }) {
  const [purchaseSubTab, setPurchaseSubTab] = useState("needs_review");

  // Read active client's profile for ITC Eligibility check
  const clientProfile = useMemo(() => {
    try {
      const profiles = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
      return profiles[activeClient] || { isItcEligible: true };
    } catch {
      return { isItcEligible: true };
    }
  }, [activeClient]);

  const isClientItcEligible = clientProfile.isItcEligible !== false; // Default true

  const [pendingBills, setPendingBills] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_pending_bills_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [approvedBills, setApprovedBills] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_approved_bills_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pushedBills, setPushedBills] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_pushed_bills_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [itemRules, setItemRules] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_purchase_item_rules_${activeClient}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [clientCoa, setClientCoa] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_coa_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // --- FETCH BILLS & COA FROM FIRESTORE ON LOAD / CLIENT SWITCH ---
  useEffect(() => {
    let isMounted = true;

    async function loadCloudPurchaseData() {
      try {
        const [cloudNeedsReview, cloudApproved, cloudPushed, coaData] = await Promise.all([
          api.getBills(activeClient, "needs_review").catch(() => null),
          api.getBills(activeClient, "approved").catch(() => null),
          api.getBills(activeClient, "pushed").catch(() => null),
          api.getClientCoa(activeClient).catch(() => null)
        ]);

        if (!isMounted) return;

        if (Array.isArray(cloudNeedsReview)) {
          setPendingBills(cloudNeedsReview);
          localStorage.setItem(`c4_pending_bills_${activeClient}`, JSON.stringify(cloudNeedsReview));
        }
        if (Array.isArray(cloudApproved)) {
          setApprovedBills(cloudApproved);
          localStorage.setItem(`c4_approved_bills_${activeClient}`, JSON.stringify(cloudApproved));
        }
        if (Array.isArray(cloudPushed)) {
          setPushedBills(cloudPushed);
          localStorage.setItem(`c4_pushed_bills_${activeClient}`, JSON.stringify(cloudPushed));
        }
        if (Array.isArray(coaData) && coaData.length > 0) {
          setClientCoa(coaData);
          localStorage.setItem(`c4_coa_${activeClient}`, JSON.stringify(coaData));
        }
      } catch (err) {
        console.warn("Using offline bill storage:", err);
      }
    }

    if (activeClient) {
      loadCloudPurchaseData();
    }

    return () => {
      isMounted = false;
    };
  }, [activeClient]);

  const dynamicExpenseLedgers = useMemo(() => {
    const plLedgers = clientCoa.filter((l) => l.statementType === "P&L").map((l) => l.name);
    if (plLedgers.length > 0) return plLedgers;
    return FALLBACK_EXPENSE_LEDGERS;
  }, [clientCoa]);

  // ALL TAX LEDGERS (BOTH BALANCE SHEET DUTIES & TAXES AND P&L GST EXPENSE)
  const dynamicGstLedgers = useMemo(() => {
    const coaMatches = clientCoa
      .filter((l) => {
        const cat = (l.category || "").toLowerCase();
        const name = (l.name || "").toLowerCase();
        return (
          cat.includes("duties") ||
          cat.includes("tax") ||
          name.includes("cgst") ||
          name.includes("sgst") ||
          name.includes("igst") ||
          name.includes("gst expense") ||
          name.includes("input tax")
        );
      })
      .map((l) => l.name);

    if (coaMatches.length > 0) return coaMatches;
    return ["GST Expense on Purchase", "Input CGST", "Input SGST", "Input IGST", "GST Expense"];
  }, [clientCoa]);

  const sundryCreditors = useMemo(() => {
    return clientCoa.filter(
      (l) =>
        l.statementType === "Balance Sheet" &&
        (l.category.toLowerCase().includes("creditor") ||
          l.category.toLowerCase().includes("payable") ||
          l.category.toLowerCase().includes("vendor") ||
          l.category.toLowerCase().includes("supplier"))
    );
  }, [clientCoa]);

  useEffect(() => {
    localStorage.setItem(`c4_pending_bills_${activeClient}`, JSON.stringify(pendingBills));
  }, [pendingBills, activeClient]);

  useEffect(() => {
    localStorage.setItem(`c4_approved_bills_${activeClient}`, JSON.stringify(approvedBills));
  }, [approvedBills, activeClient]);

  useEffect(() => {
    localStorage.setItem(`c4_pushed_bills_${activeClient}`, JSON.stringify(pushedBills));
  }, [pushedBills, activeClient]);

  useEffect(() => {
    localStorage.setItem(`c4_purchase_item_rules_${activeClient}`, JSON.stringify(itemRules));
  }, [itemRules, activeClient]);

  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [notification, setNotification] = useState(null);

  const [activeReviewBill, setActiveReviewBill] = useState(null);
  const [voucherMode, setVoucherMode] = useState("accounting");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [voucherData, setVoucherData] = useState(null);

  const [expandedFolders, setExpandedFolders] = useState({});

  const toggleFolder = (folderKey) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderKey]: !prev[folderKey]
    }));
  };

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

  // OPEN REVIEW: AUTOMATICALLY ASSIGN GST EXPENSE ON PURCHASE IF CLIENT IS NON-ITC
  const openReviewWorkspace = (bill) => {
    setActiveReviewBill(bill);
    setZoomLevel(1);

    const defaultLedger = dynamicExpenseLedgers[0] || "Purchase: General Goods";
    
    // Auto-decide default tax routing based on Client Profile
    const isNonItcClient = !isClientItcEligible;
    const defaultTaxLedger = isNonItcClient ? "GST Expense on Purchase" : "Input CGST";
    const defaultSgstLedger = isNonItcClient ? "GST Expense on Purchase" : "Input SGST";
    const defaultIgstLedger = isNonItcClient ? "GST Expense on Purchase" : "Input IGST";

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
        ledger_name: memorized || it.ledger_name || defaultLedger,
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
      treatTaxAsExpense: isNonItcClient,
      cgst_ledger: bill.cgst_ledger || defaultTaxLedger,
      sgst_ledger: bill.sgst_ledger || defaultSgstLedger,
      igst_ledger: bill.igst_ledger || defaultIgstLedger,
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
    const defaultLedger = dynamicExpenseLedgers[0] || "Purchase: General Goods";

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Processing ${i + 1} of ${files.length}: ${file.name}...`);

      let persistentPreview = "";
      try {
        persistentPreview = await fileToBase64(file);
      } catch {
        persistentPreview = "";
      }

      try {
        const extracted = await api.extractInvoice(file, activeClient);
        extracted.id = extracted.id || `inv_${Date.now()}_${i}`;
        extracted.file_preview_url = persistentPreview;

        if (extracted.items && extracted.items.length > 0) {
          extracted.accounting_ledgers = extracted.items.map(it => {
            const cleanKey = (it.item_name || it.description || "").trim().toLowerCase();
            const memorized = itemRules[cleanKey];
            return {
              description: it.description || it.item_name || "Supplies",
              ledger_name: memorized || defaultLedger,
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

        // Persist extracted bill into Firestore under 'needs_review'
        await api.saveBill(activeClient, "needs_review", extracted).catch(err => {
          console.warn("Failed saving bill to Firestore during upload:", err);
        });

        newExtractedBills.push(extracted);
        successCount++;
      } catch (err) {
        console.error(`Failed to process ${file.name}:`, err);
      }
    }

    if (newExtractedBills.length > 0) {
      setPendingBills(prev => [...newExtractedBills, ...prev]);
      if (duplicateWarningsCount > 0) {
        notify(`Parsed ${successCount} bills (${duplicateWarningsCount} duplicate warnings detected)!`, "info");
      } else {
        notify(`Successfully extracted ${successCount} out of ${files.length} bills & synced to Firestore!`, "success");
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

  const handleToggleTaxAsExpense = (checked) => {
    const taxLedger = checked ? "GST Expense on Purchase" : "Input CGST";
    const sgstTaxLedger = checked ? "GST Expense on Purchase" : "Input SGST";
    const igstTaxLedger = checked ? "GST Expense on Purchase" : "Input IGST";

    setVoucherData((prev) => ({
      ...prev,
      treatTaxAsExpense: checked,
      cgst_ledger: taxLedger,
      sgst_ledger: sgstTaxLedger,
      igst_ledger: igstTaxLedger
    }));

    notify(
      checked 
        ? "Tax routed to GST Expense on Purchase (Non-ITC Scheme)" 
        : "Tax routed to Balance Sheet Input Tax Credit (Duties & Taxes)",
      "info"
    );
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

  const handleApproveInvoice = async () => {
    setShowAllocationModal(false);
    const approvedVoucher = { ...voucherData, isApproved: true };

    const remainingPending = pendingBills.filter(b => b.id !== activeReviewBill.id);
    setPendingBills(remainingPending);
    setApprovedBills(prev => [approvedVoucher, ...prev.filter(b => b.id !== approvedVoucher.id)]);

    try {
      // 1. Save in 'approved' stage in Firestore
      await api.saveBill(activeClient, "approved", approvedVoucher);
      // 2. Remove from 'needs_review' stage in Firestore
      await api.deleteBill(activeClient, "needs_review", activeReviewBill.id);
      notify(`Invoice #${approvedVoucher.supplier_invoice_no} approved & synced to Firestore!`, "success");
    } catch (err) {
      console.error(err);
      notify(`Approved locally, Firestore error: ${err.message}`, "info");
    }

    if (remainingPending.length > 0) {
      openReviewWorkspace(remainingPending[0]);
    } else {
      setActiveReviewBill(null);
      setPurchaseSubTab("approved");
    }
  };

  const handleDeleteCurrentReviewBill = async () => {
    const billToDeleteId = activeReviewBill.id;
    const remainingPending = pendingBills.filter(b => b.id !== billToDeleteId);
    setPendingBills(remainingPending);
    setApprovedBills(prev => prev.filter(b => b.id !== billToDeleteId));

    try {
      await api.deleteBill(activeClient, "needs_review", billToDeleteId);
      notify("Invoice deleted from Firestore.", "info");
    } catch (err) {
      console.error(err);
      notify("Deleted locally.", "info");
    }

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
        const pushedRecord = { ...bill, pushed_at: new Date().toLocaleString() };

        setApprovedBills(prev => prev.filter(b => b.id !== bill.id));
        setPushedBills(prev => [pushedRecord, ...prev]);

        // Update Firestore stages
        await api.saveBill(activeClient, "pushed", pushedRecord).catch(() => null);
        await api.deleteBill(activeClient, "approved", bill.id).catch(() => null);

        notify(`Invoice #${bill.supplier_invoice_no || bill.invoice_number} synced with Tally Prime & recorded!`, "success");
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
      "Voucher Date", "Supplier Invoice No", "Bill Date", "Vendor Name", "GSTIN",
      "Place of Supply", "Expense Ledger", "Taxable Value", "CGST Ledger", "CGST Amount",
      "SGST Ledger", "SGST Amount", "IGST Ledger", "IGST Amount", "Round Off", "Grand Total"
    ];

    const rows = approvedBills.map(b => [
      `"${b.voucher_date || b.invoice_date || ""}"`,
      `"${b.supplier_invoice_no || b.invoice_number || ""}"`,
      `"${b.bill_date || b.invoice_date || ""}"`,
      `"${(b.vendor_name || "").replace(/"/g, '""')}"`,
      `"${b.vendor_gstin || ""}"`,
      `"${b.source_of_supply || "Gujarat"}"`,
      `"${b.accounting_ledgers?.[0]?.ledger_name || dynamicExpenseLedgers[0] || "Purchases"}"`,
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
      const expenseLedger = b.accounting_ledgers?.[0]?.ledger_name || dynamicExpenseLedgers[0] || "Purchases";

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

  const groupedPushedBills = useMemo(() => {
    const groups = {};
    pushedBills.forEach(b => {
      const rawDate = b.invoice_date || b.bill_date || b.voucher_date;
      let monthYear = "Other / Undated";

      if (rawDate) {
        try {
          const parts = rawDate.split(/[\/\-]/);
          let dateObj = null;
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              dateObj = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
            } else {
              const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              dateObj = new Date(yr, parseInt(parts[1]) - 1, parts[0]);
            }
          } else {
            dateObj = new Date(rawDate);
          }

          if (dateObj && !isNaN(dateObj.getTime())) {
            monthYear = dateObj.toLocaleString("en-US", { month: "long", year: "numeric" });
          }
        } catch {
          monthYear = "Other / Undated";
        }
      }

      if (!groups[monthYear]) {
        groups[monthYear] = {
          monthLabel: monthYear,
          bills: [],
          totalAmount: 0
        };
      }

      groups[monthYear].bills.push(b);
      groups[monthYear].totalAmount += parseFloat(b.grand_total || b.taxable_amount || 0);
    });

    return Object.values(groups);
  }, [pushedBills]);

  // FULL SCREEN SIDE-BY-SIDE REVIEW WORKSPACE
  if (activeReviewBill && voucherData) {
    const duplicateMatch = checkDuplicateInvoice(
      voucherData.supplier_invoice_no, 
      voucherData.vendor_name, 
      activeReviewBill.id
    );
    const gstCheck = validateGSTIN(voucherData.vendor_gstin);

    const currentQueueIndex = pendingBills.findIndex(b => b.id === activeReviewBill.id);
    const hasNextBill = currentQueueIndex !== -1 && currentQueueIndex < pendingBills.length - 1;

    return (
      <div className="flex flex-col h-full bg-[#F8FAFC] text-slate-800 font-sans">
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs z-10 shrink-0">
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
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-xs"
            >
              <Check className="w-3.5 h-3.5" /> Approve Bill {hasNextBill ? "& Next →" : ""}
            </button>
          </div>
        </header>

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
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-slate-300 shadow-xs rounded-lg p-1">
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
                      list="vendor-creditors-datalist"
                      type="text"
                      placeholder="Type or pick Sundry Creditor from COA..."
                      value={voucherData.vendor_name || ""}
                      onChange={(e) => setVoucherData({ ...voucherData, vendor_name: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 font-semibold bg-white"
                    />
                    <datalist id="vendor-creditors-datalist">
                      {sundryCreditors.map((cred) => (
                        <option key={cred.id} value={cred.name}>
                          {cred.name} ({cred.category})
                        </option>
                      ))}
                    </datalist>
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
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Expense Ledgers (P&L Classified)</h4>
                      <span className="text-[10px] text-slate-400">Reading from Client Chart of Accounts</span>
                    </div>
                    <button
                      onClick={() => {
                        const newLedgers = [...(voucherData.accounting_ledgers || []), {
                          description: "Additional Charge",
                          ledger_name: dynamicExpenseLedgers[0] || "Purchases",
                          amount: 0
                        }];
                        updateTotals({ ...voucherData, accounting_ledgers: newLedgers });
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-900 hover:text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Ledger
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-visible">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="p-2.5">Item Description</th>
                          <th className="p-2.5 w-64">Ledger Name</th>
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
                                  className="w-full text-xs p-1.5 border border-slate-200 rounded"
                                />
                                {it.isAutoMatched && (
                                  <span title="Auto-mapped from memorized rules" className="text-indigo-600 shrink-0">
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 relative overflow-visible">
                              <SearchableLedgerSelect
                                value={it.ledger_name}
                                onChange={(selected) => handleLedgerSelection(idx, selected, it.description)}
                                coaList={clientCoa}
                                fallbackOptions={dynamicExpenseLedgers}
                                placeholder="Type to search COA..."
                              />
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
                                className="w-full text-xs font-mono p-1.5 border border-slate-200 rounded font-medium"
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

              {/* GST ROW & TOTALS (AUTOMATICALLY ROUTED BASED ON CLIENT'S ITC ELIGIBILITY) */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs text-slate-600 font-medium">Sub Total (Taxable Value):</span>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    ₹{(voucherData.taxable_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* AUTOMATIC ITC STATUS BANNER */}
                <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  !isClientItcEligible 
                    ? "bg-amber-50/80 border-amber-300 text-amber-900" 
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}>
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={voucherData.treatTaxAsExpense || false}
                        onChange={(e) => handleToggleTaxAsExpense(e.target.checked)}
                        className="rounded text-slate-900 focus:ring-slate-900"
                      />
                      <span>Ineligible ITC / Treat Tax as Expense (Restaurant 5% Scheme)</span>
                    </label>
                    <p className="text-[10px] pl-5 mt-0.5 opacity-80">
                      {!isClientItcEligible 
                        ? "Active Client is configured as Non-ITC: taxes auto-default to GST Expense on Purchase (P&L Overhead)."
                        : "Active Client is ITC Eligible: taxes default to Balance Sheet Input Credit (Duties & Taxes)."}
                    </p>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    voucherData.treatTaxAsExpense 
                      ? "bg-amber-200 text-amber-900" 
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}>
                    {voucherData.treatTaxAsExpense ? "GST Expense (P&L)" : "Input ITC (B/S)"}
                  </span>
                </div>

                {/* CGST */}
                <div className="grid grid-cols-3 gap-3 items-center overflow-visible">
                  <div className="relative overflow-visible">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">CGST Ledger</label>
                    <SearchableLedgerSelect
                      value={voucherData.cgst_ledger}
                      onChange={(selected) => setVoucherData({ ...voucherData, cgst_ledger: selected })}
                      coaList={clientCoa}
                      fallbackOptions={dynamicGstLedgers}
                      placeholder="Select CGST or GST Expense..."
                    />
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

                {/* SGST */}
                <div className="grid grid-cols-3 gap-3 items-center overflow-visible">
                  <div className="relative overflow-visible">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">SGST Ledger</label>
                    <SearchableLedgerSelect
                      value={voucherData.sgst_ledger}
                      onChange={(selected) => setVoucherData({ ...voucherData, sgst_ledger: selected })}
                      coaList={clientCoa}
                      fallbackOptions={dynamicGstLedgers}
                      placeholder="Select SGST or GST Expense..."
                    />
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

                {/* IGST */}
                <div className="grid grid-cols-3 gap-3 items-center overflow-visible">
                  <div className="relative overflow-visible">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">IGST Ledger</label>
                    <SearchableLedgerSelect
                      value={voucherData.igst_ledger}
                      onChange={(selected) => setVoucherData({ ...voucherData, igst_ledger: selected })}
                      coaList={clientCoa}
                      fallbackOptions={dynamicGstLedgers}
                      placeholder="Select IGST or GST Expense..."
                    />
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
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Purchase Invoices</h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{activeClient}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isClientItcEligible ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-300"}`}>
              {isClientItcEligible ? "ITC Eligible" : "Non-ITC Scheme"}
            </span>
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
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-xs disabled:opacity-50"
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
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
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
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
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
                          {b.accounting_ledgers?.[0]?.ledger_name || dynamicExpenseLedgers[0] || "Purchase: General Goods"}
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
                            onClick={async () => {
                              setApprovedBills(prev => prev.filter(x => x.id !== b.id));
                              await api.deleteBill(activeClient, "approved", b.id).catch(() => null);
                              notify("Invoice removed from Approved tab.", "info");
                            }}
                            title="Remove invoice"
                            className="text-slate-400 hover:text-rose-600 p-1.5 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePushToTally(b)}
                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-3.5 py-1.5 rounded transition shadow-xs"
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
          <div className="space-y-4">
            {groupedPushedBills.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-16 text-center">
                <FileSpreadsheet className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No invoices pushed yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Invoices successfully sent to Tally Prime will be organized into monthly folders here</p>
              </div>
            ) : (
              groupedPushedBills.map((group) => {
                const isExpanded = expandedFolders[group.monthLabel] !== false;

                return (
                  <div key={group.monthLabel} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                    <div
                      onClick={() => toggleFolder(group.monthLabel)}
                      className="px-6 py-4 bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer transition select-none"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <FolderOpen className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Folder className="w-5 h-5 text-slate-400" />
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 tracking-wide uppercase flex items-center gap-2">
                            {group.monthLabel}
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-mono font-bold lowercase">
                              {group.bills.length} invoices
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Purchases for {group.monthLabel}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Total Purchase</span>
                          <p className="text-sm font-black font-mono text-slate-900">
                            ₹{group.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="p-1 rounded bg-white border border-slate-200 text-slate-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-white border-b border-slate-200 uppercase font-semibold text-slate-400 text-[10px]">
                          <tr>
                            <th className="px-6 py-3">Vendor</th>
                            <th className="px-6 py-3">Invoice No.</th>
                            <th className="px-6 py-3">Invoice Date</th>
                            <th className="px-6 py-3">Pushed At</th>
                            <th className="px-6 py-3 font-mono text-right">Amount (₹)</th>
                            <th className="px-6 py-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.bills.map((b, idx) => (
                            <tr key={b.id || idx} className="hover:bg-slate-50/60 transition">
                              <td className="px-6 py-3.5">
                                <p className="font-bold text-slate-900">{b.vendor_name}</p>
                                <p className="text-[11px] text-slate-400 font-mono">{b.vendor_gstin || "No GSTIN"}</p>
                              </td>
                              <td className="px-6 py-3.5 font-mono font-medium text-slate-800">
                                #{b.supplier_invoice_no || b.invoice_number}
                              </td>
                              <td className="px-6 py-3.5 font-mono text-slate-500">
                                {b.invoice_date || b.bill_date || "-"}
                              </td>
                              <td className="px-6 py-3.5 text-slate-400 text-[11px]">
                                {b.pushed_at || "Recent"}
                              </td>
                              <td className="px-6 py-3.5 font-mono font-bold text-slate-800 text-right">
                                ₹{(parseFloat(b.grand_total || b.taxable_amount) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                  <Check className="w-3 h-3" /> In Tally
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })
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
