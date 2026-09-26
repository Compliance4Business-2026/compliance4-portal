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
  Globe,
  Phone,
  Mail,
  UserCheck,
  Users,
  ChevronRight,
  ArrowLeft
} from "lucide-react";

export const DEFAULT_PL_CATEGORIES = [
  "Direct Costs / Cost of Goods Sold (COGS)",
  "Employee Benefit Expenses",
  "Rent & Occupancy Costs",
  "Administrative & General Expenses",
  "Selling & Distribution Expenses",
  "Finance & Banking Charges",
  "Depreciation & Non-Cash Entries"
];

export const INITIAL_CLIENT_COA = [
  { id: "coa_1", name: "Purchases: Food Ingredients & Raw Material", category: "Direct Costs / Cost of Goods Sold (COGS)" },
  { id: "coa_2", name: "Packaging Material & Cartons", category: "Direct Costs / Cost of Goods Sold (COGS)" },
  { id: "coa_3", name: "Staff Salary & Wages", category: "Employee Benefit Expenses" },
  { id: "coa_4", name: "Director Remuneration", category: "Employee Benefit Expenses" },
  { id: "coa_5", name: "Staff Welfare & Refreshment", category: "Employee Benefit Expenses" },
  { id: "coa_6", name: "Commercial Office / Shop Rent", category: "Rent & Occupancy Costs" },
  { id: "coa_7", name: "Electricity & Fuel Charges", category: "Rent & Occupancy Costs" },
  { id: "coa_8", name: "Water & Maintenance Charges", category: "Rent & Occupancy Costs" },
  { id: "coa_9", name: "Legal & Statutory Audit Fees", category: "Administrative & General Expenses" },
  { id: "coa_10", name: "Software Subscriptions & Cloud Hosting", category: "Administrative & General Expenses" },
  { id: "coa_11", name: "Printing, Stationery & Postage", category: "Administrative & General Expenses" },
  { id: "coa_12", name: "Digital Marketing & Advertisements", category: "Selling & Distribution Expenses" },
  { id: "coa_13", name: "Delivery Commissions & Aggregator Charges", category: "Selling & Distribution Expenses" },
  { id: "coa_14", name: "Bank Service Charges & Processing Fees", category: "Finance & Banking Charges" },
  { id: "coa_15", name: "Loan Interest & Overdraft Interest", category: "Finance & Banking Charges" },
  { id: "coa_16", name: "Depreciation on Machinery & Equipment", category: "Depreciation & Non-Cash Entries" },
  { id: "coa_17", name: "Depreciation on Furniture & Fixtures", category: "Depreciation & Non-Cash Entries" }
];

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
    terms: "1. Goods once sold will not be taken back.\n2. Subject to our home Jurisdiction.",
    logoUrl: "",
    signatureUrl: ""
  };
};

export default function SettingsModule({ activeClient, setActiveClient }) {
  // Navigation Flow: 'directory' (Default List) | 'manage' (Client Details)
  const [viewMode, setViewMode] = useState("directory");
  // Sub-tabs inside manage view: 'profile' | 'coa'
  const [manageSubTab, setManageSubTab] = useState("profile");

  const [profiles, setProfiles] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_client_profiles");
      if (saved) return JSON.parse(saved);
      return {
        "Pansuria Confectionery & Food": {
          companyName: "Pansuria Confectionery & Food",
          gstin: "24BILPP3143F1ZD",
          pan: "BILPP3143F",
          contactPerson: "Sanjay",
          phone: "+91 98250 12345",
          email: "accounts@pansuria.com",
          website: "",
          address: "19, Pahelgav Bungalows, Off Judges Bungalow Road, Ahmedabad - 380015",
          bankName: "HDFC Bank",
          accountNo: "50200080509922",
          ifscCode: "HDFC0000006",
          branch: "Bodakdev, Ahmedabad",
          terms: "1. Subject to Ahmedabad Jurisdiction.\n2. Delivery Ex-Premises.",
          logoUrl: "",
          signatureUrl: ""
        }
      };
    } catch {
      return {};
    }
  });

  const [clientCoa, setClientCoa] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_coa_${activeClient}`);
      return saved ? JSON.parse(saved) : INITIAL_CLIENT_COA;
    } catch {
      return INITIAL_CLIENT_COA;
    }
  });

  const [currentForm, setCurrentForm] = useState(() => getFreshProfileState(activeClient, profiles));

  useEffect(() => {
    try {
      const savedProfiles = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
      setCurrentForm(getFreshProfileState(activeClient, savedProfiles));
    } catch {
      setCurrentForm(getFreshProfileState(activeClient, {}));
    }

    try {
      const savedCoa = localStorage.getItem(`c4_coa_${activeClient}`);
      setClientCoa(savedCoa ? JSON.parse(savedCoa) : INITIAL_CLIENT_COA);
    } catch {
      setClientCoa(INITIAL_CLIENT_COA);
    }
  }, [activeClient]);

  const [newLedgerName, setNewLedgerName] = useState("");
  const [newLedgerCategory, setNewLedgerCategory] = useState(DEFAULT_PL_CATEGORIES[1]);
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

  // Image Upload Handlers
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

  // ROUTE EXCLUSIVELY VIA MANAGE CLIENT & COA
  const handleOpenClient = (clientName) => {
    setActiveClient(clientName);
    const savedProfiles = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
    setCurrentForm(getFreshProfileState(clientName, savedProfiles));
    setViewMode("manage");
    setManageSubTab("profile");
  };

  // Add New Client
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
      terms: "1. Goods once sold will not be taken back.\n2. Subject to our home Jurisdiction.",
      logoUrl: "",
      signatureUrl: ""
    };

    const updated = { ...profiles, [trimmed]: newProfile };
    setProfiles(updated);
    localStorage.setItem("c4_client_profiles", JSON.stringify(updated));
    localStorage.setItem(`c4_coa_${trimmed}`, JSON.stringify(INITIAL_CLIENT_COA));

    setActiveClient(trimmed);
    setCurrentForm(newProfile);
    setClientCoa(INITIAL_CLIENT_COA);
    setViewMode("manage");
    setManageSubTab("profile");

    notify(`Client "${trimmed}" created! Please enter statutory and banking details.`, "success");
  };

  // Delete Client
  const handleDeleteClient = (clientNameToDelete, e) => {
    e.stopPropagation();
    const clientKeys = Object.keys(profiles);
    if (clientKeys.length <= 1) {
      notify("You must maintain at least one client entity in the portal.", "error");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${clientNameToDelete}"? All its localized records will be unlinked.`)) {
      return;
    }

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

  // Save Profile Handler
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

  // Chart of Accounts Handlers
  const handleAddLedger = (e) => {
    e.preventDefault();
    if (!newLedgerName.trim()) {
      notify("Ledger Name cannot be blank", "error");
      return;
    }

    if (clientCoa.some((l) => l.name.toLowerCase() === newLedgerName.trim().toLowerCase())) {
      notify(`Ledger "${newLedgerName}" already exists for this client!`, "error");
      return;
    }

    const created = {
      id: `coa_${Date.now()}`,
      name: newLedgerName.trim(),
      category: newLedgerCategory
    };

    setClientCoa((prev) => [...prev, created]);
    setNewLedgerName("");
    notify(`Ledger "${created.name}" added to ${activeClient}!`, "success");
  };

  const handleDeleteLedger = (id, name) => {
    if (!window.confirm(`Delete ledger "${name}" from this client's accounts?`)) return;
    setClientCoa((prev) => prev.filter((l) => l.id !== id));
    notify(`Ledger "${name}" deleted.`, "info");
  };

  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await loadSheetJS();
      const templateData = [
        ["Ledger Name", "Category"],
        ["Purchases: Food Ingredients & Raw Material", "Direct Costs / Cost of Goods Sold (COGS)"],
        ["Staff Salary & Wages", "Employee Benefit Expenses"],
        ["Commercial Office / Shop Rent", "Rent & Occupancy Costs"],
        ["Electricity & Fuel Charges", "Rent & Occupancy Costs"],
        ["Legal & Statutory Audit Fees", "Administrative & General Expenses"],
        ["Digital Marketing & Advertisements", "Selling & Distribution Expenses"],
        ["Bank Service Charges & Fees", "Finance & Banking Charges"],
        ["Depreciation on Machinery & Equipment", "Depreciation & Non-Cash Entries"]
      ];

      const ws = XLSX.utils.aoa_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Chart_of_Accounts");
      XLSX.writeFile(wb, `COA_Template_${activeClient.replace(/\s+/g, "_")}.xlsx`);
      notify("COA Excel template downloaded!", "success");
    } catch {
      const csvContent =
        "Ledger Name,Category\n" +
        "Purchases: Food Ingredients & Raw Material,Direct Costs / Cost of Goods Sold (COGS)\n" +
        "Staff Salary & Wages,Employee Benefit Expenses\n" +
        "Commercial Office / Shop Rent,Rent & Occupancy Costs\n" +
        "Legal & Statutory Audit Fees,Administrative & General Expenses\n" +
        "Digital Marketing & Advertisements,Selling & Distribution Expenses\n" +
        "Bank Service Charges & Fees,Finance & Banking Charges\n" +
        "Depreciation on Machinery & Equipment,Depreciation & Non-Cash Entries\n";
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `COA_Template_${activeClient.replace(/\s+/g, "_")}.csv`);
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
          const catIdx = headers.findIndex((h) => h.includes("category") || h.includes("group") || h.includes("head") || h.includes("p&l"));

          if (nameIdx === -1) {
            notify("Missing 'Ledger Name' column header in file.", "error");
            setIsUploading(false);
            return;
          }

          const parsedLedgers = [];
          for (let i = 1; i < rawRows.length; i++) {
            const row = rawRows[i] || [];
            const name = String(row[nameIdx] || "").trim();
            if (!name) continue;

            let rawCat = catIdx !== -1 && row[catIdx] ? String(row[catIdx]).trim() : "";
            let matchedCat = DEFAULT_PL_CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase());

            if (!matchedCat) {
              const lower = rawCat.toLowerCase();
              if (lower.includes("cost") || lower.includes("cogs") || lower.includes("purchase") || lower.includes("direct")) {
                matchedCat = DEFAULT_PL_CATEGORIES[0];
              } else if (lower.includes("employee") || lower.includes("salary") || lower.includes("wage") || lower.includes("staff")) {
                matchedCat = DEFAULT_PL_CATEGORIES[1];
              } else if (lower.includes("rent") || lower.includes("electricity") || lower.includes("power") || lower.includes("occupancy")) {
                matchedCat = DEFAULT_PL_CATEGORIES[2];
              } else if (lower.includes("selling") || lower.includes("market") || lower.includes("delivery") || lower.includes("ad")) {
                matchedCat = DEFAULT_PL_CATEGORIES[4];
              } else if (lower.includes("bank") || lower.includes("finance") || lower.includes("interest")) {
                matchedCat = DEFAULT_PL_CATEGORIES[5];
              } else if (lower.includes("depr") || lower.includes("amort") || lower.includes("asset")) {
                matchedCat = DEFAULT_PL_CATEGORIES[6];
              } else {
                matchedCat = DEFAULT_PL_CATEGORIES[3];
              }
            }

            parsedLedgers.push({
              id: `coa_${Date.now()}_${i}`,
              name,
              category: matchedCat
            });
          }

          if (parsedLedgers.length === 0) {
            notify("No valid ledger rows found in file.", "error");
            setIsUploading(false);
            return;
          }

          const replaceOption = window.confirm(
            `Extracted ${parsedLedgers.length} ledgers!\n\nClick OK to REPLACE the entire list for ${activeClient}.\nClick CANCEL to APPEND only new ledgers to current list.`
          );

          if (replaceOption) {
            setClientCoa(parsedLedgers);
            notify(`Replaced with ${parsedLedgers.length} ledgers for ${activeClient}!`, "success");
          } else {
            const existingNames = new Set(clientCoa.map((l) => l.name.toLowerCase()));
            const newOnly = parsedLedgers.filter((l) => !existingNames.has(l.name.toLowerCase()));
            setClientCoa((prev) => [...prev, ...newOnly]);
            notify(`Appended ${newOnly.length} new ledgers (skipped ${parsedLedgers.length - newOnly.length} duplicates)!`, "success");
          }
        } catch (err) {
          console.error(err);
          notify("Failed to parse file. Check template format.", "error");
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

  const clientListKeys = Object.keys(profiles);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* TOP HEADER BAR */}
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
              : "Configuring verified legal profile, branding, bank accounts, and Chart of Accounts"}
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

          {viewMode === "manage" && manageSubTab === "coa" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition"
                title="Download Sample COA Excel Template"
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
                {isUploading ? "Importing..." : "Bulk Upload COA (.xlsx / .csv)"}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* SUB-TABS: RENDERED ONLY INSIDE MANAGE VIEW */}
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
            <BookOpen className="w-4 h-4" /> Chart of Accounts & P&L Mapping
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900 text-white font-mono">
              {clientCoa.length}
            </span>
          </button>
        </div>
      )}

      {/* VIEWPORT BODY */}
      <div className="p-8 max-w-5xl mx-auto w-full space-y-6">

        {/* 1. MASTER VIEW: ALL CLIENTS DIRECTORY */}
        {viewMode === "directory" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Configured Client Entities ({clientListKeys.length})</h3>
                <p className="text-xs text-slate-500">
                  Select <strong>"Manage Client & COA"</strong> to view or edit that specific client's profile and custom accounts.
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
                  coaCount = storedCoa ? JSON.parse(storedCoa).length : INITIAL_CLIENT_COA.length;
                } catch {
                  coaCount = INITIAL_CLIENT_COA.length;
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

                      {/* STRICT ROUTING ACTION */}
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

        {/* 2. DETAIL VIEW: PROFILE & BRANDING (ROUTED ONLY VIA "MANAGE CLIENT & COA") */}
        {viewMode === "manage" && manageSubTab === "profile" && (
          <div className="space-y-6">

            {/* BRANDING: LOGO & AUTHORIZED SIGNATURE */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-slate-600" /> Entity Branding & Signatures (For Invoices)
              </h3>

              <div className="grid grid-cols-2 gap-6 pt-2">
                {/* COMPANY LOGO */}
                <div className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/50">
                  {currentForm.logoUrl ? (
                    <div className="relative group mb-3">
                      <img
                        src={currentForm.logoUrl}
                        alt="Company Logo"
                        className="max-h-24 max-w-full object-contain rounded border border-slate-200 bg-white p-1"
                      />
                      <button
                        onClick={() => setCurrentForm((p) => ({ ...p, logoUrl: "" }))}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow hover:bg-rose-700"
                        title="Remove Logo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                  )}

                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={(e) => handleImageUpload(e, "logoUrl")}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-semibold text-slate-700 transition"
                  >
                    {currentForm.logoUrl ? "Replace Logo" : "Upload Company Logo"}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">PNG, JPG up to 2MB (Prints on top of Tax Invoice)</p>
                </div>

                {/* AUTHORIZED SIGNATORY STAMP */}
                <div className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/50">
                  {currentForm.signatureUrl ? (
                    <div className="relative group mb-3">
                      <img
                        src={currentForm.signatureUrl}
                        alt="Signature"
                        className="max-h-24 max-w-full object-contain rounded border border-slate-200 bg-white p-1"
                      />
                      <button
                        onClick={() => setCurrentForm((p) => ({ ...p, signatureUrl: "" }))}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow hover:bg-rose-700"
                        title="Remove Signature"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                      <PenTool className="w-7 h-7" />
                    </div>
                  )}

                  <input
                    type="file"
                    ref={signatureInputRef}
                    onChange={(e) => handleImageUpload(e, "signatureUrl")}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => signatureInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-semibold text-slate-700 transition"
                  >
                    {currentForm.signatureUrl ? "Replace Signature" : "Upload Authorized Signatory"}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">Digital signature/stamp image (Prints on bottom right)</p>
                </div>
              </div>
            </div>

            {/* LEGAL & STATUTORY IDENTIFIERS */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-600" /> Legal Entity & Statutory Data
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company / Legal Trade Name</label>
                  <input
                    type="text"
                    value={currentForm.companyName}
                    onChange={(e) => setCurrentForm({ ...currentForm, companyName: e.target.value })}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    placeholder="24ABCDE1234F1Z5"
                    value={currentForm.gstin}
                    onChange={(e) => setCurrentForm({ ...currentForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    placeholder="ABCDE1234F"
                    value={currentForm.pan}
                    onChange={(e) => setCurrentForm({ ...currentForm, pan: e.target.value.toUpperCase() })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Registered Business Address</label>
                  <input
                    type="text"
                    placeholder="Complete Registered Office Address"
                    value={currentForm.address}
                    onChange={(e) => setCurrentForm({ ...currentForm, address: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>
            </div>

            {/* CONTACT & COMMUNICATION */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-slate-600" /> Contact & Communication
              </h3>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Managing Director"
                    value={currentForm.contactPerson}
                    onChange={(e) => setCurrentForm({ ...currentForm, contactPerson: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98250 XXXXX"
                    value={currentForm.phone}
                    onChange={(e) => setCurrentForm({ ...currentForm, phone: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="accounts@company.com"
                    value={currentForm.email}
                    onChange={(e) => setCurrentForm({ ...currentForm, email: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Website</label>
                  <input
                    type="text"
                    placeholder="https://company.com"
                    value={currentForm.website}
                    onChange={(e) => setCurrentForm({ ...currentForm, website: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>
            </div>

            {/* PRIMARY SETTLEMENT BANK */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-slate-600" /> Primary Settlement Bank (Prints on Tax Invoices)
              </h3>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank"
                    value={currentForm.bankName}
                    onChange={(e) => setCurrentForm({ ...currentForm, bankName: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    placeholder="502000XXXXXX"
                    value={currentForm.accountNo}
                    onChange={(e) => setCurrentForm({ ...currentForm, accountNo: e.target.value })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    placeholder="HDFC0000006"
                    value={currentForm.ifscCode}
                    onChange={(e) => setCurrentForm({ ...currentForm, ifscCode: e.target.value.toUpperCase() })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch</label>
                  <input
                    type="text"
                    placeholder="Branch name & City"
                    value={currentForm.branch}
                    onChange={(e) => setCurrentForm({ ...currentForm, branch: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>
            </div>

            {/* DEFAULT TERMS & CONDITIONS */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Default Terms & Conditions (Prints on Invoices)
              </h3>
              <textarea
                rows={4}
                value={currentForm.terms}
                onChange={(e) => setCurrentForm({ ...currentForm, terms: e.target.value })}
                className="w-full text-xs font-mono border border-slate-300 rounded-lg p-3 text-slate-700"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveProfile}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-md"
              >
                <Save className="w-4 h-4" /> Save Profile & Brand Masters
              </button>
            </div>

          </div>
        )}

        {/* 3. DETAIL VIEW: CHART OF ACCOUNTS (ROUTED ONLY VIA "MANAGE CLIENT & COA") */}
        {viewMode === "manage" && manageSubTab === "coa" && (
          <div className="space-y-6">
            
            {/* MANUAL SINGLE LEDGER ADD FORM */}
            <form onSubmit={handleAddLedger} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-slate-600" /> Add Single Ledger for {activeClient}
                </h3>
                <span className="text-[11px] text-slate-400">Or use "Bulk Upload COA" above for spreadsheet import</span>
              </div>

              <div className="grid grid-cols-5 gap-4 items-end">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ledger Account Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Swiggy Commission / Cold Storage Rent"
                    value={newLedgerName}
                    onChange={(e) => setNewLedgerName(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    P&L Financial Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newLedgerCategory}
                    onChange={(e) => setNewLedgerCategory(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                  >
                    {DEFAULT_PL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Ledger
                  </button>
                </div>
              </div>
            </form>

            {/* MAPPED LEDGERS LIST GROUPED BY P&L CATEGORY */}
            <div className="space-y-4">
              {DEFAULT_PL_CATEGORIES.map((category) => {
                const ledgersInCategory = clientCoa.filter((l) => l.category === category);

                return (
                  <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-600" />
                        <h4 className="text-xs font-bold text-slate-900">{category}</h4>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                        {ledgersInCategory.length} Ledgers
                      </span>
                    </div>

                    {ledgersInCategory.length === 0 ? (
                      <p className="p-4 text-xs text-slate-400 italic">No custom ledgers under this schedule head.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {ledgersInCategory.map((item) => (
                          <div key={item.id} className="px-5 py-2.5 flex items-center justify-between hover:bg-slate-50/50 transition">
                            <span className="text-xs font-semibold text-slate-800">{item.name}</span>
                            <button
                              onClick={() => handleDeleteLedger(item.id, item.name)}
                              className="text-slate-300 hover:text-rose-600 p-1.5 rounded transition"
                              title="Delete Ledger"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}

      </div>

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
