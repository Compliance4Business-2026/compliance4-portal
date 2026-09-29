const BACKEND_BASE = "https://compliance4-backend-1021821620394.asia-south1.run.app";

export const api = {
  // ==========================================
  // 1. Central Authentication
  // ==========================================
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

  // ==========================================
  // 2. Client Profiles
  // ==========================================
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
    await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
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

  // ==========================================
  // 3. Chart of Accounts (COA)
  // ==========================================
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

  // ==========================================
  // 4. User Accounts
  // ==========================================
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
  },

  // ==========================================
  // 5. Purchases Workflow & Gemini AI Extraction
  // ==========================================
  async getBills(clientName, stage = "needs_review") {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bills?stage=${stage}`);
      if (!res.ok) throw new Error("Failed to fetch bills");
      return await res.json();
    } catch (err) {
      console.warn(`Falling back to local storage for bills (${stage}):`, err);
      const cacheKey = `c4_bills_${clientName}_${stage}`;
      return JSON.parse(localStorage.getItem(cacheKey) || "[]");
    }
  },

  async saveBill(clientName, stage, bill) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bills?stage=${stage}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bill)
    });
    if (!res.ok) throw new Error("Failed to save bill to Firestore");
    return await res.json();
  },

  async deleteBill(clientName, stage, billId) {
    await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bills/${stage}/${billId}`, {
      method: "DELETE"
    });
  },

  async extractInvoice(file, companyName) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", companyName);

    const res = await fetch(`${BACKEND_BASE}/api/invoices/upload`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Extraction failed" }));
      throw new Error(err.detail || "Invoice extraction failed");
    }
    return await res.json();
  },

  // ==========================================
  // 6. Banking & Reconciliation Workflow
  // ==========================================
  async getBankTxns(clientName, status = "pending") {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bank-txns?status=${status}`);
      if (!res.ok) throw new Error("Failed to fetch bank transactions");
      return await res.json();
    } catch (err) {
      console.warn(`Falling back to local storage for bank transactions (${status}):`, err);
      const cacheKey = `c4_bank_txns_${clientName}_${status}`;
      return JSON.parse(localStorage.getItem(cacheKey) || "[]");
    }
  },

  async saveBankTxns(clientName, status = "pending", transactions = []) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bank-txns?status=${status}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions })
    });
    if (!res.ok) throw new Error("Failed to save bank transactions to Firestore");
    return await res.json();
  },

  async deleteBankTxn(clientName, status, txnId) {
    await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bank-txns/${status}/${txnId}`, {
      method: "DELETE"
    });
  },

  // ==========================================
  // 7. Sales & POS Workflow
  // ==========================================
  async getSales(clientName, status = "approved") {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/sales?status=${status}`);
      if (!res.ok) throw new Error("Failed to fetch sales records");
      return await res.json();
    } catch (err) {
      console.warn(`Falling back to local storage for sales (${status}):`, err);
      const cacheKey = `c4_sales_${clientName}_${status}`;
      return JSON.parse(localStorage.getItem(cacheKey) || "[]");
    }
  },

  async saveSale(clientName, status = "approved", record = {}) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/sales?status=${status}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error("Failed to save sales record to Firestore");
    return await res.json();
  },

  async deleteSale(clientName, status, recordId) {
    await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/sales/${status}/${recordId}`, {
      method: "DELETE"
    });
  },

  // ==========================================
  // 8. Other Expenses Workflow
  // ==========================================
  async getExpenses(clientName, status = "approved") {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/expenses?status=${status}`);
      if (!res.ok) throw new Error("Failed to fetch expense records");
      return await res.json();
    } catch (err) {
      console.warn(`Falling back to local storage for expenses (${status}):`, err);
      const cacheKey = `c4_other_expenses_${clientName}_${status}`;
      return JSON.parse(localStorage.getItem(cacheKey) || "[]");
    }
  },

  async saveExpense(clientName, status = "approved", record = {}) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/expenses?status=${status}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error("Failed to save expense record to Firestore");
    return await res.json();
  },

  async deleteExpense(clientName, status, recordId) {
    await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/expenses/${status}/${recordId}`, {
      method: "DELETE"
    });
  }
};
