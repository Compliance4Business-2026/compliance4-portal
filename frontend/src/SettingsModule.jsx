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
  FileSpreadsheet
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

export default function SettingsModule({ activeClient, setActiveClient }) {
  const [settingsTab, setSettingsTab] = useState("coa"); // 'profile' | 'coa'

  // Profiles State
  const [profiles, setProfiles] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_client_profiles");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Client Chart of Accounts State (Scoped to activeClient)
  const [clientCoa, setClientCoa] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_coa_${activeClient}`);
      return saved ? JSON.parse(saved) : INITIAL_CLIENT_COA;
    } catch {
      return INITIAL_CLIENT_COA;
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`c4_coa_${activeClient}`);
      setClientCoa(saved ? JSON.parse(saved) : INITIAL_CLIENT_COA);
    } catch {
      setClientCoa(INITIAL_CLIENT_COA);
    }
  }, [activeClient]);

  const [newLedgerName, setNewLedgerName] = useState("");
  const [newLedgerCategory, setNewLedgerCategory] = useState(DEFAULT_PL_CATEGORIES[1]);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState(null);
  const fileInputRef = useRef(null);

  const [currentForm, setCurrentForm] = useState(() => profiles[activeClient] || {
    companyName: activeClient,
    gstin: "",
    pan: "",
    address: "",
    phone: "",
    email: "",
    bankName: "",
    accountNo: "",
    ifscCode: "",
    branch: "",
    terms: "1. Goods once sold will not be taken back.\n2. Subject to local Jurisdiction.",
    logoUrl: ""
  });

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

  // 1. ADD SINGLE LEDGER
  const handleAddLedger = (e) => {
    e.preventDefault();
    if (!newLedgerName.trim()) {
      notify("Ledger Name cannot be blank", "error");
      return;
    }

    if (clientCoa.some(l => l.name.toLowerCase() === newLedgerName.trim().toLowerCase())) {
      notify(`Ledger "${newLedgerName}" already exists for this client!`, "error");
      return;
    }

    const created = {
      id: `coa_${Date.now()}`,
      name: newLedgerName.trim(),
      category: newLedgerCategory
    };

    setClientCoa(prev => [...prev, created]);
    setNewLedgerName("");
    notify(`Ledger "${created.name}" added to ${activeClient}!`, "success");
  };

  // 2. DELETE SINGLE LEDGER
  const handleDeleteLedger = (id, name) => {
    if (!window.confirm(`Delete ledger "${name}" from this client's accounts?`)) return;
    setClientCoa(prev => prev.filter(l => l.id !== id));
    notify(`Ledger "${name}" deleted.`, "info");
  };

  // 3. DOWNLOAD SAMPLE TEMPLATE (EXCEL / CSV)
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

  // 4. BULK UPLOAD HANDLER (.xlsx, .xls, .csv)
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
            const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
            rawRows = lines.map(line => line.split(",").map(c => c.replace(/["']/g, "").trim()));
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

          const headers = (rawRows[0] || []).map(h => String(h || "").trim().toLowerCase());
          const nameIdx = headers.findIndex(h => h.includes("ledger") || h.includes("account") || h.includes("name"));
          const catIdx = headers.findIndex(h => h.includes("category") || h.includes("group") || h.includes("head") || h.includes("p&l"));

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
            
            // Match to standard category or fallback to closest
            let matchedCat = DEFAULT_PL_CATEGORIES.find(c => c.toLowerCase() === rawCat.toLowerCase());
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
                matchedCat = DEFAULT_PL_CATEGORIES[3]; // Administrative & General
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

          // Offer Replace vs Append choice
          const replaceOption = window.confirm(
            `Extracted ${parsedLedgers.length} ledgers!\n\nClick OK to REPLACE the entire list for ${activeClient}.\nClick CANCEL to APPEND only new ledgers to current list.`
          );

          if (replaceOption) {
            setClientCoa(parsedLedgers);
            notify(`Replaced with ${parsedLedgers.length} ledgers for ${activeClient}!`, "success");
          } else {
            // Append unique only
            const existingNames = new Set(clientCoa.map(l => l.name.toLowerCase()));
            const newOnly = parsedLedgers.filter(l => !existingNames.has(l.name.toLowerCase()));
            setClientCoa(prev => [...prev, ...newOnly]);
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

  const handleSaveProfile = () => {
    if (!currentForm.companyName.trim()) {
      notify("Please provide a Legal Company Name", "error");
      return;
    }
    const targetName = currentForm.companyName.trim();
    setProfiles(prev => ({
      ...prev,
      [targetName]: { ...currentForm, companyName: targetName }
    }));
    setActiveClient(targetName);
    notify(`Profile for "${targetName}" saved successfully!`, "success");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Client Settings & Masters</h2>
          <p className="text-xs text-slate-500 font-medium">Configuring Profile & Custom P&L Chart of Accounts for: <strong className="text-slate-900">{activeClient}</strong></p>
        </div>

        <div className="flex items-center gap-2">
          {settingsTab === "profile" && (
            <button
              onClick={handleSaveProfile}
              className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <Save className="w-3.5 h-3.5" /> Save Profile
            </button>
          )}

          {settingsTab === "coa" && (
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

      {/* SUB-TABS */}
      <div className="px-8 pt-3 pb-0 flex items-center gap-6 border-b border-slate-200 bg-white shrink-0">
        <button
          onClick={() => setSettingsTab("coa")}
          className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            settingsTab === "coa" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Chart of Accounts & P&L Mapping
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900 text-white font-mono">
            {clientCoa.length}
          </span>
        </button>

        <button
          onClick={() => setSettingsTab("profile")}
          className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            settingsTab === "profile" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Building2 className="w-4 h-4" /> Client Profile & Bank
        </button>
      </div>

      <div className="p-8 max-w-5xl mx-auto w-full space-y-6">

        {/* TAB 1: CHART OF ACCOUNTS */}
        {settingsTab === "coa" && (
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
                    {DEFAULT_PL_CATEGORIES.map(cat => (
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
              {DEFAULT_PL_CATEGORIES.map(category => {
                const ledgersInCategory = clientCoa.filter(l => l.category === category);

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
                        {ledgersInCategory.map(item => (
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

        {/* TAB 2: PROFILE MANAGEMENT */}
        {settingsTab === "profile" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-600" /> Legal Profile & Statutory Info
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company / Trade Name</label>
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
                    value={currentForm.gstin}
                    onChange={(e) => setCurrentForm({ ...currentForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Registered Address</label>
                  <input
                    type="text"
                    value={currentForm.address}
                    onChange={(e) => setCurrentForm({ ...currentForm, address: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
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
                  <input
                    type="text"
                    value={currentForm.bankName}
                    onChange={(e) => setCurrentForm({ ...currentForm, bankName: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={currentForm.accountNo}
                    onChange={(e) => setCurrentForm({ ...currentForm, accountNo: e.target.value })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={currentForm.ifscCode}
                    onChange={(e) => setCurrentForm({ ...currentForm, ifscCode: e.target.value.toUpperCase() })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch</label>
                  <input
                    type="text"
                    value={currentForm.branch}
                    onChange={(e) => setCurrentForm({ ...currentForm, branch: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>
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
