import React, { useState, useEffect } from "react";
import { 
  Building2, 
  FileText, 
  CreditCard, 
  TrendingUp, 
  Settings, 
  FileSpreadsheet 
} from "lucide-react";
import BankModule from "./BankModule";
import PurchaseModule from "./PurchaseModule";
import SalesModule from "./SalesModule";
import SettingsModule from "./SettingsModule";
import DashboardModule from "./DashboardModule";
import ExpenseModule from "./ExpenseModule";

export default function App() {
  const [activeTab, setActiveTab] = useState("sales");

  // Read available client profiles to populate client dropdown
  const [clientList, setClientList] = useState(() => {
    try {
      const saved = localStorage.getItem("c4_client_profiles");
      const parsed = saved ? Object.keys(JSON.parse(saved)) : [];
      return parsed.length > 0 ? parsed : ["Panasuria Confectionery"];
    } catch {
      return ["Panasuria Confectionery"];
    }
  });

  const [activeClient, setActiveClient] = useState(() => {
    return clientList[0] || "Panasuria Confectionery";
  });

  // Keep dropdown synchronized whenever profiles are added/deleted in Settings
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem("c4_client_profiles");
        const parsed = saved ? Object.keys(JSON.parse(saved)) : [];
        if (parsed.length > 0) {
          setClientList(parsed);
          if (!parsed.includes(activeClient)) {
            setActiveClient(parsed[0]);
          }
        }
      } catch {}
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [activeClient]);

  const handleClientSwitch = (newClientName) => {
    setActiveClient(newClientName);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 shadow-sm shrink-0">
        <div className="flex items-center gap-3 px-2 py-3 border-b border-slate-100">
          <div className="h-10 w-10 bg-[#0F172A] text-white rounded-lg flex items-center justify-center font-bold text-lg tracking-wider">
            C4
          </div>
          <div>
            <h1 className="font-semibold text-slate-900 leading-tight">Compliance4</h1>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Operations Hub</p>
          </div>
        </div>

        {/* POINT 1: ACTIVE CLIENT SCROLL / SELECT DROPDOWN */}
        <div className="my-5 px-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
            Active Client Entity
          </label>
          <div className="relative">
            <select
              value={activeClient}
              onChange={(e) => handleClientSwitch(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-300 hover:border-slate-400 p-2.5 pr-8 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer transition truncate"
            >
              {clientList.map((clientName) => (
                <option key={clientName} value={clientName}>
                  {clientName}
                </option>
              ))}
            </select>
            <Building2 className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "dashboard" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("purchase")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "purchase" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText className="w-4 h-4" />
            Purchases
          </button>
          <button
            onClick={() => setActiveTab("bank")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "bank" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Banking
          </button>
          <button
            onClick={() => setActiveTab("sales")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "sales" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Sales
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === "settings" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
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

      {/* DYNAMIC MODULE VIEW (KEYED BY CLIENT FOR INSTANT CLEAN ISOLATION) */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "purchase" && <PurchaseModule key={`purch_${activeClient}`} activeClient={activeClient} />}
        {activeTab === "bank" && <BankModule key={`bank_${activeClient}`} activeClient={activeClient} />}
        {activeTab === "sales" && <SalesModule key={`sales_${activeClient}`} activeClient={activeClient} />}
        {activeTab === "settings" && (
          <SettingsModule 
            activeClient={activeClient} 
            setActiveClient={(newClient) => {
              setActiveClient(newClient);
              const saved = localStorage.getItem("c4_client_profiles");
              const parsed = saved ? Object.keys(JSON.parse(saved)) : [];
              setClientList(parsed);
            }} 
          />
        )}
        {activeTab === "dashboard" && (
  <DashboardModule key={`dash_${activeClient}`} activeClient={activeClient} />
)}
      </main>
    </div>
  );
}
