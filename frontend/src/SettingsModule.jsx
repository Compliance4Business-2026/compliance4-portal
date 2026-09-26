import React, { useState, useEffect, useRef } from "react";
import { 
  Building2, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Plus, 
  Trash2, 
  Image as ImageIcon,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  FileText
} from "lucide-react";

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
  if (!gstin) return { isValid: false, reason: "Missing" };
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) return { isValid: false, reason: "Must be 15 chars" };
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) return { isValid: false, reason: "Structure mismatch" };

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
  return { isValid: expectedCheckChar === clean[14], stateName, stateCode };
}

export default function SettingsModule({ activeClient, setActiveClient }) {
  const [profiles, setProfiles] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_client_profiles");
      return saved ? JSON.parse(saved) : {
        "Panasuria Confectionery": {
          companyName: "Panasuria Confectionery",
          gstin: "24AABCP1234F1Z9",
          pan: "AABCP1234F",
          address: "GF-14, Titanium City Center, Anandnagar Road, Prahladnagar, Ahmedabad - 380015",
          phone: "+91 98250 12345",
          email: "accounts@panasuria.com",
          bankName: "HDFC Bank",
          accountNo: "50200080509922",
          ifscCode: "HDFC0000006",
          branch: "Prahladnagar Branch, Ahmedabad",
          terms: "1. Subject to our home Jurisdiction.\n2. Our Responsibility Ceases as soon as goods leaves our Premises.\n3. Goods once sold will not be taken back.\n4. Delivery Ex-Premises.",
          logoUrl: ""
        }
      };
    } catch {
      return {};
    }
  });

  const [currentForm, setCurrentForm] = useState(
    profiles[activeClient] || {
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
    }
  );

  const [notification, setNotification] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("c4_client_profiles", JSON.stringify(profiles));
    // Keep backward-compatible pointer for active sales vendor profile
    if (profiles[activeClient]) {
      localStorage.setItem("c4_vendor_profile", JSON.stringify(profiles[activeClient]));
    }
  }, [profiles, activeClient]);

  useEffect(() => {
    if (profiles[activeClient]) {
      setCurrentForm(profiles[activeClient]);
    } else {
      setCurrentForm({
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
    }
  }, [activeClient]);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCurrentForm(prev => ({ ...prev, logoUrl: reader.result }));
      notify("Logo uploaded. Click 'Save Profile' to apply.", "info");
    };
    reader.readAsDataURL(file);
  };

  const handleGSTINChange = (val) => {
    const clean = val.toUpperCase().trim();
    const check = validateGSTIN(clean);
    let extractedPan = currentForm.pan;
    if (clean.length >= 12) {
      extractedPan = clean.substring(2, 12);
    }
    setCurrentForm(prev => ({
      ...prev,
      gstin: clean,
      pan: extractedPan
    }));
  };

  const handleSaveProfile = () => {
    if (!currentForm.companyName.trim()) {
      notify("Company Name is required", "error");
      return;
    }

    const updated = {
      ...profiles,
      [currentForm.companyName]: currentForm
    };

    setProfiles(updated);
    setActiveClient(currentForm.companyName);
    notify(`Profile for "${currentForm.companyName}" successfully saved!`, "success");
  };

  const handleAddNewClientPrompt = () => {
    const name = window.prompt("Enter Legal / Trade Name for new client entity:");
    if (!name || !name.trim()) return;

    const trimmed = name.trim();
    if (profiles[trimmed]) {
      setActiveClient(trimmed);
      notify(`Switched to existing client "${trimmed}"`, "info");
      return;
    }

    const newProfile = {
      companyName: trimmed,
      gstin: "",
      pan: "",
      address: "",
      phone: "",
      email: "",
      bankName: "HDFC Bank",
      accountNo: "",
      ifscCode: "",
      branch: "",
      terms: "1. Goods once sold will not be taken back.\n2. Subject to local Jurisdiction.",
      logoUrl: ""
    };

    setProfiles(prev => ({ ...prev, [trimmed]: newProfile }));
    setActiveClient(trimmed);
    notify(`New client "${trimmed}" added and activated!`, "success");
  };

  const gstCheck = validateGSTIN(currentForm.gstin);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Client Profile Master & Settings</h2>
          <p className="text-xs text-slate-500 font-medium">Configure entity branding, statutory GSTIN, and settlement bank accounts</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleAddNewClientPrompt}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" /> + Add Client Entity
          </button>
          <button
            onClick={handleSaveProfile}
            className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition shadow-sm"
          >
            <Save className="w-3.5 h-3.5" /> Save Profile
          </button>
        </div>
      </header>

      <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
        
        {/* ENTITY PICKER TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Entities:</span>
          {Object.keys(profiles).map(name => (
            <button
              key={name}
              onClick={() => setActiveClient(name)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeClient === name
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              {name}
            </button>
          ))}
        </div>

        {/* SECTION 1: BRANDING & IDENTITY */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-slate-600" /> Organization Identity & Trade Name
          </h3>

          <div className="grid grid-cols-4 gap-6 items-center">
            {/* LOGO UPLOAD BOX */}
            <div className="col-span-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-slate-400 transition bg-slate-50/50 text-center">
              {currentForm.logoUrl ? (
                <div className="relative group w-24 h-24 flex items-center justify-center">
                  <img
                    src={currentForm.logoUrl}
                    alt="Logo"
                    className="max-h-24 max-w-24 object-contain rounded"
                  />
                  <button
                    onClick={() => setCurrentForm(prev => ({ ...prev, logoUrl: "" }))}
                    className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition shadow"
                    title="Remove Logo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 mb-2">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700">Company Logo</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, SVG</span>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded transition"
              >
                {currentForm.logoUrl ? "Change Logo" : "Upload Logo"}
              </button>
            </div>

            {/* COMPANY NAME & CONTACT DETAILS */}
            <div className="col-span-3 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Legal / Registered Trade Name</label>
                <input
                  type="text"
                  value={currentForm.companyName}
                  onChange={(e) => setCurrentForm({ ...currentForm, companyName: e.target.value })}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Contact Phone</label>
                  <input
                    type="text"
                    value={currentForm.phone}
                    onChange={(e) => setCurrentForm({ ...currentForm, phone: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                    placeholder="+91 98250 00000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Accounts / Billing Email</label>
                  <input
                    type="email"
                    value={currentForm.email}
                    onChange={(e) => setCurrentForm({ ...currentForm, email: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                    placeholder="accounts@domain.com"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: STATUTORY GSTIN & ADDRESS */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-600" /> GSTIN, PAN & Place of Business
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Client GSTIN (15 Digits)</label>
                {currentForm.gstin && (
                  gstCheck.isValid ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" /> {gstCheck.stateName} ({gstCheck.stateCode})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                      <ShieldAlert className="w-2.5 h-2.5 text-rose-600" /> Invalid
                    </span>
                  )
                )}
              </div>
              <input
                type="text"
                placeholder="24AABCP1234F1Z9"
                value={currentForm.gstin}
                onChange={(e) => handleGSTINChange(e.target.value)}
                className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PAN Number</label>
              <input
                type="text"
                placeholder="AABCP1234F"
                value={currentForm.pan}
                onChange={(e) => setCurrentForm({ ...currentForm, pan: e.target.value.toUpperCase() })}
                className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tally Prime Target Company Name</label>
              <input
                type="text"
                value={currentForm.companyName}
                disabled
                className="w-full text-xs font-medium border border-slate-200 bg-slate-50 text-slate-500 rounded-lg p-2"
              />
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">Complete Registered Address (Printed on Invoices)</label>
              <input
                type="text"
                value={currentForm.address}
                onChange={(e) => setCurrentForm({ ...currentForm, address: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
                placeholder="Shop/Floor No, Building Name, Street, Area, City, State - Pincode"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: BANK DETAILS & TERMS */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-slate-600" /> Default Bank Account for Settlement
          </h3>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={currentForm.bankName}
                onChange={(e) => setCurrentForm({ ...currentForm, bankName: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
                placeholder="e.g. HDFC Bank"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                value={currentForm.accountNo}
                onChange={(e) => setCurrentForm({ ...currentForm, accountNo: e.target.value })}
                className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                placeholder="502000xxxxxx"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code</label>
              <input
                type="text"
                value={currentForm.ifscCode}
                onChange={(e) => setCurrentForm({ ...currentForm, ifscCode: e.target.value.toUpperCase() })}
                className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                placeholder="HDFC0000006"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Branch Name</label>
              <input
                type="text"
                value={currentForm.branch}
                onChange={(e) => setCurrentForm({ ...currentForm, branch: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
                placeholder="Prahladnagar, Ahmedabad"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Default Terms & Conditions</label>
            <textarea
              rows={3}
              value={currentForm.terms}
              onChange={(e) => setCurrentForm({ ...currentForm, terms: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
            />
          </div>
        </div>

        {/* SAVE BUTTON AT BOTTOM */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveProfile}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <Save className="w-4 h-4" /> Save Profile Details
          </button>
        </div>
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
