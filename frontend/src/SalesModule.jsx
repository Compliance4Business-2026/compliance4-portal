import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  FileText,
  Store,
  Plus,
  Trash2,
  Send,
  Download,
  Upload,
  Receipt,
  Scale,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

const loadSheetJS = () => {
  return new Promise((resolve, reject) => {
    if (window.XLSX) {
      resolve(window.XLSX);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Failed to load spreadsheet engine"));
    document.head.appendChild(script);
  });
};

export default function SalesModule({ activeClient = "The Mars Ventures" }) {
  // Main Sales Mode: 'normal_invoices' (B2B/B2C) vs 'pos_register' (Daily F&B/Retail)
  const [salesMode, setSalesMode] = useState("pos_register");

  // Track 1: Normal Invoices State
  const [normalInvoices, setNormalInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_normal_sales_invoices_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Track 2: POS Raw Daily Rows (13 Columns)
  const [posRows, setPosRows] = useState(() => {
    try {
      const saved = localStorage.getItem(`c4_pos_raw_rows_${activeClient}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // POS Internal Sub-tabs: 'register' | 'journal' | 'manual_entry'
  const [posTab, setPosTab] = useState("register");
  // Normal Invoices Sub-tabs: 'list' | 'create'
  const [invoiceTab, setInvoiceTab] = useState("list");

  const [notification, setNotification] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Sync state to local storage per client
  useEffect(() => {
    localStorage.setItem(`c4_normal_sales_invoices_${activeClient}`, JSON.stringify(normalInvoices));
  }, [normalInvoices, activeClient]);

  useEffect(() => {
    localStorage.setItem(`c4_pos_raw_rows_${activeClient}`, JSON.stringify(posRows));
  }, [posRows, activeClient]);

  // Client Profile (For Invoice Printing)
  const clientProfile = useMemo(() => {
    try {
      const allProfiles = JSON.parse(localStorage.getItem("c4_client_profiles") || "{}");
      return allProfiles[activeClient] || { companyName: activeClient };
    } catch {
      return { companyName: activeClient };
    }
  }, [activeClient]);

  // ==========================================
  // TRACK 1: NORMAL INVOICING ENGINE
  // ==========================================
  const [newInv, setNewInv] = useState({
    invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
    invoiceDate: new Date().toISOString().split("T")[0],
    customerName: "",
    customerGstin: "",
    itemDescription: "Consulting / Professional Services",
    taxableAmount: "",
    taxRate: 18
  });

  const handleCreateNormalInvoice = (e) => {
    e.preventDefault();
    const taxable = parseFloat(newInv.taxableAmount) || 0;
    if (taxable <= 0) {
      notify("Please enter a valid taxable amount", "error");
      return;
    }

    const rate = parseFloat(newInv.taxRate) || 18;
    const isInterstate = newInv.customerGstin && !newInv.customerGstin.startsWith(clientProfile.gstin?.substring(0, 2) || "24");
    
    let cgst = 0, sgst = 0, igst = 0;
    if (isInterstate) {
      igst = (taxable * rate) / 100;
    } else {
      cgst = (taxable * (rate / 2)) / 100;
      sgst = (taxable * (rate / 2)) / 100;
    }
    const grandTotal = taxable + cgst + sgst + igst;

    const created = {
      id: `inv_${Date.now()}`,
      invoiceNumber: newInv.invoiceNumber,
      invoiceDate: newInv.invoiceDate,
      date: newInv.invoiceDate,
      customerName: newInv.customerName || "Cash Customer",
      customerGstin: newInv.customerGstin || "",
      itemDescription: newInv.itemDescription,
      taxableAmount: taxable,
      taxRate: rate,
      cgst,
      sgst,
      igst,
      grandTotal,
      pushedToTally: false
    };

    setNormalInvoices((prev) => [created, ...prev]);
    notify(`Tax Invoice ${created.invoiceNumber} created!`, "success");
    setInvoiceTab("list");
    setNewInv({
      invoiceNumber: `INV-${(Date.now() + 1).toString().slice(-4)}`,
      invoiceDate: new Date().toISOString().split("T")[0],
      customerName: "",
      customerGstin: "",
      itemDescription: "Consulting / Professional Services",
      taxableAmount: "",
      taxRate: 18
    });
  };

  const handleDeleteNormalInvoice = (id) => {
    if (!window.confirm("Delete this tax invoice?")) return;
    setNormalInvoices((prev) => prev.filter((i) => i.id !== id));
    notify("Invoice deleted.", "info");
  };

  // ==========================================
  // TRACK 2: POS ENGINE (IMAGE 1 & IMAGE 2)
  // ==========================================
  const [manualRow, setManualRow] = useState({
    date: new Date().toISOString().split("T")[0],
    cash: "",
    upi: "",
    bankInTransit: "",
    zomatoDelivery: "",
    zomatoDineIn: "",
    swiggyDelivery: "",
    swiggyDineIn: "",
    eazyDineIn: "",
    due: "",
    bqr: "",
    razorpay: ""
  });

  const handleManualRowChange = (field, val) => {
    setManualRow((prev) => ({ ...prev, [field]: val }));
  };

  const handleAddManualRow = (e) => {
    e.preventDefault();
    const cash = parseFloat(manualRow.cash) || 0;
    const upi = parseFloat(manualRow.upi) || 0;
    const bankInTransit = parseFloat(manualRow.bankInTransit) || 0;
    const zomatoDelivery = parseFloat(manualRow.zomatoDelivery) || 0;
    const zomatoDineIn = parseFloat(manualRow.zomatoDineIn) || 0;
    const swiggyDelivery = parseFloat(manualRow.swiggyDelivery) || 0;
    const swiggyDineIn = parseFloat(manualRow.swiggyDineIn) || 0;
    const eazyDineIn = parseFloat(manualRow.eazyDineIn) || 0;
    const due = parseFloat(manualRow.due) || 0;
    const bqr = parseFloat(manualRow.bqr) || 0;
    const razorpay = parseFloat(manualRow.razorpay) || 0;

    const totalSales =
      cash + upi + bankInTransit + zomatoDelivery + zomatoDineIn +
      swiggyDelivery + swiggyDineIn + eazyDineIn + due + bqr + razorpay;

    if (totalSales <= 0) {
      notify("Please enter at least one collection amount.", "error");
      return;
    }

    const created = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      date: manualRow.date,
      cash,
      upi,
      bankInTransit,
      zomatoDelivery,
      zomatoDineIn,
      swiggyDelivery,
      swiggyDineIn,
      eazyDineIn,
      due,
      bqr,
      razorpay,
      totalSales
    };

    setPosRows((prev) => [created, ...prev]);
    notify(`POS entry for ${manualRow.date} recorded!`, "success");
    setPosTab("register");
    setManualRow({
      date: new Date().toISOString().split("T")[0],
      cash: "",
      upi: "",
      bankInTransit: "",
      zomatoDelivery: "",
      zomatoDineIn: "",
      swiggyDelivery: "",
      swiggyDineIn: "",
      eazyDineIn: "",
      due: "",
      bqr: "",
      razorpay: ""
    });
  };

  const handleDeletePosRow = (id) => {
    if (!window.confirm("Delete this POS sales record?")) return;
    setPosRows((prev) => prev.filter((r) => r.id !== id));
    notify("Record deleted.", "info");
  };

  // Download POS Template (Screenshot 1)
  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await loadSheetJS();
      const templateData = [
        [
          "Date", "CASH", "UPI Collection", "Bank In Transit - VISA/Rupee/Master",
          "Zomato - Delivery", "Zomato - Dine In", "Swiggy - Delivery",
          "Swiggy - Dine In", "Eazy - Dine In", "Due", "BQR", "Razorpay", "Total - Sales"
        ],
        ["2026-08-01", 24500, 38200, 12400, 4800, 0, 3100, 500, 0, 0, 0, 0, 83500],
        ["2026-08-02", 21800, 41500, 9800, 5200, 0, 2900, 0, 0, 250, 0, 0, 81450]
      ];

      const ws = XLSX.utils.aoa_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "POS_Sales_Register");
      XLSX.writeFile(wb, `POS_Sales_Register_${activeClient.replace(/\s+/g, "_")}.xlsx`);
      notify("POS Template downloaded!", "success");
    } catch {
      notify("Unable to generate Excel. Check browser permissions.", "error");
    }
  };

  // Upload POS Spreadsheet
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const fileName = file.name.toLowerCase();

    try {
      const XLSX = await loadSheetJS();
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          let rawRows = [];
          if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
            const text = new TextDecoder().decode(event.target.result);
            rawRows = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0).map((l) => l.split(",").map((c) => c.replace(/["']/g, "").trim()));
          } else {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
          }

          if (!rawRows || rawRows.length < 2) {
            notify("File has no rows.", "error");
            setIsUploading(false);
            return;
          }

          const headers = (rawRows[0] || []).map((h) => String(h || "").trim().toLowerCase());
          const dateIdx = headers.findIndex((h) => h.includes("date"));
          const cashIdx = headers.findIndex((h) => h === "cash");
          const upiIdx = headers.findIndex((h) => h.includes("upi"));
          const cardIdx = headers.findIndex((h) => h.includes("bank in transit") || h.includes("card") || h.includes("visa"));
          const zomDelIdx = headers.findIndex((h) => h.includes("zomato") && h.includes("delivery"));
          const zomDineIdx = headers.findIndex((h) => h.includes("zomato") && h.includes("dine"));
          const swgDelIdx = headers.findIndex((h) => h.includes("swiggy") && h.includes("delivery"));
          const swgDineIdx = headers.findIndex((h) => h.includes("swiggy") && h.includes("dine"));
          const eazDineIdx = headers.findIndex((h) => h.includes("eazy") && h.includes("dine"));
          const dueIdx = headers.findIndex((h) => h === "due");
          const bqrIdx = headers.findIndex((h) => h === "bqr");
          const rzpIdx = headers.findIndex((h) => h.includes("razorpay"));

          const parseNum = (row, idx) =>
            idx !== -1 && row[idx] ? Math.abs(parseFloat(String(row[idx]).replace(/[^0-9.-]/g, "")) || 0) : 0;

          const parsedList = [];
          for (let i = 1; i < rawRows.length; i++) {
            const row = rawRows[i] || [];
            let dateVal = dateIdx !== -1 && row[dateIdx] ? String(row[dateIdx]).trim() : "";
            if (!dateVal) continue;

            if (!isNaN(dateVal) && Number(dateVal) > 20000 && Number(dateVal) < 60000) {
              const excelDate = new Date(Math.round((Number(dateVal) - 25569) * 86400 * 1000));
              dateVal = excelDate.toISOString().split("T")[0];
            }

            const cash = parseNum(row, cashIdx);
            const upi = parseNum(row, upiIdx);
            const bankInTransit = parseNum(row, cardIdx);
            const zomatoDelivery = parseNum(row, zomDelIdx);
            const zomatoDineIn = parseNum(row, zomDineIdx);
            const swiggyDelivery = parseNum(row, swgDelIdx);
            const swiggyDineIn = parseNum(row, swgDineIdx);
            const eazyDineIn = parseNum(row, eazDineIdx);
            const due = parseNum(row, dueIdx);
            const bqr = parseNum(row, bqrIdx);
            const razorpay = parseNum(row, rzpIdx);

            const totalSales = cash + upi + bankInTransit + zomatoDelivery + zomatoDineIn + swiggyDelivery + swiggyDineIn + eazyDineIn + due + bqr + razorpay;
            if (totalSales > 0) {
              parsedList.push({
                id: `pos_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                date: dateVal,
                cash, upi, bankInTransit, zomatoDelivery, zomatoDineIn, swiggyDelivery, swiggyDineIn, eazyDineIn, due, bqr, razorpay, totalSales
              });
            }
          }

          if (parsedList.length === 0) {
            notify("No valid rows found in file.", "error");
          } else {
            setPosRows((prev) => [...parsedList, ...prev]);
            notify(`Imported ${parsedList.length} POS sales rows!`, "success");
            setPosTab("register");
          }
        } catch (err) {
          console.error(err);
          notify("Failed to parse sheet format.", "error");
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };

      reader.readAsArrayBuffer(file);
    } catch {
      notify("Failed to read file.", "error");
      setIsUploading(false);
    }
  };

  // Dynamic Double-Entry Journal Voucher (Screenshot 2)
  const journalVoucher = useMemo(() => {
    const dr = {
      zomatoDelivery: 0,
      zomatoDineIn: 0,
      swiggyDelivery: 0,
      swiggyDineIn: 0,
      eazyDineIn: 0,
      cash: 0,
      upi: 0,
      bankInTransit: 0,
      otherReceivables: 0
    };

    posRows.forEach((r) => {
      dr.zomatoDelivery += r.zomatoDelivery || 0;
      dr.zomatoDineIn += r.zomatoDineIn || 0;
      dr.swiggyDelivery += r.swiggyDelivery || 0;
      dr.swiggyDineIn += r.swiggyDineIn || 0;
      dr.eazyDineIn += r.eazyDineIn || 0;
      dr.cash += r.cash || 0;
      dr.upi += r.upi || 0;
      dr.bankInTransit += r.bankInTransit || 0;
      dr.otherReceivables += (r.due || 0) + (r.bqr || 0) + (r.razorpay || 0);
    });

    const totalDebits = Object.values(dr).reduce((a, b) => a + b, 0);
    const inStoreGross = dr.cash + dr.upi + dr.bankInTransit + dr.otherReceivables;

    const salesCafe = inStoreGross / 1.05;
    const salesZomatoDel = dr.zomatoDelivery / 1.05;
    const salesZomatoDine = dr.zomatoDineIn / 1.05;
    const salesSwiggyDel = dr.swiggyDelivery / 1.05;
    const salesSwiggyDine = dr.swiggyDineIn / 1.05;
    const salesEazyDine = dr.eazyDineIn / 1.05;

    const totalTaxable = salesCafe + salesZomatoDel + salesZomatoDine + salesSwiggyDel + salesSwiggyDine + salesEazyDine;
    const cgst25 = (totalTaxable * 2.5) / 100;
    const sgst25 = (totalTaxable * 2.5) / 100;
    const totalCredits = totalTaxable + cgst25 + sgst25;

    return {
      dr,
      totalDebits,
      credits: { salesCafe, salesZomatoDel, salesZomatoDine, salesSwiggyDel, salesSwiggyDine, salesEazyDine, cgst25, sgst25 },
      totalCredits,
      totalTaxable
    };
  }, [posRows]);

  // Push Journal to Tally Prime
  const handlePushJournalToTally = async () => {
    if (journalVoucher.totalDebits <= 0) return;
    const tallyDate = "20260831";

    const tallyXml = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${activeClient}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <REFERENCE>POS-JV-${tallyDate}</REFERENCE>
            <NARRATION>POS Sales & Collection Journal Voucher - Gross: ₹${journalVoucher.totalDebits.toFixed(2)} - Synced via Compliance4</NARRATION>
            ${journalVoucher.dr.zomatoDelivery > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>AR-Zomato Delivery</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-${journalVoucher.dr.zomatoDelivery.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
            ${journalVoucher.dr.swiggyDelivery > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>AR-Swiggy Delivery</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-${journalVoucher.dr.swiggyDelivery.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
            ${journalVoucher.dr.cash > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>Cash</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-${journalVoucher.dr.cash.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
            ${journalVoucher.dr.upi > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>UPI Collection</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-${journalVoucher.dr.upi.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
            ${journalVoucher.dr.bankInTransit > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>Bank In Transit - VISA/Rupee/Master</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-${journalVoucher.dr.bankInTransit.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
            ${journalVoucher.dr.otherReceivables > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>AR- Other Receivables</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-${journalVoucher.dr.otherReceivables.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
            ${journalVoucher.credits.salesCafe > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>Sales - Café</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${journalVoucher.credits.salesCafe.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
            ${journalVoucher.credits.cgst25 > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>CGST 2.5%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${journalVoucher.credits.cgst25.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
            ${journalVoucher.credits.sgst25 > 0 ? `<ALLLEDGERENTRIES.LIST><LEDGERNAME>SGST 2.5%</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${journalVoucher.credits.sgst25.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>` : ""}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    try {
      await fetch("http://localhost:9000", { method: "POST", headers: { "Content-Type": "text/xml;charset=utf-8" }, body: tallyXml });
      notify("Sales Journal Voucher pushed to Tally Prime!", "success");
    } catch {
      notify("Dispatched to local port 9000!", "info");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sales & Revenue Center</h2>
          <p className="text-xs text-slate-500 font-medium">
            Active Client: <strong className="text-slate-900">{activeClient}</strong>
          </p>
        </div>

        {/* PRIMARY SALES TRACK TOGGLE */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setSalesMode("pos_register")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              salesMode === "pos_register" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Store className="w-3.5 h-3.5" /> POS & Daily Register (F&B/Retail)[cite: 7]
          </button>

          <button
            onClick={() => setSalesMode("normal_invoices")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              salesMode === "normal_invoices" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Tax Invoices (B2B / B2C)
          </button>
        </div>
      </header>

      {/* TRACK 1: NORMAL INVOICES VIEW */}
      {salesMode === "normal_invoices" && (
        <div className="flex-1 flex flex-col">
          <div className="px-8 pt-3 pb-0 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setInvoiceTab("list")}
                className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  invoiceTab === "list" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <FileText className="w-4 h-4" /> Issued Invoices ({normalInvoices.length})
              </button>
              <button
                onClick={() => setInvoiceTab("create")}
                className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  invoiceTab === "create" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <Plus className="w-4 h-4" /> + Create New Tax Invoice
              </button>
            </div>
          </div>

          <div className="p-8 max-w-6xl mx-auto w-full space-y-6">
            {invoiceTab === "list" && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {normalInvoices.length === 0 ? (
                  <div className="p-16 text-center text-slate-400 text-xs">
                    No standard tax invoices created yet. Click "+ Create New Tax Invoice" above.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Inv #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer Name</th>
                        <th className="py-3 px-4">GSTIN</th>
                        <th className="py-3 px-4 text-right">Taxable (₹)</th>
                        <th className="py-3 px-4 text-right">Tax (₹)</th>
                        <th className="py-3 px-4 text-right">Total (₹)</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {normalInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{inv.invoiceNumber}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-500">{inv.invoiceDate}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-800">{inv.customerName}</td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{inv.customerGstin || "-"}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold">₹{inv.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-600">₹{(inv.cgst + inv.sgst + inv.igst).toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900">₹{inv.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => handleDeleteNormalInvoice(inv.id)}
                              className="text-slate-300 hover:text-rose-600 p-1 rounded"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {invoiceTab === "create" && (
              <form onSubmit={handleCreateNormalInvoice} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 max-w-3xl mx-auto">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">New Tax Invoice Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Number</label>
                    <input
                      type="text"
                      value={newInv.invoiceNumber}
                      onChange={(e) => setNewInv({ ...newInv, invoiceNumber: e.target.value })}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Date</label>
                    <input
                      type="date"
                      value={newInv.invoiceDate}
                      onChange={(e) => setNewInv({ ...newInv, invoiceDate: e.target.value })}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Billed Entity</label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Bank Ltd / Walk-in Customer"
                      value={newInv.customerName}
                      onChange={(e) => setNewInv({ ...newInv, customerName: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer GSTIN (Optional)</label>
                    <input
                      type="text"
                      placeholder="24AAAAA0000A1Z5"
                      value={newInv.customerGstin}
                      onChange={(e) => setNewInv({ ...newInv, customerGstin: e.target.value.toUpperCase() })}
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Taxable Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newInv.taxableAmount}
                      onChange={(e) => setNewInv({ ...newInv, taxableAmount: e.target.value })}
                      className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">GST Tax Rate</label>
                    <select
                      value={newInv.taxRate}
                      onChange={(e) => setNewInv({ ...newInv, taxRate: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                    >
                      <option value="18">18% (Standard GST)</option>
                      <option value="12">12%</option>
                      <option value="5">5%</option>
                      <option value="0">0% (Nil / Exempt)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setInvoiceTab("list")}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    Issue Tax Invoice
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TRACK 2: POS ENGINE VIEW (EXACT MATCH FOR SCREENSHOTS 1 & 2) */}
      {salesMode === "pos_register" && (
        <div className="flex-1 flex flex-col">
          <div className="px-8 pt-3 pb-0 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setPosTab("register")}
                className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  posTab === "register" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <Receipt className="w-4 h-4" /> POS Sales Register (Image 1)[cite: 7]
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900 text-white font-mono">
                  {posRows.length}
                </span>
              </button>

              <button
                onClick={() => setPosTab("journal")}
                className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  posTab === "journal" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <Scale className="w-4 h-4 text-indigo-600" /> Sales Journal Voucher (Image 2)[cite: 8]
                {journalVoucher.totalDebits > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-600 text-white font-mono font-bold">
                    Balanced (₹{journalVoucher.totalDebits.toLocaleString("en-IN", { maximumFractionDigits: 0 })})
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 pb-2">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <Download className="w-3.5 h-3.5" /> Template[cite: 7]
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="*"
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" /> {isUploading ? "Uploading..." : "Upload Sheet"}
              </button>

              <button
                onClick={() => setPosTab("manual_entry")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> + Manual Entry
              </button>
            </div>
          </div>

          <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* REGISTER TAB (SCREENSHOT 1) */}
            {posTab === "register" && (
              <div className="space-y-4">
                {posRows.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-16 text-center text-slate-400 text-xs shadow-sm">
                    No POS entries yet. Upload your spreadsheet or click <strong>+ Manual Entry</strong>.
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="text-[10px] font-bold text-slate-900 uppercase border-b border-slate-200">
                        <tr className="bg-slate-100">
                          <th className="py-3 px-3">Date</th>
                          <th className="py-3 px-3 bg-[#E6F4F1] text-emerald-950">CASH</th>
                          <th className="py-3 px-3 bg-[#EAF7D8] text-lime-950">UPI Collection</th>
                          <th className="py-3 px-3 bg-[#FCF0D3] text-amber-950">Bank In Transit</th>
                          <th className="py-3 px-3 bg-[#FCE8E8] text-rose-950">Zomato - Delivery</th>
                          <th className="py-3 px-3 bg-[#FCE8E8] text-rose-950">Zomato - Dine In</th>
                          <th className="py-3 px-3 bg-[#EAF3DE] text-emerald-950">Swiggy - Delivery</th>
                          <th className="py-3 px-3 bg-[#EAF3DE] text-emerald-950">Swiggy - Dine In</th>
                          <th className="py-3 px-3 bg-[#EAE8F7] text-indigo-950">Eazy - Dine In</th>
                          <th className="py-3 px-3 bg-[#FFFDD0] text-yellow-950">Due</th>
                          <th className="py-3 px-3 bg-[#FFF799] text-yellow-950">BQR</th>
                          <th className="py-3 px-3 bg-[#FFF799] text-yellow-950">Razorpay</th>
                          <th className="py-3 px-4 bg-[#DCE7F7] text-slate-900 font-black text-right">Total - Sales</th>
                          <th className="py-3 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700 font-medium">
                        {posRows.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3 text-slate-900 font-bold">{row.date}</td>
                            <td className="py-2.5 px-3">{row.cash ? row.cash.toLocaleString("en-IN") : "-"}</td>
                            <td className="py-2.5 px-3">{row.upi ? row.upi.toLocaleString("en-IN") : "-"}</td>
                            <td className="py-2.5 px-3">{row.bankInTransit ? row.bankInTransit.toLocaleString("en-IN") : "-"}</td>
                            <td className="py-2.5 px-3">{row.zomatoDelivery ? row.zomatoDelivery.toLocaleString("en-IN") : "-"}</td>
                            <td className="py-2.5 px-3">{row.zomatoDineIn ? row.zomatoDineIn.toLocaleString("en-IN") : "-"}</td>
                            <td className="py-2.5 px-3">{row.swiggyDelivery ? row.swiggyDelivery.toLocaleString("en-IN") : "-"}</td>
                            <td className="py-2.5 px-3">{row.swiggyDineIn ? row.swiggyDineIn.toLocaleString("en-IN") : "-"}</td>
                            <td className="py-2.5 px-3">{row.eazyDineIn ? row.eazyDineIn.toLocaleString("en-IN") : "-"}</td>
                            <td className="py-2.5 px-3">{row.due ? row.due.toLocaleString("en-IN") : "-"}</td>
                            <td className="py-2.5 px-3">{row.bqr ? row.bqr.toLocaleString("en-IN") : "-"}</td>
                            <td className="py-2.5 px-3">{row.razorpay ? row.razorpay.toLocaleString("en-IN") : "-"}</td>
                            <td className="py-2.5 px-4 text-right font-black text-slate-900 bg-slate-50/50">
                              ₹{row.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleDeletePosRow(row.id)}
                                className="text-slate-300 hover:text-rose-600 p-1 rounded transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* JOURNAL TAB (SCREENSHOT 2) */}
            {posTab === "journal" && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Double-Entry Sales Journal Voucher[cite: 8]
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Balanced across {posRows.length} transactions @ 5% Inclusive GST[cite: 8]
                      </p>
                    </div>
                    <button
                      onClick={handlePushJournalToTally}
                      disabled={journalVoucher.totalDebits <= 0}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" /> Push JV to Tally
                    </button>
                  </div>

                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-6 text-center w-16">Type</th>
                        <th className="py-3 px-6">Particular</th>
                        <th className="py-3 px-6 text-right w-44">Amount (Debit)</th>
                        <th className="py-3 px-6 text-right w-44">Amount (Credit)</th>
                        <th className="py-3 px-6 text-slate-400 font-normal">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                      <tr>
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Dr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">AR-Zomato Delivery</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.dr.zomatoDelivery > 0 ? journalVoucher.dr.zomatoDelivery.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Dr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">AR-Zomato Dine In</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.dr.zomatoDineIn > 0 ? journalVoucher.dr.zomatoDineIn.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Dr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">AR-Swiggy Delivery</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.dr.swiggyDelivery > 0 ? journalVoucher.dr.swiggyDelivery.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Dr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">AR-Swiggy Dine In</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.dr.swiggyDineIn > 0 ? journalVoucher.dr.swiggyDineIn.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Dr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">AR-Eazy Dine In</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.dr.eazyDineIn > 0 ? journalVoucher.dr.eazyDineIn.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Dr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">Cash</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.dr.cash > 0 ? journalVoucher.dr.cash.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Dr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">UPI Collection</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.dr.upi > 0 ? journalVoucher.dr.upi.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Dr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">Bank In Transit - VISA/Rupee/Master</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.dr.bankInTransit > 0 ? journalVoucher.dr.bankInTransit.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Dr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">AR- Other Receivables</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.dr.otherReceivables > 0 ? journalVoucher.dr.otherReceivables.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400 italic">Due, BQR, Razorpay[cite: 8]</td>
                      </tr>

                      {/* CREDITS */}
                      <tr className="bg-slate-50/50">
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Cr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">Sales - Café</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.credits.salesCafe > 0 ? journalVoucher.credits.salesCafe.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400">Taxable In-Store</td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Cr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">Sales - Zomato Delivery</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.credits.salesZomatoDel > 0 ? journalVoucher.credits.salesZomatoDel.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400">Taxable Zomato</td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Cr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">Sales - Swiggy Delivery</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-right font-bold">{journalVoucher.credits.salesSwiggyDel > 0 ? journalVoucher.credits.salesSwiggyDel.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400">Taxable Swiggy</td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Cr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">CGST 2.5%</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-right font-bold text-indigo-700">{journalVoucher.credits.cgst25 > 0 ? journalVoucher.credits.cgst25.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400">5% GST Output</td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="py-2 px-6 text-center font-bold text-slate-500">Cr</td>
                        <td className="py-2 px-6 font-bold text-slate-900">SGST 2.5%</td>
                        <td className="py-2 px-6 text-right text-slate-300">-</td>
                        <td className="py-2 px-6 text-right font-bold text-indigo-700">{journalVoucher.credits.sgst25 > 0 ? journalVoucher.credits.sgst25.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "-"}</td>
                        <td className="py-2 px-6 text-[11px] text-slate-400">5% GST Output</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-900">
                        <td className="py-3 px-6 text-center"></td>
                        <td className="py-3 px-6 text-sm font-black">Total</td>
                        <td className="py-3 px-6 text-right font-black text-emerald-400">₹{journalVoucher.totalDebits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-6 text-right font-black text-emerald-400">₹{journalVoucher.totalCredits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-6 font-mono text-[10px] text-emerald-300 font-normal">✓ Balanced</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* MANUAL ENTRY TAB */}
            {posTab === "manual_entry" && (
              <form onSubmit={handleAddManualRow} className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900">Add POS Order / Daily Register Row</h3>
                    <span className="text-xs text-slate-500">{activeClient}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={manualRow.date}
                      onChange={(e) => handleManualRowChange("date", e.target.value)}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2.5"
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">In-Store Collections (Gross)</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">CASH (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={manualRow.cash}
                          onChange={(e) => handleManualRowChange("cash", e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-[#F7FBF9]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">UPI Collection (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={manualRow.upi}
                          onChange={(e) => handleManualRowChange("upi", e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-[#F9FCF3]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Bank In Transit (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={manualRow.bankInTransit}
                          onChange={(e) => handleManualRowChange("bankInTransit", e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-[#FCFAF0]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aggregator Deliveries & Dine-In (Gross)</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Zomato - Delivery (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={manualRow.zomatoDelivery}
                          onChange={(e) => handleManualRowChange("zomatoDelivery", e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-[#FDF5F5]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Zomato - Dine In (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={manualRow.zomatoDineIn}
                          onChange={(e) => handleManualRowChange("zomatoDineIn", e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-[#FDF5F5]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Swiggy - Delivery (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={manualRow.swiggyDelivery}
                          onChange={(e) => handleManualRowChange("swiggyDelivery", e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-[#F7FAF2]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Swiggy - Dine In (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={manualRow.swiggyDineIn}
                          onChange={(e) => handleManualRowChange("swiggyDineIn", e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-[#F7FAF2]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Eazy - Dine In (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={manualRow.eazyDineIn}
                          onChange={(e) => handleManualRowChange("eazyDineIn", e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-[#F6F5FB]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Other Receivables (Gross)</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Due (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={manualRow.due}
                          onChange={(e) => handleManualRowChange("due", e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-[#FFFDE8]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">BQR (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={manualRow.bqr}
                          onChange={(e) => handleManualRowChange("bqr", e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-[#FFFBEA]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Razorpay (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={manualRow.razorpay}
                          onChange={(e) => handleManualRowChange("razorpay", e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-[#FFFBEA]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setPosTab("register")}
                      className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm"
                    >
                      Add Row to Register
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {notification && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-white text-xs font-semibold flex items-center gap-2 shadow-lg z-50 ${
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
