const BACKEND_BASE = "https://compliance4-backend-1021821620394.asia-south1.run.app";

export const api = {
  // 1. Central Authentication
  async login(username, password) {
    const res = await fetch(`${BACKEND_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail || "Invalid credentials");
    }
    return await res.json();
  },

  // 2. Client Profiles
  async getClients() {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/clients`);
      if (!res.ok) throw new Error("Failed to load clients");
      return await res.json();
    } catch (err) {
      console.warn("Falling back to local profiles:", err);
      return JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
    }
  },

  async saveClientProfile(clientName, profile) {
    // Write to Firestore
    await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
    // Update local cache
    const local = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
    local[clientName] = profile;
    localStorage.setItem("c4_client_profiles", JSON.stringify(local));
  },

  async deleteClientProfile(clientName) {
    await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}`, {
      method: "DELETE"
    });
    const local = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
    delete local[clientName];
    localStorage.setItem("c4_client_profiles", JSON.stringify(local));
  },

  // 3. Chart of Accounts (COA)
  async getClientCoa(clientName) {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/coa`);
      if (!res.ok) throw new Error("Failed to fetch COA");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn("Falling back to local COA:", err);
      return JSON.parse(localStorage.getItem(`c4_coa_${clientName}`) || "[]");
    }
  },

  async saveClientCoa(clientName, ledgers) {
    await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/coa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ledgers })
    });
    localStorage.setItem(`c4_coa_${clientName}`, JSON.stringify(ledgers));
  },

  // 4. User Accounts
  async getUsers() {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/users`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return await res.json();
    } catch {
      return JSON.parse(localStorage.getItem("c4_user_accounts") || "[]");
    }
  },

  async saveUser(user) {
    await fetch(`${BACKEND_BASE}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user)
    });
    const localUsers = JSON.parse(localStorage.getItem("c4_user_accounts") || "[]");
    const updated = [user, ...localUsers.filter(u => u.username !== user.username)];
    localStorage.setItem("c4_user_accounts", JSON.stringify(updated));
  },

  async deleteUser(username) {
    await fetch(`${BACKEND_BASE}/api/users/${encodeURIComponent(username)}`, {
      method: "DELETE"
    });
    const localUsers = JSON.parse(localStorage.getItem("c4_user_accounts") || "[]");
    localStorage.setItem("c4_user_accounts", JSON.stringify(localUsers.filter(u => u.username !== username)));
  }
};
