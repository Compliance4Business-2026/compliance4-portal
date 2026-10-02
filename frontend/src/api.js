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
  // 2. Client Profiles (Smart Local/Cloud Merge)
  // ==========================================
  async getClients() {
    let cloudClients = {};
    try {
      const res = await fetch(`${BACKEND_BASE}/api/clients`);
      if (res.ok) {
        cloudClients = await res.json();
      }
    } catch (err) {
      console.warn("Cloud client fetch skipped, relying on local profiles:", err);
    }

    // Load local storage fallback profiles
    const localClients = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");

    // Merge both: Local profiles take precedence so newly added clients never vanish on refresh
    const mergedClients = { ...cloudClients, ...localClients };

    // Keep local storage synchronized
    localStorage.setItem("c4_client_profiles", JSON.stringify(mergedClients));

    return mergedClients;
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
    const cacheMap = {
      needs_review: `c4_pending_bills_${clientName}`,
      approved: `c4_approved_bills_${clientName}`,
      pushed: `c4_pushed_bills_${clientName}`
    };
    const cacheKey = cacheMap[stage] || `c4_pending_bills_${clientName}`;

    // Always pull from local storage first for instant, reliable rendering without CORS blocks
    const localData = JSON.parse(localStorage.getItem(cacheKey) || "[]");
    
    try {
      const res = await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bills?stage=${stage}`);
      if (res.ok) {
        const cloudData = await res.json();
        if (Array.isArray(cloudData) && cloudData.length > 0) {
          // Merge cloud and local to ensure nothing gets lost
          const merged = [...cloudData];
          localData.forEach(localItem => {
            if (!merged.some(m => m.id === localItem.id)) {
              merged.push(localItem);
            }
          });
          localStorage.setItem(cacheKey, JSON.stringify(merged));
          return merged;
        }
      }
    } catch (err) {
      console.warn(`Cloud fetch skipped, using local cache for bills (${stage}):`, err);
    }

    return localData;
  },

  async saveBill(clientName, stage, bill) {
    const cacheMap = {
      needs_review: `c4_pending_bills_${clientName}`,
      approved: `c4_approved_bills_${clientName}`,
      pushed: `c4_pushed_bills_${clientName}`
    };
    const cacheKey = cacheMap[stage] || `c4_pending_bills_${clientName}`;

    // 1. Commit to LocalStorage immediately (Guarantees it never disappears on refresh)
    try {
      const existing = JSON.parse(localStorage.getItem(cacheKey) || "[]");
      const cleanedBill = { ...bill, file_preview_url: "" }; // Strip heavy base64 to prevent quota errors
      const updated = [cleanedBill, ...existing.filter(b => b.id !== bill.id)];
      localStorage.setItem(cacheKey, JSON.stringify(updated));
    } catch (e) {
      console.error("Local bill cache write error:", e);
    }

    // 2. Attempt background cloud sync (Failures won't break your UI)
    try {
      await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bills?stage=${stage}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bill)
      });
    } catch (err) {
      console.warn("Cloud bill sync warning (saved securely in local storage):", err);
    }
    
    return bill;
  },

  async deleteBill(clientName, stage, billId) {
    const cacheMap = {
      needs_review: `c4_pending_bills_${clientName}`,
      approved: `c4_approved_bills_${clientName}`,
      pushed: `c4_pushed_bills_${clientName}`
    };
    const cacheKey = cacheMap[stage] || `c4_pending_bills_${clientName}`;

    try {
      const existing = JSON.parse(localStorage.getItem(cacheKey) || "[]");
      localStorage.setItem(cacheKey, JSON.stringify(existing.filter(b => b.id !== billId)));
    } catch (e) {
      console.error("Local bill cache delete error:", e);
    }

    try {
      await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/bills/${stage}/${billId}`, {
        method: "DELETE"
      });
    } catch (err) {
      console.warn("Cloud delete bill warning:", err);
    }
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
      const data = await res.json();
      // Filter out VOID entries locally if fetched
      return Array.isArray(data) ? data.filter(item => item.status !== "VOID") : [];
    } catch (err) {
      console.warn(`Falling back to local storage for expenses (${status}):`, err);
      const cacheKey = `c4_other_expenses_${clientName}_${status}`;
      const data = JSON.parse(localStorage.getItem(cacheKey) || "[]");
      return Array.isArray(data) ? data.filter(item => item.status !== "VOID") : [];
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
  },

  async voidExpenseVoucher(clientName, expenseId, userEmail, reason) {
    try {
      // Attempt backend call
      await fetch(`${BACKEND_BASE}/api/clients/${encodeURIComponent(clientName)}/expenses/void/${expenseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ performed_by: userEmail, reason: reason })
      });
    } catch (err) {
      console.warn("Backend void endpoint not active, cleaning local cache.");
    }

    // Clean up local storage caches so they don't reappear on refresh
    try {
      const pushedKey = `c4_other_expenses_pushed_${clientName}`;
      const approvedKey = `c4_other_expenses_${clientName}`;
      
      const pushedLocal = JSON.parse(localStorage.getItem(pushedKey) || "[]");
      const approvedLocal = JSON.parse(localStorage.getItem(approvedKey) || "[]");

      localStorage.setItem(pushedKey, JSON.stringify(pushedLocal.filter(e => e.id !== expenseId)));
      localStorage.setItem(approvedKey, JSON.stringify(approvedLocal.filter(e => e.id !== expenseId)));
    } catch (e) {
      console.error("Local cache cleanup error:", e);
    }

    return { success: true };
  },
  // ==========================================
  // 10. Dashboard & Financial Analytics Summary
  // ==========================================
  async getDashboardSummary(clientName) {
    try {
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
    } catch (err) {
      console.warn("Failed to compute dashboard analytics from cloud:", err);
      return {
        totalPurchases: 0,
        totalSales: 0,
        totalExpenses: 0,
        totalBankReceipts: 0,
        totalBankPayments: 0,
        netOperatingMargin: 0
      };
    }
  }
};
