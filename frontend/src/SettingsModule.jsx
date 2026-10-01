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
  ChevronRight, 
  ArrowLeft, 
  Filter, 
  Edit2, 
  Sparkles, 
  X, 
  Users, 
  Key, 
  UserCheck, 
  LayoutDashboard 
} from "lucide-react";
import { api } from "./api";

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
    return { 
      ...savedProfiles[clientName], 
      companyName: clientName,
      isItcEligible: savedProfiles[clientName].isItcEligible !== undefined ? savedProfiles[clientName].isItcEligible : true
    };
  }
  return {
    companyName: clientName,
    gstin: "",
    pan: "",
    isItcEligible: true,
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

const getPlNature = (ledger) => {
  if (ledger.statementType !== "P&L") return null;
  const cat = (ledger.category || "").toLowerCase();
  const name = (ledger.name || "").toLowerCase();

  if (cat.includes("sales") || cat.includes("revenue") || cat.includes("turnover") || name.startsWith("sales") || name.includes("dine-in") || name.includes("delivery sale")) {
    return "Revenue";
  }
  if (cat.includes("other income") || cat.includes("interest income") || cat.includes("indirect income") || name.includes("interest received") || name === "other income" || name === "interest") {
    return "Other Income";
  }
  if (ledger.cogsClassification === "COGS") return "COGS";
  if (ledger.cogsClassification === "Indirect") return "Indirect";
  if (cat.includes("purchase") || cat.includes("direct cost") || name.includes("purchase") || name.includes("raw material") || name.includes("dairy") || name.includes("groceries") || name.includes("sauces") || name.includes("vegetable") || name.includes("ingredient")) {
    return "COGS";
  }
  return "Indirect";
};

export default function SettingsModule({ activeClient, setActiveClient, onGoToDashboard }) {
  const [activeTab, setActiveTab] = useState("directory"); // 'directory' | 'users' | 'security' | 'manage_client'
  const [manageSubTab, setManageSubTab] = useState("profile"); // 'profile' | 'coa'

  const [adminCreds, setAdminCreds] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_admin_credentials");
      return saved ? JSON.parse(saved) : { username: "admin", password: "admin123", fullName: "Super Administrator" };
    } catch {
      return { username: "admin", password: "admin123", fullName: "Super Administrator" };
    }
  });

  const [adminForm, setAdminForm] = useState({ ...adminCreds });

  const [profiles, setProfiles] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_client_profiles");
      if (saved) return JSON.parse(saved);
      return {
        [activeClient]: {
          companyName: activeClient,
          gstin: "",
          pan: "",
          isItcEligible: true,
          address: ""
        }
      };
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

  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_user_accounts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentForm, setCurrentForm] = useState(() => getFreshProfileState(activeClient, profiles));
  const [coaFilter, setCoaFilter] = useState("ALL");

  const [newLedgerName, setNewLedgerName] = useState("");
  const [newStatementType, setNewStatementType] = useState("P&L");
  const [newLedgerCategory, setNewLedgerCategory] = useState("");
  const [newCostNature, setNewCostNature] = useState("COGS");
  const [newOpeningBalance, setNewOpeningBalance] = useState("");
  const [newOpeningBalanceType, setNewOpeningBalanceType] = useState("Cr");

  const [newUser, setNewUser] = useState({
    fullName: "",
    username: "",
    password: "",
    allowedClients: "ALL",
    permissions: {
      dashboard: "view",
      sales: "edit",
      purchases: "edit",
      otherExpenses: "edit",
      banking: "edit"
    },
    salesSubPerms: {
      allowNormal: true,
      allowPos: true,
      allowedDocTypes: ["Tax Invoice", "Bill of Supply", "Export Invoice"]
    }
  });

  const [editingLedger, setEditingLedger] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState(null);

  const logoInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- INITIAL CLOUD DATA RECONCILIATION ---
  useEffect(() => {
    async function loadCloudSettings() {
      try {
        const cloudProfiles = await api.getClients();
        if (cloudProfiles && Object.keys(cloudProfiles).length > 0) {
          setProfiles(cloudProfiles);
          localStorage.setItem("c4_client_profiles", JSON.stringify(cloudProfiles));
        }

        const cloudUsers = await api.getUsers();
        if (cloudUsers && cloudUsers.length > 0) {
          setUsers(cloudUsers);
          localStorage.setItem("c4_user_accounts", JSON.stringify(cloudUsers));
        }
      } catch (err) {
        console.warn("Using offline fallback for settings:", err);
      }
    }
    loadCloudSettings();
  }, []);

  // --- SYNC COA & PROFILE UPON ACTIVE CLIENT SWITCH ---
  useEffect(() => {
    try {
      const savedProfiles = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
      setCurrentForm(getFreshProfileState(activeClient, savedProfiles));
    } catch {
      setCurrentForm(getFreshProfileState(activeClient, {}));
    }

    async function loadActiveClientCoa() {
      try {
        const coaData = await api.getClientCoa(activeClient);
        if (coaData && Array.isArray(coaData) && coaData.length > 0) {
          setClientCoa(coaData);
          localStorage.setItem(`c4_coa_${activeClient}`, JSON.stringify(coaData));
          return;
        }
      } catch (err) {
        console.warn("Cloud COA fetch fallback to localStorage:", err);
      }

      try {
        const savedCoa = localStorage.getItem(`c4_coa_${activeClient}`);
        setClientCoa(savedCoa ? JSON.parse(savedCoa) : []);
      } catch {
        setClientCoa([]);
      }
    }

    if (activeClient) {
      loadActiveClientCoa();
    }
  }, [activeClient]);

  useEffect(() => {
    localStorage.setItem("c4_user_accounts", JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem("c4_client_profiles", JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    if (activeClient) {
      localStorage.setItem(`c4_coa_${activeClient}`, JSON.stringify(clientCoa));
    }
  }, [clientCoa, activeClient]);

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

  const handleOpenClient = async (clientName) => {
    setActiveClient(clientName);
    const savedProfiles = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
    setCurrentForm(getFreshProfileState(clientName, savedProfiles));
    setActiveTab("manage_client");
    setManageSubTab("profile");

    try {
      const coaData = await api.getClientCoa(clientName);
      if (coaData && Array.isArray(coaData) && coaData.length > 0) {
        setClientCoa(coaData);
        localStorage.setItem(`c4_coa_${clientName}`, JSON.stringify(coaData));
      }
    } catch (e) {
      console.warn("COA fetch on client open:", e);
    }
  };

  const handleAddNewClient = async () => {
    const newClientName = window.prompt("Enter Legal or Trade Name for the New Client:");
    if (!newClientName || !newClientName.trim()) return;

    const trimmed = newClientName.trim();
    if (profiles[trimmed]) {
      notify(`Client "${trimmed}" already exists!`, "error");
      handleOpenClient(trimmed);
      return;
    }

    const itcPrompt = window.confirm(
      `Is "${trimmed}" eligible for GST Input Tax Credit (ITC)?\n\nClick OK for YES (Regular Business - Full ITC).\nClick CANCEL for NO (Restaurant / Cafe 5% Scheme - Taxes route to GST Expense).`
    );

    const newProfile = {
      companyName: trimmed,
      gstin: "",
      pan: "",
      isItcEligible: itcPrompt,
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

    const defaultCoa = [];
    if (!itcPrompt) {
      defaultCoa.push({
        id: `coa_gst_exp_${Date.now()}`,
        name: "GST Expense on Purchase",
        statementType: "P&L",
        category: "Administrative & General Expenses",
        cogsClassification: "Indirect",
        openingBalance: 0,
        openingBalanceType: "Cr"
      });
    }

    try {
      await api.saveClientProfile(trimmed, newProfile);
      await api.saveClientCoa(trimmed, defaultCoa);

      const updated = { ...profiles, [trimmed]: newProfile };
      setProfiles(updated);
      localStorage.setItem("c4_client_profiles", JSON.stringify(updated));
      localStorage.setItem(`c4_coa_${trimmed}`, JSON.stringify(defaultCoa));

      setActiveClient(trimmed);
      setCurrentForm(newProfile);
      setClientCoa(defaultCoa);
      setActiveTab("manage_client");
      setManageSubTab("profile");

      notify(`Client "${trimmed}" created and persisted to Firestore!`, "success");
    } catch (err) {
      console.error(err);
      notify("Failed to save new client to cloud: " + err.message, "error");
    }
  };

  const handleDeleteClient = async (clientNameToDelete, e) => {
    e.stopPropagation();
    const clientKeys = Object.keys(profiles);
    if (clientKeys.length <= 1) {
      notify("You must maintain at least one client entity in the portal.", "error");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${clientNameToDelete}" and its COA from Firestore?`)) return;

    try {
      await api.deleteClientProfile(clientNameToDelete);

      const updated = { ...profiles };
      delete updated[clientNameToDelete];
      setProfiles(updated);
      localStorage.setItem("c4_client_profiles", JSON.stringify(updated));
      localStorage.removeItem(`c4_coa_${clientNameToDelete}`);

      if (activeClient === clientNameToDelete) {
        const remainingKey = Object.keys(updated)[0];
        setActiveClient(remainingKey);
      }

      notify(`Client "${clientNameToDelete}" permanently deleted.`, "info");
    } catch (err) {
      console.error(err);
      notify("Failed to delete client: " + err.message, "error");
    }
  };

  const handleSaveProfile = async () => {
    if (!currentForm.companyName.trim()) {
      notify("Please provide a Legal Company Name", "error");
      return;
    }
    const targetName = currentForm.companyName.trim();
    const profilePayload = { ...currentForm, companyName: targetName };

    try {
      await api.saveClientProfile(targetName, profilePayload);

      const updatedProfiles = {
        ...profiles,
        [targetName]: profilePayload
      };
      setProfiles(updatedProfiles);
      localStorage.setItem("c4_client_profiles", JSON.stringify(updatedProfiles));
      setActiveClient(targetName);
      notify(`Profile for "${targetName}" saved to Firestore!`, "success");
    } catch (err) {
      console.error(err);
      notify("Failed to save profile to cloud: " + err.message, "error");
    }
  };

  const handleSaveAdminCredentials = async (e) => {
    e.preventDefault();
    if (!adminForm.username.trim() || !adminForm.password.trim()) {
      notify("Master Username and Password cannot be blank", "error");
      return;
    }

    try {
      await fetch("https://compliance4-backend-1021821620394.asia-south1.run.app/api/system/admin-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminForm)
      }).catch(() => null);

      setAdminCreds({ ...adminForm });
      localStorage.setItem("c4_admin_credentials", JSON.stringify(adminForm));

      const currentSession = JSON.parse(localStorage.getItem("c4_auth_session") || "{}");
      if (currentSession.role === "admin") {
        currentSession.username = adminForm.username.trim();
        currentSession.fullName = adminForm.fullName.trim();
        localStorage.setItem("c4_auth_session", JSON.stringify(currentSession));
      }

      notify("Super Admin credentials updated successfully!", "success");
    } catch (err) {
      console.error(err);
      notify("Updated locally. Cloud sync warning: " + err.message, "info");
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.password.trim()) {
      notify("Username and Password are required", "error");
      return;
    }

    const cleanUser = newUser.username.trim().toLowerCase();
    if (cleanUser === adminCreds.username.toLowerCase() || users.some((u) => u.username.toLowerCase() === cleanUser)) {
      notify(`Username "${newUser.username}" already taken!`, "error");
      return;
    }

    const created = {
      id: `usr_${Date.now()}`,
      fullName: newUser.fullName.trim() || newUser.username.trim(),
      username: cleanUser,
      password: newUser.password,
      role: "staff",
      allowedClients: newUser.allowedClients,
      permissions: { ...newUser.permissions },
      salesSubPerms: { ...newUser.salesSubPerms },
      isActive: true,
      createdAt: new Date().toLocaleDateString("en-IN")
    };

    try {
      await api.saveUser(created);
      setUsers((prev) => [created, ...prev]);

      setNewUser({
        fullName: "",
        username: "",
        password: "",
        allowedClients: "ALL",
        permissions: {
          dashboard: "view",
          sales: "edit",
          purchases: "edit",
          otherExpenses: "edit",
          banking: "edit"
        },
        salesSubPerms: {
          allowNormal: true,
          allowPos: true,
          allowedDocTypes: ["Tax Invoice", "Bill of Supply", "Export Invoice"]
        }
      });
      notify(`User "${created.fullName}" created & saved to Firestore!`, "success");
    } catch (err) {
      console.error(err);
      notify("Error persisting user to cloud: " + err.message, "error");
    }
  };

  const handleDeleteUser = async (id, username) => {
    if (!window.confirm(`Delete user "${username}" from Cloud Database?`)) return;
    try {
      await api.deleteUser(username);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      notify(`User "${username}" permanently deleted.`, "info");
    } catch (err) {
      console.error(err);
      notify("Failed to delete user: " + err.message, "error");
    }
  };

  const handleToggleUserStatus = async (id) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;

    const updatedUser = { ...target, isActive: !target.isActive };
    try {
      await api.saveUser(updatedUser);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? updatedUser : u))
      );
      notify(`User "${updatedUser.username}" is now ${updatedUser.isActive ? "Active" : "Disabled"}.`, "info");
    } catch (err) {
      console.error(err);
      notify("Failed to update status: " + err.message, "error");
    }
  };

  const handleDocTypeToggle = (type) => {
    const current = newUser.salesSubPerms.allowedDocTypes || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];

    if (updated.length === 0) {
      notify("At least one invoice document type must remain enabled", "error");
      return;
    }

    setNewUser({
      ...newUser,
      salesSubPerms: { ...newUser.salesSubPerms, allowedDocTypes: updated }
    });
  };

  const handleAddLedger = async (e) => {
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

    const created = {
      id: `coa_${Date.now()}`,
      name: newLedgerName.trim(),
      statementType: newStatementType,
      category: newLedgerCategory.trim(),
      cogsClassification: newStatementType === "P&L" ? newCostNature : null,
      openingBalance: parseFloat(newOpeningBalance) || 0,
      openingBalanceType: newOpeningBalanceType
    };

    const nextList = [...clientCoa, created];
    setClientCoa(nextList);
    setNewLedgerName("");
    setNewLedgerCategory("");
    setNewCostNature("COGS");
    setNewOpeningBalance("");
    setNewOpeningBalanceType("Cr");

    try {
      await api.saveClientCoa(activeClient, nextList);
      notify(`Ledger "${created.name}" saved and synced to Firestore!`, "success");
    } catch (err) {
      console.error(err);
      notify(`Ledger saved locally, cloud sync error: ${err.message}`, "error");
    }
  };

  const handleToggleCogsClassification = async (id) => {
    const nextList = clientCoa.map((l) => {
      if (l.id === id) {
        const currentNature = getPlNature(l);
        if (currentNature === "Revenue" || currentNature === "Other Income") return l;
        const next = currentNature === "COGS" ? "Indirect" : "COGS";
        return { ...l, cogsClassification: next };
      }
      return l;
    });

    setClientCoa(nextList);

    try {
      await api.saveClientCoa(activeClient, nextList);
      notify("Classification updated in Firestore!", "info");
    } catch (err) {
      console.error(err);
    }
  };

  const handleAutoFixPurchasesToCogs = async () => {
    let updatedCount = 0;
    const nextList = clientCoa.map((l) => {
      if (l.statementType === "P&L") {
        const nature = getPlNature(l);
        if (nature === "Revenue" || nature === "Other Income") return l;

        const lowerName = l.name.toLowerCase();
        const lowerCat = (l.category || "").toLowerCase();

        const isPurchase =
          lowerCat.includes("purchase") ||
          lowerName.includes("purchase") ||
          lowerName.includes("dairy") ||
          lowerName.includes("groceries") ||
          lowerName.includes("beverage") ||
          lowerName.includes("dessert") ||
          lowerName.includes("frozen") ||
          lowerName.includes("sauces") ||
          lowerName.includes("vegetable") ||
          lowerName.includes("packing") ||
          lowerName.includes("ingredient") ||
          lowerName.includes("gas");

        if (isPurchase && l.cogsClassification !== "COGS") {
          updatedCount++;
          return { ...l, cogsClassification: "COGS" };
        }
      }
      return l;
    });

    if (updatedCount > 0) {
      setClientCoa(nextList);
      try {
        await api.saveClientCoa(activeClient, nextList);
        notify(`Auto-tagged ${updatedCount} purchase ledgers to Direct (COGS) & synced to Firestore!`, "success");
      } catch (err) {
        console.error(err);
        notify(`Tagged locally. Firestore sync warning: ${err.message}`, "info");
      }
    } else {
      notify("All purchase ledgers are already classified as COGS.", "info");
    }
  };

  const handleSaveEditLedger = async () => {
    if (!editingLedger || !editingLedger.name.trim()) return;

    const nextList = clientCoa.map((l) =>
      l.id === editingLedger.id
        ? {
            ...l,
            name: editingLedger.name.trim(),
            category: editingLedger.category.trim(),
            statementType: editingLedger.statementType,
            cogsClassification:
              editingLedger.statementType === "P&L"
                ? editingLedger.cogsClassification
                : null,
            openingBalance: parseFloat(editingLedger.openingBalance) || 0,
            openingBalanceType: editingLedger.openingBalanceType || "Cr"
          }
        : l
    );

    setClientCoa(nextList);
    setEditingLedger(null);

    try {
      await api.saveClientCoa(activeClient, nextList);
      notify(`Updated ledger "${editingLedger.name}" in Firestore!`, "success");
    } catch (err) {
      console.error(err);
      notify("Saved locally. Firestore error: " + err.message, "error");
    }
  };

  const handleDeleteLedger = async (id, name) => {
    if (!window.confirm(`Delete ledger "${name}" from Firestore?`)) return;
    const nextList = clientCoa.filter((l) => l.id !== id);
    setClientCoa(nextList);

    try {
      await api.saveClientCoa(activeClient, nextList);
      notify(`Ledger "${name}" deleted from Firestore.`, "info");
    } catch (err) {
      console.error(err);
      notify("Deleted locally. Firestore sync error: " + err.message, "error");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await loadSheetJS();
      const templateData = [
        ["Ledger Name", "Statement Type", "Category", "P&L Nature", "Opening Balance", "Dr/Cr"],
        ["Purchases - Dairy Products", "P&L", "Purchases", "COGS", "0.00", "Cr"],
        ["GST Expense on Purchase", "P&L", "Administrative & General Expenses", "Indirect", "0.00", "Cr"],
        ["HDFC Bank A/c", "Balance Sheet", "Cash & Bank Balances", "", "150000.00", "Dr"],
        ["Sundry Creditors / Supplier Settlement", "Balance Sheet", "Current Liabilities", "", "45000.00", "Cr"]
      ];

      const ws = XLSX.utils.aoa_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Chart_of_Accounts");
      XLSX.writeFile(wb, `COA_Template_${activeClient.replace(/\s+/g, "_")}.xlsx`);
      notify("COA Template downloaded!", "success");
    } catch {
      notify("Failed to create template", "error");
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

      reader.onload = async (event) => {
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
          const natureIdx = headers.findIndex((h) => h.includes("nature") || h.includes("cogs") || h.includes("cost"));
          const openBalIdx = headers.findIndex((h) => h.includes("opening") || h.includes("open") || h.includes("balance"));
          const drCrIdx = headers.findIndex((h) => h.includes("dr") || h.includes("cr") || h.includes("type"));

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
            }

            let category = "General Overheads";
            if (catIdx !== -1 && row[catIdx] && String(row[catIdx]).trim().length > 0) {
              category = String(row[catIdx]).trim();
            } else {
              category = statementType === "Balance Sheet" ? "Balance Sheet Items" : "Operational Expenses";
            }

            let cogsClassification = null;
            if (statementType === "P&L") {
              if (natureIdx !== -1 && row[natureIdx]) {
                const val = String(row[natureIdx]).trim().toLowerCase();
                if (val.includes("rev") || val.includes("sale")) cogsClassification = "Revenue";
                else if (val.includes("income")) cogsClassification = "Other Income";
                else if (val.includes("cogs") || val.includes("direct")) cogsClassification = "COGS";
                else cogsClassification = "Indirect";
              }
            }

            let openingBalance = 0;
            if (openBalIdx !== -1 && row[openBalIdx]) {
              const cleanedAmt = String(row[openBalIdx]).replace(/,/g, "").trim();
              openingBalance = parseFloat(cleanedAmt) || 0;
            }

            let openingBalanceType = "Cr";
            if (drCrIdx !== -1 && row[drCrIdx]) {
              const tVal = String(row[drCrIdx]).trim().toUpperCase();
              if (tVal.includes("DR")) openingBalanceType = "Dr";
            }

            parsedLedgers.push({
              id: `coa_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
              name,
              statementType,
              category,
              cogsClassification,
              openingBalance,
              openingBalanceType
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

          let finalLedgers = [];
          if (replaceOption) {
            finalLedgers = parsedLedgers;
          } else {
            const existingNames = new Set(clientCoa.map((l) => l.name.toLowerCase()));
            const newOnly = parsedLedgers.filter((l) => !existingNames.has(l.name.toLowerCase()));
            finalLedgers = [...clientCoa, ...newOnly];
          }

          setClientCoa(finalLedgers);
          await api.saveClientCoa(activeClient, finalLedgers);
          notify(`Successfully uploaded & synced ${finalLedgers.length} ledgers to Firestore!`, "success");
        } catch (err) {
          console.error(err);
          notify("Failed to process spreadsheet file: " + err.message, "error");
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

  const clientListKeys = Object.keys(profiles);

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto bg-[#F8FAFC] font-sans">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-xs shrink-0">
        <div>
          <div className="flex items-center gap-3">
            {activeTab === "manage_client" && (
              <button
                onClick={() => setActiveTab("directory")}
                className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to All Settings
              </button>
            )}
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeTab === "directory" ? "Settings & Master Administration" : activeTab === "users" ? "Portal User Management" : activeTab === "security" ? "Super Admin Security" : `Managing: ${activeClient}`}
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {activeTab === "directory" ? "Client entities, master COA, and organizational controls" : activeTab === "users" ? "Provision staff, client logins, and module privileges" : activeTab === "security" ? "Change master username and secret authentication password" : "Configure legal profile, branding, bank details, and Chart of Accounts"}
          </p>
        </div>

        {/* TOP BUTTON ACTIONS */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onGoToDashboard && onGoToDashboard()}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition shadow-xs mr-2"
            title="Return to Main Dashboard"
          >
            <LayoutDashboard className="w-4 h-4 text-slate-600" /> Dashboard
          </button>

          {activeTab === "directory" && (
            <button
              onClick={handleAddNewClient}
              className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
            >
              <Plus className="w-4 h-4" /> + Add New Client
            </button>
          )}

          {activeTab === "manage_client" && manageSubTab === "profile" && (
            <button
              onClick={handleSaveProfile}
              className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition shadow-xs"
            >
              <Save className="w-3.5 h-3.5" /> Save Profile
            </button>
          )}

          {activeTab === "manage_client" && manageSubTab === "coa" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoFixPurchasesToCogs}
                className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold px-3.5 py-2 rounded-lg transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Auto-Tag Purchases to COGS
              </button>

              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition"
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
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-xs disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {isUploading ? "Uploading..." : "Bulk Upload COA"}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* TOP-LEVEL ROOT NAVIGATION TABS */}
      {activeTab !== "manage_client" && (
        <div className="px-8 pt-3 pb-0 flex items-center gap-6 border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={() => setActiveTab("directory")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "directory" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Building2 className="w-4 h-4" /> Client Entities ({clientListKeys.length})
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "users" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Users className="w-4 h-4" /> User Access & Permissions ({users.length + 1})
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "security" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Key className="w-4 h-4" /> Super Admin Credentials
          </button>
        </div>
      )}

      {/* MANAGE TABS WHEN DRILLING INTO A SPECIFIC CLIENT */}
      {activeTab === "manage_client" && (
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
        </div>
      )}

      {/* BODY VIEWPORT */}
      <div className="p-8 max-w-5xl mx-auto w-full space-y-6">

        {/* 1. MASTER DIRECTORY TAB */}
        {activeTab === "directory" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Configured Client Entities ({clientListKeys.length})</h3>
                <p className="text-xs text-slate-500">
                  Select <strong>"Manage Client & COA"</strong> to edit profile, branding, bank accounts, or custom Chart of Accounts.
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
                    className={`bg-white rounded-xl border p-5 transition shadow-xs hover:shadow-md flex flex-col justify-between ${
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
                        <p className="flex items-center gap-1.5">
                          <strong>GST Scheme:</strong> 
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${profile.isItcEligible !== false ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-300"}`}>
                            {profile.isItcEligible !== false ? "ITC Eligible (Regular)" : "Non-ITC (Cafe Scheme)"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded">
                        {coaCount} Custom Ledgers
                      </span>

                      <button
                        onClick={() => handleOpenClient(clientName)}
                        className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition shadow-xs"
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

        {/* 2. TOP-LEVEL USER ACCESS TAB */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <form onSubmit={handleCreateUser} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600" /> Create New Staff / Client User
                </h3>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Username (User ID)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. rahul_ops"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Client Entity</label>
                  <select
                    value={newUser.allowedClients}
                    onChange={(e) => setNewUser({ ...newUser, allowedClients: e.target.value })}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800"
                  >
                    <option value="ALL">All Clients (Full Multi-Tenant Access)</option>
                    {clientListKeys.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Save User Credentials
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 3. SUPER ADMIN SECURITY TAB */}
        {activeTab === "security" && (
          <div className="max-w-xl mx-auto bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Key className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Change Super Administrator Credentials</h3>
            </div>

            <form onSubmit={handleSaveAdminCredentials} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Administrator Display Name</label>
                <input
                  type="text"
                  required
                  value={adminForm.fullName}
                  onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Master User ID / Username</label>
                <input
                  type="text"
                  required
                  value={adminForm.username}
                  onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Master Password</label>
                <input
                  type="text"
                  required
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs transition"
                >
                  Save Master Credentials
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 4. MANAGING A SPECIFIC CLIENT (PROFILE & BRANDING) */}
        {activeTab === "manage_client" && manageSubTab === "profile" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-slate-600" /> Entity Branding & Signatures (For Invoices)
              </h3>

              <div className="grid grid-cols-2 gap-6 pt-2">
                <div className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50/50">
                  {currentForm.logoUrl ? (
                    <div className="relative group mb-3">
                      <img src={currentForm.logoUrl} alt="Logo" className="max-h-24 max-w-full object-contain rounded border border-slate-200 bg-white p-1" />
                      <button onClick={() => setCurrentForm((p) => ({ ...p, logoUrl: "" }))} className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-sm hover:bg-rose-700">
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
                      <button onClick={() => setCurrentForm((p) => ({ ...p, signatureUrl: "" }))} className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-sm hover:bg-rose-700">
                        <Trash2 className="w-3 h-3" />
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

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-600" /> Legal Entity & GST Configuration
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    GST Scheme & ITC Eligibility <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={currentForm.isItcEligible ? "YES" : "NO"}
                    onChange={(e) => setCurrentForm({ ...currentForm, isItcEligible: e.target.value === "YES" })}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  >
                    <option value="YES">YES — Eligible for Full Input Tax Credit (Regular GST Scheme)</option>
                    <option value="NO">NO — Ineligible for ITC (Standalone Restaurant / Cafe 5% Scheme)</option>
                  </select>
                </div>

                <div className="col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Registered Business Address</label>
                  <input type="text" placeholder="Complete Office Address" value={currentForm.address} onChange={(e) => setCurrentForm({ ...currentForm, address: e.target.value })} className="w-full text-xs border border-slate-300 rounded-lg p-2" />
                </div>
              </div>
            </div>

            {/* CONTACT PERSON DETAILS */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-600" /> Contact Person Details
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person Name</label>
                  <input type="text" value={currentForm.contactPerson || ""} onChange={(e) => setCurrentForm({ ...currentForm, contactPerson: e.target.value })} className="w-full text-xs border border-slate-300 rounded-lg p-2" placeholder="e.g. Rajesh Kumar" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input type="text" value={currentForm.phone || ""} onChange={(e) => setCurrentForm({ ...currentForm, phone: e.target.value })} className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2" placeholder="e.g. 9876543210" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input type="email" value={currentForm.email || ""} onChange={(e) => setCurrentForm({ ...currentForm, email: e.target.value })} className="w-full text-xs border border-slate-300 rounded-lg p-2" placeholder="e.g. contact@business.com" />
                </div>
              </div>
            </div>

            {/* PRIMARY BANK DETAILS */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
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

            {/* PREFIXED MESSAGE / TERMS FOR SALES INVOICE */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-600" /> Terms & Conditions / Prefixed Invoice Notes
              </h3>
              <div>
                <textarea rows={3} value={currentForm.terms} onChange={(e) => setCurrentForm({ ...currentForm, terms: e.target.value })} className="w-full text-xs border border-slate-300 rounded-lg p-2.5 font-medium leading-relaxed" />
                <p className="text-[10px] text-slate-400 mt-1">This text appears at the bottom of generated invoices and bill prints.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={handleSaveProfile} className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-md">
                <Save className="w-4 h-4" /> Save Profile & Brand Masters
              </button>
            </div>
          </div>
        )}

        {/* 5. MANAGING CLIENT COA (WITH OPENING BALANCE) */}
        {activeTab === "manage_client" && manageSubTab === "coa" && (
          <div className="space-y-6">
            <form onSubmit={handleAddLedger} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-slate-600" /> Add Single Ledger for {activeClient}
                </h3>
              </div>

              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ledger Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Purchases - Dairy Products"
                    value={newLedgerName}
                    onChange={(e) => setNewLedgerName(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Statement Nature <span className="text-rose-500">*</span></label>
                  <select
                    value={newStatementType}
                    onChange={(e) => setNewStatementType(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                  >
                    <option value="P&L">Profit & Loss (P&L)</option>
                    <option value="Balance Sheet">Balance Sheet</option>
                  </select>
                </div>

                {newStatementType === "P&L" && (
                  <div className="col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">P&L Item Nature</label>
                    <select
                      value={newCostNature}
                      onChange={(e) => setNewCostNature(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                    >
                      <option value="COGS">Direct Cost / Purchase (COGS)</option>
                      <option value="Indirect">Indirect Operating Expense</option>
                      <option value="Revenue">Revenue from Operations (Sales)</option>
                      <option value="Other Income">Other Income</option>
                    </select>
                  </div>
                )}

                <div className={newStatementType === "P&L" ? "col-span-3" : "col-span-6"}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Purchases / Administrative"
                    value={newLedgerCategory}
                    onChange={(e) => setNewLedgerCategory(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                  />
                </div>

                {/* OPENING BALANCE INPUTS */}
                <div className="col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newOpeningBalance}
                    onChange={(e) => setNewOpeningBalance(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dr / Cr</label>
                  <select
                    value={newOpeningBalanceType}
                    onChange={(e) => setNewOpeningBalanceType(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                  >
                    <option value="Dr">Dr</option>
                    <option value="Cr">Cr</option>
                  </select>
                </div>

                <div className="col-span-6 flex justify-end pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Ledger
                  </button>
                </div>
              </div>
            </form>

            <div className="space-y-4">
              {Object.keys(categoriesGrouped).length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
                  No ledgers uploaded yet for {activeClient}.
                </div>
              ) : (
                Object.entries(categoriesGrouped).map(([categoryName, ledgers]) => {
                  const statementNature = ledgers[0]?.statementType || "P&L";

                  return (
                    <div key={categoryName} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
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
                        {ledgers.map((item) => {
                          const openBal = Number(item.openingBalance || 0);

                          return (
                            <div key={item.id} className="px-5 py-2.5 flex items-center justify-between hover:bg-slate-50/50 transition">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-800">{item.name}</span>
                                {openBal !== 0 && (
                                  <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                    Op. Bal: ₹{openBal.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {item.openingBalanceType || "Cr"}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setEditingLedger(item)}
                                  className="text-slate-300 hover:text-indigo-600 p-1.5 rounded transition"
                                  title="Edit Ledger Details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteLedger(item.id, item.name)}
                                  className="text-slate-300 hover:text-rose-600 p-1.5 rounded transition"
                                  title="Delete Ledger"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* EDIT LEDGER MODAL */}
      {editingLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Edit Chart of Account Ledger</h3>
              <button onClick={() => setEditingLedger(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ledger Name</label>
                <input
                  type="text"
                  value={editingLedger.name}
                  onChange={(e) => setEditingLedger({ ...editingLedger, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category / Head</label>
                <input
                  type="text"
                  value={editingLedger.category}
                  onChange={(e) => setEditingLedger({ ...editingLedger, category: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingLedger.openingBalance || ""}
                    onChange={(e) => setEditingLedger({ ...editingLedger, openingBalance: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dr / Cr</label>
                  <select
                    value={editingLedger.openingBalanceType || "Cr"}
                    onChange={(e) => setEditingLedger({ ...editingLedger, openingBalanceType: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 font-bold bg-white text-slate-900"
                  >
                    <option value="Dr">Dr</option>
                    <option value="Cr">Cr</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingLedger(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditLedger}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Update Ledger
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
