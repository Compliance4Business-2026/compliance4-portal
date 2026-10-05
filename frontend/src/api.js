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
  // 2. Client Profiles (100% Cloud-Native)
  // ==========================================
  async getClients() {
    const res = await fetch(`${BACKEND_BASE}/api/clients`);
    if (!res.ok) throw new Error("Failed to fetch clients from cloud");
    return await res.json();
  },

  async saveClientProfile(clientName, profile) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
    if (!res.ok) throw new Error("Failed to save client profile to cloud");
    return await res.json();
  },

  async deleteClientProfile(clientName) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete client profile from cloud");
  },

  // ==========================================
  // 3. Chart of Accounts (COA - Cloud Only)
  // ==========================================
  async getClientCoa(clientName) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/coa`);
    if (!res.ok) throw new Error("Failed to fetch COA from cloud");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async saveClientCoa(clientName, ledgers) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/coa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ledgers })
    });
    if (!res.ok) throw new Error("Failed to save COA to cloud");
    return await res.json();
  },

  // ==========================================
  // 4. User Accounts (Cloud Only)
  // ==========================================
  async getUsers() {
    const res = await fetch(`${BACKEND_BASE}/api/users`);
    if (!res.ok) throw new Error("Failed to fetch users from cloud");
    return await res.json();
  },

  async saveUser(user) {
    const res = await fetch(`${BACKEND_BASE}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error("Failed to save user to cloud");
    return await res.json();
  },

  async deleteUser(username) {
    const res = await fetch(`${BACKEND_BASE}/api/users/${encodeURIComponent(username)}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete user from cloud");
  },

  // ==========================================
  // 5. Purchases Workflow & Gemini AI Extraction (Cloud Only)
  // ==========================================
  async getBills(clientName, stage = "needs_review") {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bills?stage=${stage}`);
    if (!res.ok) throw new Error(`Failed to fetch ${stage} bills from cloud`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async saveBill(clientName, stage, bill) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bills?stage=${stage}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bill)
    });
    if (!res.ok) throw new Error("Failed to save bill to cloud");
    return await res.json();
  },

  async deleteBill(clientName, stage, billId) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bills/${stage}/${billId}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete bill from cloud");
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
      const err = await res.json().catch(() => ({ detail: "Invoice extraction failed" }));
      throw new Error(err.detail || "Invoice extraction failed");
    }

    return await res.json();
  },

  // ==========================================
  // 6. Banking & Reconciliation Workflow (Cloud Only)
  // ==========================================
  async getBankTxns(clientName, status = "pending") {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bank-txns?status=${status}`);
    if (!res.ok) throw new Error("Failed to fetch bank transactions from cloud");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async saveBankTxns(clientName, status = "pending", transactions = []) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bank-txns?status=${status}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions })
    });
    if (!res.ok) throw new Error("Failed to save bank transactions to cloud");
    return await res.json();
  },

  async deleteBankTxn(clientName, status, txnId) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bank-txns/${status}/${txnId}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete bank transaction from cloud");
  },

  // ==========================================
  // 7. Sales & POS Workflow (Cloud Only)
  // ==========================================
  async getSales(clientName, status = "approved") {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/sales?status=${status}`);
    if (!res.ok) throw new Error("Failed to fetch sales records from cloud");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async saveSale(clientName, status = "approved", record = {}) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/sales?status=${status}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error("Failed to save sales record to cloud");
    return await res.json();
  },

  async deleteSale(clientName, status, recordId) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/sales/${status}/${recordId}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete sales record from cloud");
  },

  // ==========================================
  // 8. Other Expenses Workflow (Cloud Only)
  // ==========================================
  async getExpenses(clientName, status = "approved") {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/expenses?status=${status}`);
    if (!res.ok) throw new Error("Failed to fetch expense records from cloud");
    const data = await res.json();
    return Array.isArray(data) ? data.filter(item => item.status !== "VOID") : [];
  },

  async saveExpense(clientName, status = "approved", record = {}) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/expenses?status=${status}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error("Failed to save expense record to cloud");
    return await res.json();
  },

  async deleteExpense(clientName, status, recordId) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/expenses/${status}/${recordId}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete expense record from cloud");
  },

  async voidExpenseVoucher(clientName, expenseId, userEmail, reason) {
    const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/expenses/void/${expenseId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ performed_by: userEmail, reason: reason })
    });
    if (!res.ok) throw new Error("Failed to void expense voucher on cloud");
    return await res.json();
  },

  // ==========================================
  // 9. Dashboard & Financial Analytics Summary
  // ==========================================
  async getDashboardSummary(clientName) {
    const [bills, sales, bankTxns, expenses] = await Promise.all([
      this.getBills(clientName, "approved").catch(() => []),
      this.getSales(clientName, "approved").catch(() => []),
      this.getBankTxns(clientName, "reconciled").catch(() => []),
      this.getExpenses(clientName, "approved").catch(() => [])
    ]);

    const totalPurchases = bills.reduce((acc, b) => acc + (parseFloat(b.grand_total || b.taxable_amount) || 0), 0);
    const totalSales = sales.reduce((acc, s) => acc + (parseFloat(s.grandTotal || s.taxableAmount) || 0), 0);
    const totalExpenses = expenses
      .filter(e => e.status !== "VOID")
      .reduce((acc, e) => acc + (parseFloat(e.grandTotal || e.taxableAmount || e.amount) || 0), 0);
    
    const totalBankReceipts = bankTxns
      .filter(t => t.type === "Receipt")
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      
    const totalBankPayments = bankTxns
      .filter(t => t.type === "Payment")
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    return {
      totalPurchases,
      totalSales,
      totalExpenses,
      totalBankReceipts,
      totalBankPayments,
      netOperatingMargin: totalSales - (totalPurchases + totalExpenses)
    };
  }
};
