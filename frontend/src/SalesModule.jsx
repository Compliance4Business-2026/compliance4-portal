import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Printer, 
  Send, 
  Download, 
  FileSpreadsheet, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Package, 
  Calendar, 
  FileText,
  Building2,
  X
} from "lucide-react";

export default function SalesModule({ activeClient = "Pansuria Confectionery & Food" }) {
  const [salesTab, setSalesTab] = useState("normal_sales"); // 'normal_sales' | 'pos_sales'
  const [normalSubTab, setNormalSubTab] = useState("register"); // 'create' | 'register'

  // Persistent Sales Invoices
  const [invoices, setInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_normal_sales_invoices_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persistent Customer Directory
  const [customers, setCustomers] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_customers_${activeClient}`);
      return saved ? JSON.parse(saved) : [
        {
          id: "cust_default_1",
          name: "Landcraft Retail Private Limited",
          gstin: "27AAFCL3867Q1ZD",
          address: "G-12, Commercial Hub, Mumbai",
          state: "Maharashtra",
          country: "India",
          phone: "9876543210",
          email: "billing@landcraft.com"
        }
      ];
    } catch {
      return [];
    }
  });

  // Persistent Product / Item Master
  const [products, setProducts] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_products_${activeClient}`);
      return saved ? JSON.parse(saved) : [
        { id: "prod_1", name: "Premium Artisan Bread", hsn: "1905", rate: 120, gstRate: 5, unit: "Pcs" },
        { id: "prod_2", name: "Choco Fudge Brownie 150g", hsn: "1905", rate: 85, gstRate: 18, unit: "Pcs" },
        { id: "prod_3", name: "Cold Brew Coffee Can", hsn: "2202", rate: 150, gstRate: 12, unit: "Can" }
      ];
    } catch {
      return [];
    }
  });

  // Client Profile (For Company details on Invoices)
  const clientProfile = useMemo(() => {
    try {
      const profiles = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
      return profiles[activeClient] || {
        companyName: activeClient,
        gstin: "24AAECP1234F1Z8",
        state: "Gujarat",
        address: "Ahmedabad, Gujarat"
      };
    } catch {
      return { companyName: activeClient, gstin: "", state: "Gujarat", address: "" };
    }
  }, [activeClient]);

  useEffect(() => {
    localStorage.setItem(`c4_normal_sales_invoices_${activeClient}`, JSON.stringify(invoices));
  }, [invoices, activeClient]);

  useEffect(() => {
    localStorage.setItem(`c4_customers_${activeClient}`, JSON.stringify(customers));
  }, [customers, activeClient]);

  useEffect(() => {
    localStorage.setItem(`c4_products_${activeClient}`, JSON.stringify(products));
  }, [products, activeClient]);

  const [notification, setNotification] = useState(null);
  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Modal Controls
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  // New Customer Form State
  const [newCust, setNewCust] = useState({
    name: "",
    gstin: "",
    address: "",
    state: "Gujarat",
    country: "India",
    phone: "",
    email: ""
  });

  // New Product Form State
  const [newProd, setNewProd] = useState({
    name: "",
    hsn: "",
    rate: 0,
    gstRate: 5,
    unit: "Pcs"
  });

  // Active Invoice Form State
  const getNextInvoiceNo = () => {
    const count = invoices.length + 1;
    return `INV/${new Date().getFullYear()}/${String(count).padStart(3, "0")}`;
  };

  const [activeInvoice, setActiveInvoice] = useState({
    invoiceNo: getNextInvoiceNo(),
    poNo: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    customerId: customers[0]?.id || "",
    customerName: customers[0]?.name || "",
    customerGstin: customers[0]?.gstin || "",
    customerAddress: customers[0]?.address || "",
    customerState: customers[0]?.state || "Gujarat",
    customerCountry: customers[0]?.country || "India",
    placeOfSupply: customers[0]?.state || "Gujarat",
    items: [
      {
        id: `item_${Date.now()}`,
        productId: products[0]?.id || "",
        name: products[0]?.name || "Item 1",
        hsn: products[0]?.hsn || "1905",
        qty: 1,
        unit: products[0]?.unit || "Pcs",
        rate: products[0]?.rate || 100,
        discount: 0,
        gstRate: products[0]?.gstRate || 5
      }
    ]
  });

  const selectCustomer = (cust) => {
    setActiveInvoice((prev) => ({
      ...prev,
      customerId: cust.id,
      customerName: cust.name,
      customerGstin: cust.gstin || "",
      customerAddress: cust.address || "",
      customerState: cust.state || "Gujarat",
      customerCountry: cust.country || "India",
      placeOfSupply: cust.state || "Gujarat"
    }));
  };

  // DUAL-SYNC: SAVE CUSTOMER TO CLIENT DIRECTORY AND CHART OF ACCOUNTS (SUNDRY DEBTORS)
  const handleSaveCustomerModal = () => {
    if (!newCust.name.trim()) {
      notify("Customer Name is required", "error");
      return;
    }

    const createdCustomer = { 
      ...newCust, 
      id: `cust_${Date.now()}` 
    };

    setCustomers((prev) => [createdCustomer, ...prev]);

    try {
      const rawCoa = localStorage.getItem(`c4_coa_${activeClient}`);
      const currentCoa = rawCoa ? JSON.parse(rawCoa) : [];

      const alreadyExists = currentCoa.some(
        (ledger) => ledger.name.trim().toLowerCase() === createdCustomer.name.trim().toLowerCase()
      );

      if (!alreadyExists) {
        const newDebtorLedger = {
          id: `coa_deb_${Date.now()}`,
          name: createdCustomer.name.trim(),
          statementType: "Balance Sheet",
          category: "Sundry Debtors",
          subCategory: createdCustomer.country === "India" ? "Domestic Debtors" : "Foreign / Export Debtors",
          balanceType: "Debit",
          gstin: createdCustomer.gstin || "",
          state: createdCustomer.state || ""
        };

        const updatedCoa = [...currentCoa, newDebtorLedger];
        localStorage.setItem(`c4_coa_${activeClient}`, JSON.stringify(updatedCoa));
      }
    } catch (err) {
      console.error("Failed to sync customer to COA:", err);
    }

    setShowAddCustomerModal(false);
    selectCustomer(createdCustomer);
    notify(`Customer "${createdCustomer.name}" created and synced to Sundry Debtors in COA!`, "success");

    setNewCust({
      name: "",
      gstin: "",
      address: "",
      state: "Gujarat",
      country: "India",
      phone: "",
      email: ""
    });
  };

  const handleSaveProductModal = () => {
    if (!newProd.name.trim()) {
      notify("Product Name is required", "error");
      return;
    }
    const created = { ...newProd, id: `prod_${Date.now()}` };
    setProducts((prev) => [created, ...prev]);
    setShowAddProductModal(false);
    notify(`Product "${created.name}" created!`, "success");
    setNewProd({ name: "", hsn: "", rate: 0, gstRate: 5, unit: "Pcs" });
  };

  // Add & Remove Line Items
  const handleAddItem = () => {
    const firstProd = products[0] || { id: "", name: "", hsn: "", rate: 0, gstRate: 5, unit: "Pcs" };
    setActiveInvoice((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `item_${Date.now()}`,
          productId: firstProd.id,
          name: firstProd.name,
          hsn: firstProd.hsn,
          qty: 1,
          unit: firstProd.unit,
          rate: firstProd.rate,
          discount: 0,
          gstRate: firstProd.gstRate
        }
      ]
    }));
  };

  const handleRemoveItem = (id) => {
    if (activeInvoice.items.length <= 1) return;
    setActiveInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id)
    }));
  };

  const handleItemChange = (id, field, value) => {
    setActiveInvoice((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === id) {
          if (field === "productId") {
            const p = products.find((prod) => prod.id === value);
            if (p) {
              return {
                ...item,
                productId: p.id,
                name: p.name,
                hsn: p.hsn,
                rate: p.rate,
                gstRate: p.gstRate,
                unit: p.unit
              };
            }
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    }));
  };

  // Invoice Mathematical Totals
  const totals = useMemo(() => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const isInterState = (activeInvoice.customerState || "").toLowerCase().trim() !== 
      (clientProfile.state || "Gujarat").toLowerCase().trim();

    activeInvoice.items.forEach((item) => {
      const q = parseFloat(item.qty) || 0;
      const r = parseFloat(item.rate) || 0;
      const d = parseFloat(item.discount) || 0;
      const base = Math.max(q * r - d, 0);
      taxable += base;

      const gst = parseFloat(item.gstRate) || 0;
      if (isInterState) {
        igst += (base * gst) / 100;
      } else {
        cgst += (base * (gst / 2)) / 100;
        sgst += (base * (gst / 2)) / 100;
      }
    });

    const subTotal = taxable + cgst + sgst + igst;
    const grandTotal = Math.round(subTotal);
    const roundOff = grandTotal - subTotal;

    return {
      taxableAmount: taxable.toFixed(2),
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      igst: igst.toFixed(2),
      roundOff: roundOff.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      isInterState
    };
  }, [activeInvoice, clientProfile]);

  const handleSaveInvoice = () => {
    if (!activeInvoice.customerName) {
      notify("Please select a customer", "error");
      return;
    }

    const newInv = {
      ...activeInvoice,
      ...totals,
      id: `inv_${Date.now()}`,
      createdAt: new Date().toISOString(),
      pushedToTally: false
    };

    setInvoices((prev) => [newInv, ...prev]);
    notify(`Invoice ${newInv.invoiceNo} saved successfully!`, "success");
    setNormalSubTab("register");

    // Reset Form
    setActiveInvoice((prev) => ({
      ...prev,
      invoiceNo: getNextInvoiceNo(),
      poNo: "",
      items: [
        {
          id: `item_${Date.now()}`,
          productId: products[0]?.id || "",
          name: products[0]?.name || "Item 1",
          hsn: products[0]?.hsn || "1905",
          qty: 1,
          unit: products[0]?.unit || "Pcs",
          rate: products[0]?.rate || 100,
          discount: 0,
          gstRate: products[0]?.gstRate || 5
        }
      ]
    }));
  };

  const handleDeleteInvoice = (id) => {
    if (!window.confirm("Are you sure you want to delete this invoice?")) return;
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    notify("Invoice deleted", "info");
  };

  // GENERATE TALLY XML ENVELOPE FOR SALES VOUCHER
  const generateSalesVoucherXml = (inv) => {
    const tallyDate = (inv.invoiceDate || "").replace(/[^0-9]/g, "") || "20260901";
    const isInterState = parseFloat(inv.igst || 0) > 0;

    return `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${activeClient}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${inv.invoiceNo}</VOUCHERNUMBER>
            <REFERENCE>${inv.poNo || inv.invoiceNo}</REFERENCE>
            <PARTYLEDGERNAME>${inv.customerName}</PARTYLEDGERNAME>
            <NARRATION>Tax Invoice ${inv.invoiceNo} [Compliance4 Generated]</NARRATION>

            <!-- DEBIT SUNDRY DEBTOR FOR FULL VALUE -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${inv.customerName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${parseFloat(inv.grandTotal).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- CREDIT SALES ACCOUNT -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${parseFloat(inv.taxableAmount).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            ${!isInterState ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${parseFloat(inv.cgst).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${parseFloat(inv.sgst).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            ` : `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output IGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${parseFloat(inv.igst).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            `}

            ${parseFloat(inv.roundOff) !== 0 ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Round Off</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${parseFloat(inv.roundOff) < 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
              <AMOUNT>${(parseFloat(inv.roundOff) * -1).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            ` : ""}

          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  };

  // 1. PUSH SINGLE SALES INVOICE TO TALLY
  const handlePushToTally = async (inv) => {
    const tallyXml = generateSalesVoucherXml(inv);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch("http://localhost:9000", {
        method: "POST",
        headers: { "Content-Type": "text/xml;charset=utf-8" },
        body: tallyXml,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error("Tally responded with non-200");

      setInvoices((prev) =>
        prev.map((i) => (i.id === inv.id ? { ...i, pushedToTally: true, pushed_at: new Date().toLocaleString() } : i))
      );
      notify(`Invoice ${inv.invoiceNo} pushed to Tally Prime successfully!`, "success");
    } catch {
      notify(
        "Could not connect to Tally Prime on Port 9000. Ensure Tally Prime is running with ODBC/XML enabled.",
        "error"
      );
    }
  };

  // 2. DOWNLOAD XML FILE
  const handleDownloadXml = (inv) => {
    const tallyXml = generateSalesVoucherXml(inv);
    const blob = new Blob([tallyXml], { type: "text/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Sales_Voucher_${inv.invoiceNo.replace(/[\/\\]/g, "_")}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Downloaded Tally XML for ${inv.invoiceNo}!`, "success");
  };

  // 3. EXCEL / CSV REGISTER DOWNLOAD
  const handleExportSalesExcel = () => {
    if (invoices.length === 0) {
      notify("No invoices available to export.", "error");
      return;
    }

    const headers = [
      "Invoice No",
      "Invoice Date",
      "PO Ref",
      "Customer Name",
      "Customer GSTIN",
      "Place of Supply",
      "Taxable Value (₹)",
      "CGST (₹)",
      "SGST (₹)",
      "IGST (₹)",
      "Round Off (₹)",
      "Invoice Total (₹)",
      "Pushed to Tally",
      "Pushed Timestamp"
    ];

    const rows = invoices.map((inv) => [
      `"${inv.invoiceNo || ""}"`,
      `"${inv.invoiceDate || ""}"`,
      `"${inv.poNo || "-"}"`,
      `"${(inv.customerName || "").replace(/"/g, '""')}"`,
      `"${inv.customerGstin || "-"}"`,
      `"${inv.placeOfSupply || "Gujarat"}"`,
      Number(inv.taxableAmount || 0).toFixed(2),
      Number(inv.cgst || 0).toFixed(2),
      Number(inv.sgst || 0).toFixed(2),
      Number(inv.igst || 0).toFixed(2),
      Number(inv.roundOff || 0).toFixed(2),
      Number(inv.grandTotal || 0).toFixed(2),
      inv.pushedToTally ? "Yes" : "No",
      `"${inv.pushed_at || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Sales_Register_${activeClient.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Exported ${invoices.length} sales invoices to Excel CSV!`, "success");
  };

  // Print Invoice Representation
  const handlePrintInvoice = (inv) => {
    const printWindow = window.open("", "_blank");
    const isInterState = parseFloat(inv.igst || 0) > 0;

    printWindow.document.write(`
      <html>
        <head>
          <title>Tax Invoice - ${inv.invoiceNo}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
            .meta { font-size: 12px; color: #64748b; line-height: 1.5; }
            .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; font-size: 12px; }
            .party-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
            th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 700; border-bottom: 1px solid #cbd5e1; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            .text-right { text-align: right; }
            .totals { width: 300px; margin-left: auto; font-size: 12px; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
            .grand-total { font-size: 16px; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; padding: 10px 0; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">TAX INVOICE</h1>
              <div class="meta" style="margin-top: 8px;">
                <strong>Invoice No:</strong> ${inv.invoiceNo}<br/>
                <strong>Date:</strong> ${inv.invoiceDate}<br/>
                <strong>PO No:</strong> ${inv.poNo || "-"}
              </div>
            </div>
            <div class="text-right meta">
              <strong style="font-size: 14px; color: #0f172a;">${clientProfile.companyName}</strong><br/>
              ${clientProfile.address || "Main Commercial Street"}<br/>
              <strong>GSTIN:</strong> ${clientProfile.gstin || "24AAECP1234F1Z8"}<br/>
              <strong>State:</strong> ${clientProfile.state || "Gujarat"}
            </div>
          </div>

          <div class="parties">
            <div class="party-box">
              <strong style="color: #64748b; font-size: 10px; text-transform: uppercase;">Billed To (Customer):</strong>
              <div style="font-size: 14px; font-weight: bold; margin: 4px 0 6px;">${inv.customerName}</div>
              ${inv.customerAddress || ""}<br/>
              <strong>GSTIN:</strong> ${inv.customerGstin || "Unregistered"}<br/>
              <strong>Place of Supply:</strong> ${inv.placeOfSupply || "Gujarat"}
            </div>
            <div class="party-box">
              <strong style="color: #64748b; font-size: 10px; text-transform: uppercase;">Payment Settlement:</strong><br/>
              Bank: Current Account<br/>
              Terms: 100% Against Delivery<br/>
              Compliance4 Verified Tax Document
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item Description</th>
                <th>HSN</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Rate (₹)</th>
                <th class="text-right">GST %</th>
                <th class="text-right">Taxable Amt (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${(inv.items || []).map((it, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${it.name}</strong></td>
                  <td>${it.hsn || "-"}</td>
                  <td class="text-right">${it.qty} ${it.unit || ""}</td>
                  <td class="text-right">₹${Number(it.rate).toFixed(2)}</td>
                  <td class="text-right">${it.gstRate}%</td>
                  <td class="text-right">₹${(Number(it.qty) * Number(it.rate) - Number(it.discount || 0)).toFixed(2)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span>Taxable Value:</span>
              <strong>₹${Number(inv.taxableAmount).toFixed(2)}</strong>
            </div>
            ${!isInterState ? `
              <div class="totals-row">
                <span>Output CGST:</span>
                <span>₹${Number(inv.cgst).toFixed(2)}</span>
              </div>
              <div class="totals-row">
                <span>Output SGST:</span>
                <span>₹${Number(inv.sgst).toFixed(2)}</span>
              </div>
            ` : `
              <div class="totals-row">
                <span>Output IGST:</span>
                <span>₹${Number(inv.igst).toFixed(2)}</span>
              </div>
            `}
            ${parseFloat(inv.roundOff) !== 0 ? `
              <div class="totals-row">
                <span>Round Off:</span>
                <span>₹${Number(inv.roundOff).toFixed(2)}</span>
              </div>
            ` : ""}
            <div class="totals-row grand-total">
              <span>Grand Total:</span>
              <span>₹${Number(inv.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden font-sans">
      {/* MODULE HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-xs shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sales & Revenue Center</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{activeClient}</p>
        </div>

        {/* TOP TAB SWITCHER & GLOBAL EXPORT */}
        <div className="flex items-center gap-3">
          {normalSubTab === "register" && invoices.length > 0 && (
            <button
              onClick={handleExportSalesExcel}
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3 py-2 rounded-lg transition"
              title="Download Excel / CSV Sales Register"
            >
              <Download className="w-3.5 h-3.5" /> Export Register (Excel)
            </button>
          )}

          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setSalesTab("normal_sales")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                salesTab === "normal_sales" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Normal Sales Invoices (B2B)
            </button>

            <button
              onClick={() => setSalesTab("pos_sales")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                salesTab === "pos_sales" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> POS-Based Sales (Consolidated)
            </button>
          </div>
        </div>
      </header>

      {/* SUB-NAVIGATION BAR FOR NORMAL SALES */}
      {salesTab === "normal_sales" && (
        <div className="px-8 pt-3 pb-0 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setNormalSubTab("create")}
              className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                normalSubTab === "create" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Plus className="w-4 h-4" /> Create New Invoice
            </button>

            <button
              onClick={() => setNormalSubTab("register")}
              className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                normalSubTab === "register" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <FileText className="w-4 h-4" /> Invoice Register
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900 text-white font-mono">
                {invoices.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
            >
              <Users className="w-3.5 h-3.5" /> + New Customer
            </button>

            <button
              onClick={() => setShowAddProductModal(true)}
              className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
            >
              <Package className="w-3.5 h-3.5" /> + New Product
            </button>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <div className="flex-1 overflow-y-auto p-8">
        {salesTab === "normal_sales" && normalSubTab === "create" && (
          <div className="max-w-5xl mx-auto bg-white rounded-xl border border-slate-200 shadow-xs p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Tax Invoice Generator</h3>
                <p className="text-xs text-slate-400 mt-0.5">Compliant with GST e-Invoicing & Schedule III</p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Invoice No</label>
                  <input
                    type="text"
                    value={activeInvoice.invoiceNo}
                    onChange={(e) => setActiveInvoice({ ...activeInvoice, invoiceNo: e.target.value })}
                    className="font-mono text-xs font-bold border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Invoice Date</label>
                  <input
                    type="date"
                    value={activeInvoice.invoiceDate}
                    onChange={(e) => setActiveInvoice({ ...activeInvoice, invoiceDate: e.target.value })}
                    className="font-mono text-xs font-bold border border-slate-300 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* CUSTOMER SELECTION BAR */}
            <div className="grid grid-cols-3 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Customer</label>
                <select
                  value={activeInvoice.customerId}
                  onChange={(e) => {
                    const c = customers.find((cust) => cust.id === e.target.value);
                    if (c) selectCustomer(c);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer GSTIN</label>
                <input
                  type="text"
                  value={activeInvoice.customerGstin}
                  readOnly
                  placeholder="Unregistered"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Place of Supply (State)</label>
                <input
                  type="text"
                  value={activeInvoice.placeOfSupply}
                  onChange={(e) => setActiveInvoice({ ...activeInvoice, placeOfSupply: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                />
              </div>
            </div>

            {/* LINE ITEMS TABLE */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold uppercase text-slate-500 text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 w-12">#</th>
                    <th className="py-2.5 px-4 w-72">Item / Product Name</th>
                    <th className="py-2.5 px-4 w-28">HSN Code</th>
                    <th className="py-2.5 px-4 w-24 text-right">Qty</th>
                    <th className="py-2.5 px-4 w-28 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-4 w-24 text-center">GST %</th>
                    <th className="py-2.5 px-4 text-right">Taxable (₹)</th>
                    <th className="py-2.5 px-4 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {activeInvoice.items.map((item, idx) => {
                    const q = parseFloat(item.qty) || 0;
                    const r = parseFloat(item.rate) || 0;
                    const d = parseFloat(item.discount) || 0;
                    const base = Math.max(q * r - d, 0);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-4">
                          <select
                            value={item.productId}
                            onChange={(e) => handleItemChange(item.id, "productId", e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded p-1.5 font-bold text-slate-800"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            value={item.hsn}
                            onChange={(e) => handleItemChange(item.id, "hsn", e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded p-1.5 font-mono text-center text-slate-700"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleItemChange(item.id, "qty", e.target.value)}
                            className="w-20 bg-white border border-slate-300 rounded p-1.5 text-right font-bold text-slate-900"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => handleItemChange(item.id, "rate", e.target.value)}
                            className="w-24 bg-white border border-slate-300 rounded p-1.5 text-right font-mono font-bold text-slate-900"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <select
                            value={item.gstRate}
                            onChange={(e) => handleItemChange(item.id, "gstRate", e.target.value)}
                            className="bg-white border border-slate-300 rounded p-1.5 font-bold text-slate-700"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{base.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-slate-300 hover:text-rose-600 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="p-3 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 bg-white transition shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" /> + Add Another Item
                </button>
              </div>
            </div>

            {/* TOTALS SUMMARY */}
            <div className="flex justify-end pt-2">
              <div className="w-80 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Total Taxable Amount:</span>
                  <span className="font-mono font-bold text-slate-900">₹{totals.taxableAmount}</span>
                </div>

                {!totals.isInterState ? (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST (Intra-State):</span>
                      <span className="font-mono font-bold text-slate-900">₹{totals.cgst}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST (Intra-State):</span>
                      <span className="font-mono font-bold text-slate-900">₹{totals.sgst}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-600">
                    <span>IGST (Inter-State):</span>
                    <span className="font-mono font-bold text-indigo-700">₹{totals.igst}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Round Off:</span>
                  <span className="font-mono font-semibold">₹{totals.roundOff}</span>
                </div>

                <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-slate-200 text-slate-900">
                  <span>Grand Total (₹):</span>
                  <span className="font-mono text-base text-emerald-700">₹{totals.grandTotal}</span>
                </div>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setNormalSubTab("register")}
                className="px-5 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInvoice}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                <Check className="w-4 h-4" /> Save Invoice & Generate Document
              </button>
            </div>
          </div>
        )}

        {/* INVOICE REGISTER TABLE (RESTORED COMPLETE WITH PUSH TO TALLY & DOWNLOAD XML) */}
        {salesTab === "normal_sales" && normalSubTab === "register" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Sales Invoice Register ({invoices.length})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Direct B2B Tax Invoices with integrated Tally Prime dispatch & XML generation
                </p>
              </div>

              {invoices.length > 0 && (
                <button
                  onClick={handleExportSalesExcel}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                >
                  <Download className="w-3.5 h-3.5" /> Export Excel / CSV
                </button>
              )}
            </div>

            {invoices.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-xs">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                No sales invoices created yet. Click "Create New Invoice" to issue your first B2B invoice.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Invoice No & Type</th>
                    <th className="py-3 px-4">PO No.</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer Name & GSTIN</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 text-right">Taxable (₹)</th>
                    <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900 font-mono">{inv.invoiceNo}</p>
                        <span className="text-[10px] text-slate-400">Tax Invoice</span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500">{inv.poNo || "-"}</td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-600">{inv.invoiceDate}</td>

                      <td className="py-3 px-4 max-w-xs">
                        <p className="font-bold text-slate-900 truncate">{inv.customerName}</p>
                        <p className="font-mono text-[10px] text-slate-400">{inv.customerGstin || "Unregistered"}</p>
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                        {inv.items?.length || 1}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        ₹{Number(inv.taxableAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-700">
                        ₹{Number(inv.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {inv.pushedToTally ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> In Tally
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* COMPLETE RESTORED ACTION SUITE */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* 1. PRINT / PDF BUTTON */}
                          <button
                            onClick={() => handlePrintInvoice(inv)}
                            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] px-2.5 py-1 rounded transition"
                            title="Print / PDF Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" /> Print / PDF
                          </button>

                          {/* 2. PUSH TO TALLY BUTTON */}
                          <button
                            onClick={() => handlePushToTally(inv)}
                            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] px-2.5 py-1 rounded transition shadow-2xs"
                            title="Push directly to Tally Prime on Port 9000"
                          >
                            <Send className="w-3 h-3" /> Push
                          </button>

                          {/* 3. DOWNLOAD TALLY XML BUTTON */}
                          <button
                            onClick={() => handleDownloadXml(inv)}
                            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-[11px] px-2.5 py-1 rounded transition shadow-2xs"
                            title="Download Tally Sales XML Envelope"
                          >
                            <Download className="w-3 h-3" /> XML
                          </button>

                          {/* 4. DELETE BUTTON */}
                          <button
                            onClick={() => handleDeleteInvoice(inv.id)}
                            className="p-1 text-slate-300 hover:text-rose-600 rounded transition"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* POS CONSOLIDATED SALES TAB */}
        {salesTab === "pos_sales" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-16 text-center text-slate-400 text-xs">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">POS Sales Consolidation Hub</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Import and consolidate daily aggregator payouts, dine-in journals, and delivery fees directly into Tally Prime.
            </p>
          </div>
        )}
      </div>

      {/* NEW CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700" /> Add New Customer
              </h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Trade Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Landcraft Retail Private Limited"
                  value={newCust.name}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN</label>
                <input
                  type="text"
                  placeholder="24ABCDE1234F1Z5"
                  value={newCust.gstin}
                  onChange={(e) => setNewCust({ ...newCust, gstin: e.target.value.toUpperCase() })}
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Billing State</label>
                <input
                  type="text"
                  value={newCust.state}
                  onChange={(e) => setNewCust({ ...newCust, state: e.target.value })}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Complete Address</label>
                <input
                  type="text"
                  placeholder="Office, City, Pincode"
                  value={newCust.address}
                  onChange={(e) => setNewCust({ ...newCust, address: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomerModal}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                Save & Map to Sundry Debtors
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW PRODUCT MODAL */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-700" /> Add New Item / Product
              </h3>
              <button onClick={() => setShowAddProductModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Sourdough Baguette"
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    placeholder="1905"
                    value={newProd.hsn}
                    onChange={(e) => setNewProd({ ...newProd, hsn: e.target.value })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    placeholder="Pcs / Box / Kg"
                    value={newProd.unit}
                    onChange={(e) => setNewProd({ ...newProd, unit: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Default Rate (₹)</label>
                  <input
                    type="number"
                    value={newProd.rate}
                    onChange={(e) => setNewProd({ ...newProd, rate: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GST Rate %</label>
                  <select
                    value={newProd.gstRate}
                    onChange={(e) => setNewProd({ ...newProd, gstRate: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-bold"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddProductModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProductModal}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
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
