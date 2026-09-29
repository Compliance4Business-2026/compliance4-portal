import React, { useState, useEffect } from "react";
import DashboardModule from "./DashboardModule";
import SalesModule from "./SalesModule";
import PurchaseModule from "./PurchaseModule";
import OtherExpensesModule from "./OtherExpensesModule";
import BankModule from "./BankModule";
import SettingsModule from "./SettingsModule";
import LoginModal from "./LoginModal";
import { api } from "./api";

import {
  LayoutDashboard,
  Receipt,
  FileSpreadsheet,
  Layers,
  Landmark,
  Settings,
  LogOut,
  Building2
} from "lucide-react";

export default function App() {
  // Session State: Require explicit login instead of auto-fallback to super admin
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_auth_session");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [activeTab, setActiveTab] = useState("dashboard");

  const [profiles, setProfiles] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_client_profiles");
      if (saved && Object.keys(JSON.parse(saved)).length > 0) return JSON.parse(saved);
      return {
        "Pansuria Confectionery & Food": {
          companyName: "Pansuria Confectionery & Food",
          isItcEligible: false
        }
      };
    } catch {
      return {
        "Pansuria Confectionery & Food": {
          companyName: "Pansuria Confectionery & Food",
          isItcEligible: false
        }
      };
    }
  });

  const [activeClient, setActiveClient] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_active_client");
      if (saved) return saved;
      return "Pansuria Confectionery & Food";
    } catch {
      return "Pansuria Confectionery & Food";
    }
  });

  // --- SYNC CLIENTS FROM GOOGLE CLOUD FIRESTORE ON APP LOAD ---
  useEffect(() => {
    async function loadCloudClients() {
      try {
        const cloudClients = await api.getClients();
        if (cloudClients && Object.keys(cloudClients).length > 0) {
          setProfiles(cloudClients);
          localStorage.setItem("c4_client_profiles", JSON.stringify(cloudClients));
        }
      } catch (err) {
        console.error("Error fetching clients from cloud:", err);
      }
    }
    loadCloudClients();
  }, []);

  useEffect(() => {
    localStorage.setItem("c4_active_client", activeClient);
  }, [activeClient]);

  const availableClients = Object.keys(profiles).filter((clientName) => {
    if (!currentUser || currentUser.role === "admin" || currentUser.allowedClients === "ALL") {
      return true;
    }
    return currentUser.allowedClients === clientName;
  });

  useEffect(() => {
    if (currentUser && currentUser.allowedClients !== "ALL" && currentUser.allowedClients) {
      setActiveClient(currentUser.allowedClients);
    }
  }, [currentUser]);

  const handleLogout = () => {
    if (window.confirm("Do you want to switch user or sign in again?")) {
      localStorage.removeItem("c4_auth_session");
      setCurrentUser(null);
    }
  };

  // If user is not logged in, show clean login overlay and gate portal access
  if (!currentUser) {
    return (
      <LoginModal 
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          localStorage.setItem("c4_auth_session", JSON.stringify(user));
        }} 
      />
    );
  }

  const perms = currentUser.permissions || {};

  return (
    <div className="flex h-screen w-screen bg-[#F8FAFC] overflow-hidden font-sans">
      {/* SIDEBAR NAVIGATION (PERMANENT & UNBREAKABLE) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-xs z-30">
        <div>
          {/* BRAND LOGO */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              {/* Enlarged C4B Squircle Badge */}
              <div className="w-11 h-11 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm tracking-tight shadow-md shrink-0">
                C4B
              </div>
              
              {/* Stacked Wordmark with Increased Typography */}
              <div className="flex flex-col justify-center">
                <span className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                  Compliance4
                </span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mt-0.5">
                  Business
                </span>
              </div>
            </div>
          </div>

          {/* ACTIVE CLIENT ENTITY SWITCHER */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Active Client Entity
            </span>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
              <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={activeClient}
                onChange={(e) => setActiveClient(e.target.value)}
                disabled={currentUser.allowedClients !== "ALL"}
                className="w-full text-xs font-bold text-slate-800 bg-transparent focus:outline-none truncate cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {availableClients.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* NAV LINKS */}
          <nav className="p-4 space-y-1">
            {perms.dashboard !== "none" && (
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeTab === "dashboard"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
            )}

            {perms.sales !== "none" && (
              <button
                onClick={() => setActiveTab("sales")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeTab === "sales"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Receipt className="w-4 h-4" /> Sales
              </button>
            )}

            {perms.purchases !== "none" && (
              <button
                onClick={() => setActiveTab("purchases")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeTab === "purchases"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" /> Purchases
              </button>
            )}

            {perms.otherExpenses !== "none" && (
              <button
                onClick={() => setActiveTab("otherExpenses")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeTab === "otherExpenses"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Layers className="w-4 h-4" /> Other Expenses
              </button>
            )}

            {perms.banking !== "none" && (
              <button
                onClick={() => setActiveTab("banking")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeTab === "banking"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Landmark className="w-4 h-4" /> Banking
              </button>
            )}

            {currentUser.role === "admin" && (
              <button
                onClick={() => setActiveTab("settings")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeTab === "settings"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Settings className="w-4 h-4" /> Settings & Masters
              </button>
            )}
          </nav>
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[11px]">
              {currentUser.username ? currentUser.username.substring(0, 2).toUpperCase() : "AD"}
            </div>
            <div className="truncate flex-1">
              <p className="font-bold text-slate-800 text-[11px] leading-tight truncate">
                {currentUser.fullName || "Administrator"}
              </p>
              <p className="text-[10px] text-slate-400 capitalize">{currentUser.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Tally Port 9000
            </span>
            <span className="font-mono text-emerald-600 uppercase">Online</span>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {activeTab === "dashboard" && <DashboardModule activeClient={activeClient} />}
        {activeTab === "sales" && (
          <SalesModule 
            activeClient={activeClient} 
            salesPerms={currentUser?.salesSubPerms} 
            userRole={currentUser?.permissions?.sales} 
          />
        )}
        {activeTab === "purchases" && (
          <PurchaseModule 
            activeClient={activeClient} 
            purchasePerm={currentUser?.permissions?.purchases} 
          />
        )}
        {activeTab === "otherExpenses" && <OtherExpensesModule activeClient={activeClient} />}
        {activeTab === "banking" && <BankModule activeClient={activeClient} />}
        {activeTab === "settings" && (
          <SettingsModule
            activeClient={activeClient}
            setActiveClient={setActiveClient}
            onGoToDashboard={() => setActiveTab("dashboard")}
          />
        )}
      </main>
    </div>
  );
}
