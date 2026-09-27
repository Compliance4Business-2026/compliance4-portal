import React, { useState, useEffect, useRef } from "react";
import { 
  Building2, 
  Save, 
  Plus, 
  Trash2, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  BookOpen,
  Download,
  Upload,
  Image as ImageIcon,
  PenTool,
  Users,
  ChevronRight,
  ArrowLeft,
  Filter,
  Scale,
  DollarSign,
  Edit3,
  X,
  Check
} from "lucide-react";

const loadSheetJS = () => {
  return new Promise((resolve, reject) => {
    if (window.XLSX) {
      resolve(window.XLSX);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Failed to load spreadsheet engine"));
    document.head.appendChild(script);
  });
};

const getFreshProfileState = (clientName, savedProfiles) => {
  if (savedProfiles[clientName]) {
    return { ...savedProfiles[clientName], companyName: clientName };
  }
  return {
    companyName: clientName,
    gstin: "",
    pan: "",
    contactPerson: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    bankName: "",
    accountNo: "",
    ifscCode: "",
    branch: "",
    terms: "1. Goods once sold will not be taken back.\n2. Subject to local Jurisdiction.",
    logoUrl: "",
    signatureUrl: ""
  };
};

export default function SettingsModule({ activeClient, setActiveClient }) {
  const [viewMode, setViewMode] = useState("directory"); // 'directory' | 'manage'
  const [manageSubTab, setManageSubTab] = useState("profile"); // 'profile' | 'coa' | 'opening_balances'

  const [profiles, setProfiles] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_client_profiles");
      if (saved) return JSON.parse(saved);
      return {
        [activeClient]: {
          companyName: activeClient,
          gstin: "",
          pan: "",
          address: ""
        }
      };
    } catch {
      return {};
    }
  });

  // Client-scoped Chart of Accounts with Opening Balance integration
  const [clientCoa, setClientCoa] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_coa_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentForm, setCurrentForm] = useState(() => getFreshProfileState(activeClient, profiles));
  const [coaFilter, setCoaFilter] = useState("ALL"); // 'ALL' | 'P&L' | 'Balance Sheet'

  useEffect(() => {
    try {
      const savedProfiles = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
      setCurrentForm(getFreshProfileState(activeClient, savedProfiles));
    } catch {
      setCurrentForm(getFreshProfileState(activeClient, {}));
    }

    try {
      const savedCoa = localStorage.getItem(`c4_coa_${activeClient}`);
      setClientCoa(savedCoa ? JSON.parse(savedCoa) : []);
    } catch {
      setClientCoa([]);
    }
  }, [activeClient]);

  // Form State for Adding Single Ledger
  const [newLedgerName, setNewLedgerName] = useState("");
  const [newStatementType, setNewStatementType] = useState("Balance Sheet");
  const [newLedgerCategory, setNewLedgerCategory] = useState("Sundry Creditors");
  const [newOpeningBalance, setNewOpeningBalance] = useState("0");
  const [newBalanceType, setNewBalanceType] = useState("Cr");

  // EDITING MODAL / INLINE STATE
  const [editingLedger, setEditingLedger] = useState(null);

  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState(null);

  const logoInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("c4_client_profiles", JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem(`c4_coa_${activeClient}`, JSON.stringify(clientCoa));
  }, [clientCoa, activeClient]);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      notify("Image size should be less than 2MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCurrentForm((prev) => ({ ...prev, [field]: reader.result }));
      notify(`${field === "logoUrl" ? "Company Logo" : "Signature"} uploaded!`, "success");
    };
    reader.readAsDataURL(file);
  };

  const handleOpenClient = (clientName) => {
    setActiveClient(clientName);
    const savedProfiles = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
    setCurrentForm(getFreshProfileState(clientName, savedProfiles));
    setViewMode("manage");
    setManageSubTab("profile");
  };

  const handleAddNewClient = () => {
    const newClientName = window.prompt("Enter Legal or Trade Name for the New Client:");
    if (!newClientName || !newClientName.trim()) return;

    const trimmed = newClientName.trim();
    if (profiles[trimmed]) {
      notify(`Client "${trimmed}" already exists!`, "error");
      handleOpenClient(trimmed);
      return;
    }

    const newProfile = {
      companyName: trimmed,
      gstin: "",
      pan: "",
      contactPerson: "",
      phone: "",
      email: "",
      website: "",
      address: "",
      bankName: "",
      accountNo: "",
      ifscCode: "",
      branch: "",
      terms: "1. Goods once sold will not be taken back.\n2. Subject to local Jurisdiction.",
      logoUrl: "",
      signatureUrl: ""
    };

    const updated = { ...profiles, [trimmed]: newProfile };
    setProfiles(updated);
    localStorage.setItem("c4_client_profiles", JSON.stringify(updated));
    localStorage.setItem(`c4_coa_${trimmed}`, JSON.stringify([]));

    setActiveClient(trimmed);
    setCurrentForm(newProfile);
    setClientCoa([]);
    setViewMode("manage");
    setManageSubTab("profile");

    notify(`Client "${trimmed}" created!`, "success");
  };

  const handleDeleteClient = (clientNameToDelete, e) => {
    e.stopPropagation();
    const clientKeys = Object.keys(profiles);
    if (clientKeys.length <= 1) {
      notify("You must maintain at least one client entity in the portal.", "error");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${clientNameToDelete}"?`)) return;

    const updated = { ...profiles };
    delete updated[clientNameToDelete];
    setProfiles(updated);
    localStorage.setItem("c4_client_profiles", JSON.stringify(updated));

    if (activeClient === clientNameToDelete) {
      const remainingKey = Object.keys(updated)[0];
      setActiveClient(remainingKey);
    }

    notify(`Client "${clientNameToDelete}" removed.`, "info");
  };

  const handleSaveProfile = () => {
    if (!currentForm.companyName.trim()) {
      notify("Please provide a Legal Company Name", "error");
      return;
    }
    const targetName = currentForm.companyName.trim();
    const updatedProfiles = {
      ...profiles,
      [targetName]: { ...currentForm, companyName: targetName }
    };
    setProfiles(updatedProfiles);
    localStorage.setItem("c4_client_profiles", JSON.stringify(updatedProfiles));
    setActiveClient(targetName);
    notify(`Profile for "${targetName}" saved successfully!`, "success");
  };

  // Add Single Ledger
  const handleAddLedger = (e) => {
    e.preventDefault();
    if (!newLedgerName.trim()) {
      notify("Ledger Name cannot be blank", "error");
      return;
    }
    if (!newLedgerCategory.trim()) {
      notify("Please assign a Category name", "error");
      return;
    }

    if (clientCoa.some((l) => l.name.toLowerCase() === newLedgerName.trim().toLowerCase())) {
      notify(`Ledger "${newLedgerName}" already exists for this client!`, "error");
      return;
    }

    const opBal = Math.abs(parseFloat(newOpeningBalance) || 0);

    const created = {
      id: `coa_${Date.now()}`,
      name: newLedgerName.trim(),
      statementType: newStatementType,
      category: newLedgerCategory.trim(),
      openingBalance: opBal,
      balanceType: newBalanceType
    };

    setClientCoa((prev) => [...prev, created]);
    setNewLedgerName("");
    setNewOpeningBalance("0");
    notify(`Ledger "${created.name}" saved!`, "success");
  };

  // SAVE EDITED LEDGER
  const handleSaveEditedLedger = () => {
    if (!editingLedger || !editingLedger.name.trim() || !editingLedger.category.trim()) {
      notify("Ledger Name and Category cannot be blank", "error");
      return;
    }

    // Check duplicate name excluding itself
    const duplicate = clientCoa.some(
      (l) => l.id !== editingLedger.id && l.name.toLowerCase() === editingLedger.name.trim().toLowerCase()
    );
    if (duplicate) {
      notify(`Another ledger with name "${editingLedger.name}" already exists!`, "error");
      return;
    }

    setClientCoa((prev) =>
      prev.map((l) =>
        l.id === editingLedger.id
          ? {
              ...l,
              name: editingLedger.name.trim(),
              category: editingLedger.category.trim(),
              statementType: editingLedger.statementType,
              openingBalance: Math.abs(parseFloat(editingLedger.openingBalance) || 0),
              balanceType: editingLedger.balanceType || "Dr"
            }
          : l
      )
    );

    notify(`Ledger "${editingLedger.name}" updated successfully!`, "success");
    setEditingLedger(null);
  };

  // Inline update opening balance
  const handleUpdateOpeningBalance = (ledgerId, amount, type) => {
    const numericAmt = Math.abs(parseFloat(amount) || 0);
    setClientCoa((prev) =>
      prev.map((l) => (l.id === ledgerId ? { ...l, openingBalance: numericAmt, balanceType: type } : l))
    );
  };

  const handleDeleteLedger = (id, name) => {
    if (!window.confirm(`Delete ledger "${name}"?`)) return;
    setClientCoa((prev) => prev.filter((l) => l.id !== id));
    notify(`Ledger "${name}" deleted.`, "info");
  };

  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await loadSheetJS();
      const templateData = [
        ["Ledger Name", "Statement Type", "Category", "Opening Balance (₹)", "Dr/Cr"],
        ["Amul Dairy Products", "Balance Sheet", "Sundry Creditors (AP)", 45000, "Cr"],
        ["Vikas Packaging Industries", "Balance Sheet", "Sundry Creditors (AP)", 18200, "Cr"],
        ["Blink Commerce Pvt Ltd", "Balance Sheet", "Sundry Debtors (AR)", 24500, "Dr"],
        ["Zomato Aggregator Settlement", "Balance Sheet", "Sundry Debtors (AR)", 38900, "Dr"],
        ["HDFC Bank Current A/c", "Balance Sheet", "Cash & Bank Balances", 125000, "Dr"],
        ["Petty Cash Balance", "Balance Sheet", "Cash & Bank Balances", 15000, "Dr"],
        ["Electricity Expense Payable", "Balance Sheet", "Provisions & Payables", 8400, "Cr"],
        ["Swiggy - Commission", "P&L", "Selling & Distribution Expenses", 0, "Dr"],
        ["Commercial Office Rent", "P&L", "Rent & Occupancy Costs", 0, "Dr"]
      ];

      const ws = XLSX.utils.aoa_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Chart_of_Accounts");
      XLSX.writeFile(wb, `COA_With_Opening_Balances_${activeClient.replace(/\s+/g, "_")}.xlsx`);
      notify("Template with Opening Balances downloaded!", "success");
    } catch {
      const csvContent =
        "Ledger Name,Statement Type,Category,Opening Balance (₹),Dr/Cr\n" +
        "Amul Dairy Products,Balance Sheet,Sundry Creditors (AP),45000,Cr\n" +
        "Blink Commerce Pvt Ltd,Balance Sheet,Sundry Debtors (AR),24500,Dr\n" +
        "HDFC Bank Current A/c,Balance Sheet,Cash & Bank Balances,125000,Dr\n" +
        "Swiggy - Commission,P&L,Selling & Distribution Expenses,0,Dr\n";
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `COA_With_Opening_Balances_${activeClient.replace(/\s+/g, "_")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const fileName = file.name.toLowerCase();

    try {
      const XLSX = await loadSheetJS();
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          let rawRows = [];

          if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
            const text = new TextDecoder().decode(event.target.result);
            const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
            rawRows = lines.map((line) => line.split(",").map((c) => c.replace(/["']/g, "").trim()));
          } else {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheet = workbook.SheetNames[0];
            rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: "" });
          }

          if (!rawRows || rawRows.length < 2) {
            notify("Uploaded file has no data rows.", "error");
            setIsUploading(false);
            return;
          }

          const headers = (rawRows[0] || []).map((h) => String(h || "").trim().toLowerCase());
          const nameIdx = headers.findIndex((h) => h.includes("ledger") || h.includes("account") || h.includes("name"));
          const typeIdx = headers.findIndex((h) => h.includes("statement") || h.includes("type") || h.includes("sheet") || h.includes("p&l"));
          const catIdx = headers.findIndex((h) => h.includes("category") || h.includes("group") || h.includes("head"));
          const balIdx = headers.findIndex((h) => h.includes("open") || h.includes("bal") || h.includes("amount"));
          const drcrIdx = headers.findIndex((h) => h.includes("dr") || h.includes("cr") || h.includes("d/c"));

          if (nameIdx === -1) {
            notify("Missing 'Ledger Name' column in header.", "error");
            setIsUploading(false);
            return;
          }

          const parsedLedgers = [];
          for (let i = 1; i < rawRows.length; i++) {
            const row = rawRows[i] || [];
            const name = String(row[nameIdx] || "").trim();
            if (!name) continue;

            let statementType = "P&L";
            if (typeIdx !== -1 && row[typeIdx]) {
              const rawType = String(row[typeIdx]).trim().toLowerCase();
              if (rawType.includes("balance") || rawType.includes("bs") || rawType.includes("asset") || rawType.includes("liab")) {
                statementType = "Balance Sheet";
              }
            } else {
              const lower = name.toLowerCase();
              if (lower.includes("payable") || lower.includes("bank") || lower.includes("cash") || lower.includes("deposit") || lower.includes("tds") || lower.includes("creditor") || lower.includes("debtor")) {
                statementType = "Balance Sheet";
              }
            }

            let category = "General Overheads";
            if (catIdx !== -1 && row[catIdx] && String(row[catIdx]).trim().length > 0) {
              category = String(row[catIdx]).trim();
            } else {
              category = statementType === "Balance Sheet" ? "Balance Sheet Items" : "Operational Expenses";
            }

            let openingBalance = 0;
            let balanceType = "Dr";

            if (balIdx !== -1 && row[balIdx]) {
              const rawBalStr = String(row[balIdx]).trim();
              openingBalance = Math.abs(parseFloat(rawBalStr.replace(/[^0-9.-]/g, "")) || 0);

              if (rawBalStr.toLowerCase().includes("cr")) balanceType = "Cr";
              else if (rawBalStr.toLowerCase().includes("dr")) balanceType = "Dr";
            }

            if (drcrIdx !== -1 && row[drcrIdx]) {
              const rawDrCr = String(row[drcrIdx]).trim().toUpperCase();
              if (rawDrCr.includes("CR")) balanceType = "Cr";
              if (rawDrCr.includes("DR")) balanceType = "Dr";
            } else if (balIdx === -1 || openingBalance === 0) {
              const catLower = category.toLowerCase();
              const nameLower = name.toLowerCase();
              if (catLower.includes("creditor") || catLower.includes("payable") || catLower.includes("liab") || nameLower.includes("payable")) {
                balanceType = "Cr";
              } else {
                balanceType = "Dr";
              }
            }

            parsedLedgers.push({
              id: `coa_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
              name,
              statementType,
              category,
              openingBalance,
              balanceType
            });
          }

          if (parsedLedgers.length === 0) {
            notify("No valid ledgers detected in spreadsheet.", "error");
            setIsUploading(false);
            return;
          }

          const replaceOption = window.confirm(
            `Found ${parsedLedgers.length} ledgers!\n\nClick OK to REPLACE the entire Chart of Accounts for ${activeClient}.\nClick CANCEL to APPEND new ledgers.`
          );

          if (replaceOption) {
            setClientCoa(parsedLedgers);
            notify(`Uploaded ${parsedLedgers.length} ledgers with Opening Balances!`, "success");
          } else {
            const existingNames = new Set(clientCoa.map((l) => l.name.toLowerCase()));
            const newOnly = parsedLedgers.filter((l) => !existingNames.has(l.name.toLowerCase()));
            setClientCoa((prev) => [...prev, ...newOnly]);
            notify(`Appended ${newOnly.length} new ledgers!`, "success");
          }
        } catch (err) {
          console.error(err);
          notify("Failed to parse spreadsheet file.", "error");
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      notify("Failed to initialize spreadsheet reader.", "error");
      setIsUploading(false);
    }
  };

  const filteredCoa = clientCoa.filter((l) => {
    if (coaFilter === "ALL") return true;
    return l.statementType === coaFilter;
  });

  const categoriesGrouped = filteredCoa.reduce((acc, item) => {
    const cat = item.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const apLedgers = clientCoa.filter(
    (l) => l.statementType === "Balance Sheet" && (l.category.toLowerCase().includes("creditor") || l.category.toLowerCase().includes("payable") || l.name.toLowerCase().includes("payable"))
  );
  const totalApOpening = apLedgers.reduce((acc, l) => acc + (parseFloat(l.openingBalance) || 0), 0);

  const arLedgers = clientCoa.filter(
    (l) => l.statementType === "Balance Sheet" && (l.category.toLowerCase().includes("debtor") || l.category.toLowerCase().includes("receivable") || l.name.toLowerCase().includes("receivable"))
  );
  const totalArOpening = arLedgers.reduce((acc, l) => acc + (parseFloat(l.openingBalance) || 0), 0);

  const bankCashLedgers = clientCoa.filter(
    (l) => l.statementType === "Balance Sheet" && (l.category.toLowerCase().includes("bank") || l.category.toLowerCase().includes("cash") || l.name.toLowerCase().includes("bank") || l.name.toLowerCase().includes("cash"))
  );
  const totalBankCashOpening = bankCashLedgers.reduce((acc, l) => acc + (parseFloat(l.openingBalance) || 0), 0);

  const clientListKeys = Object.keys(profiles);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <div className="flex items-center gap-3">
            {viewMode === "manage" && (
              <button
                onClick={() => setViewMode("directory")}
                className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to All Clients
              </button>
            )}
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {viewMode === "directory" ? "Client Directory & Masters" : `Managing: ${activeClient}`}
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {viewMode === "directory"
              ? "All registered entities on this Compliance4 portal"
              : "Configuring legal profile, branding, bank accounts, and custom Chart of Accounts with Opening Balances"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === "directory" && (
            <button
              onClick={handleAddNewClient}
              className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" /> + Add New Client
            </button>
          )}

          {viewMode === "manage" && manageSubTab === "profile" && (
            <button
              onClick={handleSaveProfile}
              className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <Save className="w-3.5 h-3.5" /> Save Profile
            </button>
          )}

          {viewMode === "manage" && (manageSubTab === "coa" || manageSubTab === "opening_balances") && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition"
                title="Download 5-column Template with Opening Balances"
              >
                <Download className="w-3.5 h-3.5" /> Download Template
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="*"
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {isUploading ? "Uploading..." : "Bulk Upload COA & Balances"}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MANAGE TABS */}
      {viewMode === "manage" && (
        <div className="px-8 pt-3 pb-0 flex items-center gap-6 border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={() => setManageSubTab("profile")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              manageSubTab === "profile" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Building2 className="w-4 h-4" /> Client Profile, Brand & Bank
          </button>

          <button
            onClick={() => setManageSubTab("coa")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              manageSubTab === "coa" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <BookOpen className="w-4 h-4" /> Chart of Accounts ({clientCoa.length})
          </button>

          <button
            onClick={() => setManageSubTab("opening_balances")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              manageSubTab === "opening_balances" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Scale className="w-4 h-4 text-indigo-600" /> Opening Balances Master (AP / AR / Bank)
          </button>
        </div>
      )}

      {/* BODY VIEWPORT */}
      <div className="p-8 max-w-5xl mx-auto w-full space-y-6">

        {/* 1. MASTER DIRECTORY */}
        {viewMode === "directory" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Configured Client Entities ({clientListKeys.length})</h3>
                <p className="text-xs text-slate-500">
                  Select <strong>"Manage Client & COA"</strong> to edit opening balances and ledgers.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              {clientListKeys.map((clientName) => {
                const profile = profiles[clientName] || {};
                const isActive = clientName === activeClient;
                const coaKey = `c4_coa_${clientName}`;
                let coaCount = 0;
                try {
                  const storedCoa = localStorage.getItem(coaKey);
                  coaCount = storedCoa ? JSON.parse(storedCoa).length : 0;
                } catch {
                  coaCount = 0;
                }

                return (
                  <div
                    key={clientName}
                    className={`bg-white rounded-xl border p-5 transition shadow-sm hover:shadow-md flex flex-col justify-between ${
                      isActive ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {profile.logoUrl ? (
                            <img
                              src={profile.logoUrl}
                              alt="Logo"
                              className="w-10 h-10 object-contain rounded border border-slate-200 p-0.5 bg-white"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center text-sm">
                              {clientName.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 leading-tight">{clientName}</h4>
                            <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                              {profile.gstin ? `GSTIN: ${profile.gstin}` : "No GSTIN Configured"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isActive && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                            </span>
                          )}

                          <button
                            onClick={(e) => handleDeleteClient(clientName, e)}
                            className="text-slate-300 hover:text-rose-600 p-1 rounded transition"
                            title="Delete Client"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                        <p className="truncate">
                          <strong>Address:</strong> {profile.address ? profile.address : "Pending setup"}
                        </p>
                        <p>
                          <strong>Bank:</strong> {profile.bankName ? `${profile.bankName} (${profile.accountNo || "-"})` : "Not linked"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded">
                        {coaCount} Custom Ledgers
                      </span>

                      <button
                        onClick={() => handleOpenClient(clientName)}
                        className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition shadow-sm"
                      >
                        Manage Client & COA <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. PROFILE TAB */}
        {viewMode === "manage" && manageSubTab === "profile" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-slate-600" /> Entity Branding & Signatures (For Invoices)
              </h3>

              <div className="grid grid-cols-2 gap-6 pt-2">
                <div className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/50">
                  {currentForm.logoUrl ? (
                    <div className="relative group mb-3">
                      <img src={currentForm.logoUrl} alt="Logo" className="max-h-24 max-w-full object-contain rounded border border-slate-200 bg-white p-1" />
                      <button onClick={() => setCurrentForm((p) => ({ ...p, logoUrl: "" }))} className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow hover:bg-rose-700">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                  )}
                  <input type="file" ref={logoInputRef} onChange={(e) => handleImageUpload(e, "logoUrl")} accept="image/*" className="hidden" />
                  <button onClick={() => logoInputRef.current?.click()} className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-semibold text-slate-700 transition">
                    {currentForm.logoUrl ? "Replace Logo" : "Upload Company Logo"}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">PNG, JPG up to 2MB</p>
                </div>

                <div className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/50">
                  {currentForm.signatureUrl ? (
                    <div className="relative group mb-3">
                      <img src={currentForm.signatureUrl} alt="Signature" className="max-h-24 max-w-full object-contain rounded border border-slate-200 bg-white p-1" />
                      <button onClick={() => setCurrentForm((p) => ({ ...p, signatureUrl: "" }))} className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow hover:bg-rose-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                      <PenTool className="w-7 h-7" />
                    </div>
                  )}
                  <input type="file" ref={signatureInputRef} onChange={(e) => handleImageUpload(e, "signatureUrl")} accept="image/*" className="hidden" />
                  <button onClick={() => signatureInputRef.current?.click()} className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-semibold text-slate-700 transition">
                    {currentForm.signatureUrl ? "Replace Signature" : "Upload Authorized Signatory"}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">Digital signature image</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-600" /> Legal Entity & Statutory Data
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company / Legal Trade Name</label>
                  <input type="text" value={currentForm.companyName} onChange={(e) => setCurrentForm({ ...currentForm, companyName: e.target.value })} className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN</label>
                  <input type="text" placeholder="24ABCDE1234F1Z5" value={currentForm.gstin} onChange={(e) => setCurrentForm({ ...currentForm, gstin: e.target.value.toUpperCase() })} className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PAN Number</label>
                  <input type="text" placeholder="ABCDE1234F" value={currentForm.pan} onChange={(e) => setCurrentForm({ ...currentForm, pan: e.target.value.toUpperCase() })} className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Registered Business Address</label>
                  <input type="text" placeholder="Complete Office Address" value={currentForm.address} onChange={(e) => setCurrentForm({ ...currentForm, address: e.target.value })} className="w-full text-xs border border-slate-300 rounded-lg p-2" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-slate-600" /> Primary Settlement Bank
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
                  <input type="text" value={currentForm.bankName} onChange={(e) => setCurrentForm({ ...currentForm, bankName: e.target.value })} className="w-full text-xs border border-slate-300 rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Number</label>
                  <input type="text" value={currentForm.accountNo} onChange={(e) => setCurrentForm({ ...currentForm, accountNo: e.target.value })} className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code</label>
                  <input type="text" value={currentForm.ifscCode} onChange={(e) => setCurrentForm({ ...currentForm, ifscCode: e.target.value.toUpperCase() })} className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch</label>
                  <input type="text" value={currentForm.branch} onChange={(e) => setCurrentForm({ ...currentForm, branch: e.target.value })} className="w-full text-xs border border-slate-300 rounded-lg p-2" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={handleSaveProfile} className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-md">
                <Save className="w-4 h-4" /> Save Profile & Brand Masters
              </button>
            </div>
          </div>
        )}

        {/* 3. CHART OF ACCOUNTS MASTER */}
        {viewMode === "manage" && manageSubTab === "coa" && (
          <div className="space-y-6">
            <form onSubmit={handleAddLedger} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-slate-600" /> Add Single Ledger with Opening Balance
                </h3>
              </div>

              <div className="grid grid-cols-6 gap-3 items-end">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ledger Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Vikas Packaging / Amul Supplies"
                    value={newLedgerName}
                    onChange={(e) => setNewLedgerName(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nature <span className="text-rose-500">*</span></label>
                  <select
                    value={newStatementType}
                    onChange={(e) => setNewStatementType(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                  >
                    <option value="Balance Sheet">Balance Sheet</option>
                    <option value="P&L">Profit & Loss (P&L)</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Sundry Creditors"
                    value={newLedgerCategory}
                    onChange={(e) => setNewLedgerCategory(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Op. Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newOpeningBalance}
                    onChange={(e) => setNewOpeningBalance(e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dr / Cr</label>
                  <select
                    value={newBalanceType}
                    onChange={(e) => setNewBalanceType(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-bold"
                  >
                    <option value="Cr">Cr (Credit)</option>
                    <option value="Dr">Dr (Debit)</option>
                  </select>
                </div>

                <div className="col-span-6 flex justify-end pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Ledger
                  </button>
                </div>
              </div>
            </form>

            <div className="flex items-center justify-between bg-white px-5 py-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">Filter By Statement:</span>
              </div>
              <div className="flex items-center gap-2">
                {["ALL", "Balance Sheet", "P&L"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setCoaFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      coaFilter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {f} ({f === "ALL" ? clientCoa.length : clientCoa.filter((l) => l.statementType === f).length})
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {Object.keys(categoriesGrouped).length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
                  No ledgers uploaded yet for {activeClient}.
                </div>
              ) : (
                Object.entries(categoriesGrouped).map(([categoryName, ledgers]) => {
                  const statementNature = ledgers[0]?.statementType || "P&L";

                  return (
                    <div key={categoryName} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Layers className="w-4 h-4 text-slate-600" />
                          <h4 className="text-xs font-bold text-slate-900">{categoryName}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            statementNature === "P&L" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                          }`}>
                            {statementNature}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                          {ledgers.length} Ledgers
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {ledgers.map((item) => (
                          <div key={item.id} className="px-5 py-2.5 flex items-center justify-between hover:bg-slate-50/50 transition">
                            <span className="text-xs font-semibold text-slate-800">{item.name}</span>

                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-bold text-slate-700">
                                {item.openingBalance > 0
                                  ? `₹${Number(item.openingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ${item.balanceType || "Dr"}`
                                  : "-"}
                              </span>

                              {/* EDIT BUTTON */}
                              <button
                                onClick={() => setEditingLedger({ ...item })}
                                className="text-slate-400 hover:text-indigo-600 p-1.5 rounded hover:bg-indigo-50 transition"
                                title="Edit Ledger Name & Category"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteLedger(item.id, item.name)}
                                className="text-slate-300 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition"
                                title="Delete Ledger"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 4. OPENING BALANCES MASTER VIEW */}
        {viewMode === "manage" && manageSubTab === "opening_balances" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Accounts Payable (Creditors)</span>
                <p className="text-2xl font-black font-mono text-rose-700">
                  ₹{totalApOpening.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-500">{apLedgers.length} Vendor Ledgers Initialized (Cr)</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Accounts Receivable (Debtors)</span>
                <p className="text-2xl font-black font-mono text-emerald-700">
                  ₹{totalArOpening.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-500">{arLedgers.length} Customer / Aggregator Ledgers (Dr)</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Starting Liquid Funds (Bank + Cash)</span>
                <p className="text-2xl font-black font-mono text-indigo-700">
                  ₹{totalBankCashOpening.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-500">{bankCashLedgers.length} Cash & Bank Accounts (Dr)</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Balance Sheet Ledgers & Opening Positions
                  </h3>
                  <p className="text-[11px] text-slate-500">Edit or enter opening balances directly. Values save automatically.</p>
                </div>
                <span className="text-[11px] font-mono text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                  {clientCoa.filter((l) => l.statementType === "Balance Sheet").length} Balance Sheet Accounts
                </span>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-6">Account Ledger Name</th>
                    <th className="py-3 px-4">Category / Group</th>
                    <th className="py-3 px-4 text-right">Opening Balance (₹)</th>
                    <th className="py-3 px-4 text-center">Nature</th>
                    <th className="py-3 px-4 text-center">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {clientCoa
                    .filter((l) => l.statementType === "Balance Sheet")
                    .map((ledger) => (
                      <tr key={ledger.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-6 font-bold text-slate-900">{ledger.name}</td>
                        <td className="py-3 px-4 text-slate-600">{ledger.category}</td>
                        
                        <td className="py-3 px-4 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={ledger.openingBalance || 0}
                            onChange={(e) =>
                              handleUpdateOpeningBalance(ledger.id, e.target.value, ledger.balanceType || "Dr")
                            }
                            className="w-36 text-right font-mono font-bold text-xs border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-slate-900"
                          />
                        </td>

                        <td className="py-3 px-4 text-center">
                          <select
                            value={ledger.balanceType || "Dr"}
                            onChange={(e) =>
                              handleUpdateOpeningBalance(ledger.id, ledger.openingBalance || 0, e.target.value)
                            }
                            className="text-xs font-bold border border-slate-300 rounded px-2 py-1 bg-white"
                          >
                            <option value="Dr">Dr</option>
                            <option value="Cr">Cr</option>
                          </select>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setEditingLedger({ ...ledger })}
                              className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition"
                              title="Edit Ledger Name & Category"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => notify(`Opening balance for ${ledger.name} committed!`, "success")}
                              className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded hover:bg-indigo-100 transition"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>

      {/* MODAL: EDIT LEDGER NAME & CATEGORY */}
      {editingLedger && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" /> Edit Ledger Details
              </h3>
              <button
                onClick={() => setEditingLedger(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ledger Name</label>
                <input
                  type="text"
                  value={editingLedger.name}
                  onChange={(e) => setEditingLedger({ ...editingLedger, name: e.target.value })}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Statement Nature</label>
                  <select
                    value={editingLedger.statementType}
                    onChange={(e) => setEditingLedger({ ...editingLedger, statementType: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                  >
                    <option value="Balance Sheet">Balance Sheet</option>
                    <option value="P&L">Profit & Loss (P&L)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category / Group</label>
                  <input
                    type="text"
                    value={editingLedger.category}
                    onChange={(e) => setEditingLedger({ ...editingLedger, category: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingLedger.openingBalance || 0}
                    onChange={(e) => setEditingLedger({ ...editingLedger, openingBalance: e.target.value })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dr / Cr</label>
                  <select
                    value={editingLedger.balanceType || "Dr"}
                    onChange={(e) => setEditingLedger({ ...editingLedger, balanceType: e.target.value })}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    <option value="Dr">Dr (Debit)</option>
                    <option value="Cr">Cr (Credit)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingLedger(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveEditedLedger}
                className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition shadow-sm"
              >
                <Check className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition-all z-50 ${
            notification.type === "error" ? "bg-rose-600" : "bg-slate-900"
          }`}
        >
          {notification.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {notification.msg}
        </div>
      )}
    </div>
  );
}
