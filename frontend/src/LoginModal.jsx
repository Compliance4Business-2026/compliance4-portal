import React, { useState } from "react";
import { Lock, User, ShieldCheck, AlertCircle } from "lucide-react";

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const cleanUser = username.trim().toLowerCase();

    // 1. Check Default Super Admin
    if (cleanUser === "admin" && password === "admin123") {
      const adminSession = {
        id: "super_admin",
        username: "admin",
        fullName: "Super Administrator",
        role: "admin",
        allowedClients: "ALL",
        permissions: {
          dashboard: "edit",
          sales: "edit",
          purchases: "edit",
          otherExpenses: "edit",
          banking: "edit",
          settings: "edit"
        }
      };
      localStorage.setItem("c4_auth_session", JSON.stringify(adminSession));
      onLoginSuccess(adminSession);
      return;
    }

    // 2. Check Custom Created Users
    try {
      const users = JSON.parse(localStorage.getItem("c4_user_accounts") || "[]");
      const matched = users.find(
        (u) => u.username.toLowerCase() === cleanUser && u.password === password
      );

      if (matched) {
        if (!matched.isActive) {
          setError("This user account has been deactivated by administrator.");
          return;
        }
        localStorage.setItem("c4_auth_session", JSON.stringify(matched));
        onLoginSuccess(matched);
        return;
      }
    } catch {
      // Fallback
    }

    setError("Invalid Username or Password. Try 'admin' / 'admin123'.");
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* LOGO & HEADING */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl mx-auto flex items-center justify-center font-black text-xl shadow-md">
            C4
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Compliance4 Portal</h2>
          <p className="text-xs text-slate-400">Sign in to manage client ledgers & compliance</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div>
            <label className="block font-bold text-slate-700 mb-1">User ID / Username</label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="e.g. admin or staff_pansuria"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition text-xs"
          >
            Authenticate & Open Workspace
          </button>
        </form>

        <div className="pt-2 text-center text-[11px] text-slate-400">
          Default Super Admin: <span className="font-mono font-bold text-slate-600">admin</span> / <span className="font-mono font-bold text-slate-600">admin123</span>
        </div>
      </div>
    </div>
  );
}
