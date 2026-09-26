import React, { useState } from "react";
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

export default function App() {
  const [activeTab, setActiveTab] = useState("sales"); // Set to sales to view immediately
  const [activeClient, setActiveClient] = useState("Panasuria Confectionery");

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

      {/* DYNAMIC MODULE VIEW */}
     <main className="flex-1 flex flex-col overflow-hidden">
  {activeTab === "purchase" && <PurchaseModule activeClient={activeClient} />}
  {activeTab === "bank" && <BankModule activeClient={activeClient} />}
  {activeTab === "sales" && <SalesModule activeClient={activeClient} />}
  {activeTab === "settings" && (
    <SettingsModule activeClient={activeClient} setActiveClient={setActiveClient} />
  )}
  {activeTab === "dashboard" && (
    <div className="flex-1 flex items-center justify-center text-slate-400">
      <p className="text-sm">Dashboard Overview Ready for Integration</p>
    </div>
  )}
</main>
    </div>
  );
}
