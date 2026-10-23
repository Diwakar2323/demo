import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Tooltip, Legend, Filler
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown,
  CircleHelp, CreditCard, Download, FileDown, Filter, LayoutDashboard, LogOut,
  Menu, Plus, Search, Settings, ShieldCheck, Sparkles, Target, TrendingUp, Wallet,
  X, Pencil, Trash2, LockKeyhole
} from "lucide-react";
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, firebaseEnabled } from "./firebase";
import { listenTransactions, upsertTransaction, removeTransaction, listenBudgets, saveBudget } from "./lib/data";
import { exportCSV, exportPDF } from "./lib/export";
import "./styles.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const CATEGORIES = ["Salary", "Freelance", "Investments", "Other income", "Housing", "Food", "Transport", "Health", "Shopping", "Entertainment", "Bills", "Education", "Travel", "Other expense"];
const money = n => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const currentMonth = () => new Date().toISOString().slice(0, 7);
const monthLabel = m => new Date(`${m}-02T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const iconFor = category => ({ Housing: "⌂", Food: "◉", Transport: "↗", Health: "✚", Shopping: "◇", Entertainment: "♫", Salary: "▣", Freelance: "✦", Investments: "↗", Bills: "▤", Education: "▧", Travel: "✈" }[category] || "•");

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!firebaseEnabled);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({ Food: 400, Housing: 1600, Transport: 180 });
  const [month, setMonth] = useState(currentMonth());
  const [page, setPage] = useState("Overview");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ title: "", amount: "", type: "expense", category: "Food", date: new Date().toISOString().slice(0, 10), note: "" });

  useEffect(() => {
    if (!firebaseEnabled) return;
    return onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
  }, []);
  useEffect(() => {
    if (!authReady) return;
    const unsub = listenTransactions(user?.uid, setTransactions);
    const unsubB = listenBudgets(user?.uid, setBudgets);
    return () => { unsub(); unsubB(); };
  }, [user, authReady]);
  const scoped = useMemo(() => transactions.filter(t => String(t.date || "").startsWith(month)), [transactions, month]);
  const totals = useMemo(() => scoped.reduce((a, t) => { a[t.type === "income" ? "income" : "expense"] += Number(t.amount || 0); return a; }, { income: 0, expense: 0 }), [scoped]);
  const balance = totals.income - totals.expense;
  const savingsRate = totals.income ? Math.round(balance / totals.income * 100) : 0;
  const filtered = useMemo(() => [...scoped].filter(t => (filterType === "all" || t.type === filterType) && `${t.title} ${t.category} ${t.note || ""}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => b.date.localeCompare(a.date)), [scoped, filterType, search]);
  const monthlySeries = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const ts = transactions.filter(t => String(t.date).startsWith(key));
    return { label: d.toLocaleDateString("en-US", { month: "short" }), income: ts.filter(t => t.type === "income").reduce((s,t)=>s+Number(t.amount),0), expense: ts.filter(t => t.type === "expense").reduce((s,t)=>s+Number(t.amount),0) };
  }), [transactions, month]);
  const categoryTotals = useMemo(() => {
    const map = {};
    scoped.filter(t => t.type === "expense").forEach(t => map[t.category] = (map[t.category] || 0) + Number(t.amount));
    return Object.entries(map).sort((a,b) => b[1]-a[1]);
  }, [scoped]);
  const insight = totals.income === 0 && totals.expense === 0 ? "Add transactions to unlock personalized insights for this month." :
    balance >= 0 ? `You kept ${Math.max(0, savingsRate)}% of your income this month. ${categoryTotals[0] ? `${categoryTotals[0][0]} is your biggest spending category.` : "Keep building your savings habit."}` :
    `Spending is ${money(Math.abs(balance))} higher than income this month. Review ${categoryTotals[0]?.[0] || "your expenses"} to find room to save.`;

  const notify = msg => { setNotice(msg); setTimeout(() => setNotice(""), 3000); };
  const openAdd = () => { setEditing(null); setForm({ title: "", amount: "", type: "expense", category: "Food", date: new Date().toISOString().slice(0,10), note: "" }); setModal(true); };
  const openEdit = t => { setEditing(t); setForm({ title: t.title, amount: t.amount, type: t.type, category: t.category, date: t.date, note: t.note || "" }); setModal(true); };
  async function submitTransaction(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) return notify("Enter a description and a positive amount.");
    try {
      await upsertTransaction(user?.uid, { ...form, amount, ...(editing ? { id: editing.id } : {}) });
      if (!firebaseEnabled) setTransactions(await import("./lib/data").then(m => m.getDemoData()));
      setModal(false); notify(editing ? "Transaction updated." : "Transaction added.");
    } catch (err) { notify(err.message || "Could not save transaction."); }
  }
  async function deleteItem(t) {
    if (!confirm(`Delete "${t.title}"?`)) return;
    try { await removeTransaction(user?.uid, t.id); if (!firebaseEnabled) setTransactions(await import("./lib/data").then(m => m.getDemoData())); notify("Transaction deleted."); }
    catch (e) { notify(e.message || "Could not delete transaction."); }
  }
  async function handleAuth(e) {
    e.preventDefault(); setAuthError("");
    try {
      if (authMode === "register") await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      else await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
    } catch (e) { setAuthError(e.message.replace("Firebase: ", "")); }
  }
  const doExportPDF = () => { exportPDF(scoped, month, totals); notify("PDF report exported."); };
  const doExportCSV = () => { exportCSV(transactions); notify("CSV export downloaded."); };

  if (!authReady) return <div className="loading-screen"><div className="brand-mark">P</div><p>Preparing your workspace…</p></div>;
  if (firebaseEnabled && !user) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark">P</div><span className="eyebrow">YOUR MONEY, IN FOCUS</span><h1>{authMode === "login" ? "Welcome back." : "Create your account."}</h1><p>Sign in to securely manage your personal finances.</p><form onSubmit={handleAuth}><label>Email address<input type="email" required value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})} placeholder="you@example.com"/></label><label>Password<input type="password" minLength="6" required value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} placeholder="At least 6 characters"/></label>{authError && <div className="error-text">{authError}</div>}<button className="primary-btn full-btn">{authMode === "login" ? "Sign in" : "Create account"} <ArrowUpRight size={16}/></button></form><button className="text-btn" onClick={()=>setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button></div></div>;

  const nav = [{ label: "Overview", icon: LayoutDashboard }, { label: "Transactions", icon: CreditCard }, { label: "Analytics", icon: Activity }, { label: "Budgets", icon: Target }, { label: "Reports", icon: FileDown }];
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 7, padding: 18, color: "#8995a8", font: { family: "Inter, sans-serif", size: 11 } } }, tooltip: { padding: 12, backgroundColor: "#172234", titleColor: "#fff", bodyColor: "#d5deea" } }, scales: { x: { grid: { display: false }, ticks: { color: "#8995a8", font: { size: 11 } } }, y: { grid: { color: "#edf0f5" }, ticks: { color: "#8995a8", font: { size: 11 }, callback: v => "$" + v.toLocaleString() }, border: { display: false } } } };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand-row"><div className="brand-mark">P</div><span>Pennywise<span className="brand-dot">.</span></span><button className="icon-btn close-nav" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE <ChevronDown size={13}/></div>
      <div className="workspace-card"><div className="workspace-avatar">PF</div><div><b>Personal Finance</b><small>{firebaseEnabled ? user?.email : "Demo workspace"}</small></div><ChevronDown size={14}/></div>
      <div className="nav-label">MENU</div>
      <nav>{nav.map(n => <button key={n.label} className={`nav-item ${page===n.label?"active":""}`} onClick={()=>{setPage(n.label);setMobileNav(false)}}><n.icon size={18}/><span>{n.label}</span>{n.label==="Transactions" && <span className="nav-count">{transactions.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={16}/></div><b>Money, made clearer.</b><p>Small insights today. Better habits tomorrow.</p><button onClick={()=>setPage("Analytics")}>Explore insights <ArrowUpRight size={14}/></button></div><button className="nav-item muted" onClick={()=>notify("Settings are coming soon.")}><Settings size={18}/><span>Settings</span></button><div className="profile-row"><div className="profile-avatar">{firebaseEnabled ? (user?.email?.[0] || "U").toUpperCase() : "D"}</div><div className="profile-info"><b>{firebaseEnabled ? user?.email?.split("@")[0] : "Demo User"}</b><small>{firebaseEnabled ? "Personal account" : "Local demo"}</small></div>{firebaseEnabled && <button className="icon-btn" title="Sign out" onClick={()=>signOut(auth)}><LogOut size={16}/></button>}</div></div>
    </aside>
    {mobileNav && <div className="mobile-scrim" onClick={()=>setMobileNav(false)}/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn menu-btn" onClick={()=>setMobileNav(true)}><Menu size={21}/></button><div><div className="breadcrumb">Workspace <span>/</span> <b>{page}</b></div><h1>{page === "Overview" ? "Good evening" : page}<span className="heading-period">.</span></h1></div></div><div className="topbar-actions"><div className="month-picker"><CalendarDays size={16}/><input aria-label="Report month" type="month" value={month} onChange={e=>setMonth(e.target.value)}/><ChevronDown size={13}/></div><button className="icon-btn notification-btn" onClick={()=>notify(insight)} title="Monthly insight"><Bell size={18}/><i/></button><div className="top-avatar">{firebaseEnabled ? (user?.email?.[0] || "U").toUpperCase() : "D"}</div></div></header>
      <div className="content">
        {page === "Overview" && <>
          <div className="welcome-row"><div><div className="eyebrow">YOUR FINANCIAL SNAPSHOT</div><p>Here’s what’s happening with your money.</p></div><button className="primary-btn" onClick={openAdd}><Plus size={17}/> Add transaction</button></div>
          <section className="metric-grid">
            <Metric title="Total income" amount={money(totals.income)} icon={ArrowDownLeft} tone="green" caption={`${scoped.filter(t=>t.type==="income").length} income entries`} />
            <Metric title="Total expenses" amount={money(totals.expense)} icon={ArrowUpRight} tone="red" caption={`${scoped.filter(t=>t.type==="expense").length} expense entries`} />
            <Metric title="Net balance" amount={money(balance)} icon={Wallet} tone="blue" caption={balance >= 0 ? "You’re in the green" : "Spending exceeds income"} />
            <Metric title="Savings rate" amount={`${savingsRate}%`} icon={TrendingUp} tone="purple" caption="Of this month’s income" />
          </section>
          <section className="chart-grid">
            <div className="panel trend-panel"><div className="panel-heading"><div><h2>Cash flow</h2><p>Income vs. expenses over time</p></div><span className="pill"><span/> Last 6 months</span></div><div className="chart-wrap"><Bar data={{ labels: monthlySeries.map(x=>x.label), datasets: [{label:"Income",data:monthlySeries.map(x=>x.income),backgroundColor:"#3dbb8a",borderRadius:5,barThickness:13},{label:"Expenses",data:monthlySeries.map(x=>x.expense),backgroundColor:"#f19a83",borderRadius:5,barThickness:13}] }} options={{...chartOptions, scales:{...chartOptions.scales,x:{...chartOptions.scales.x,grid:{display:false}},y:chartOptions.scales.y}}}/></div><div className="chart-foot"><span><i className="legend-dot green-dot"/> Income <b>{money(totals.income)}</b></span><span><i className="legend-dot coral-dot"/> Expenses <b>{money(totals.expense)}</b></span></div></div>
            <div className="panel category-panel"><div className="panel-heading"><div><h2>Spending breakdown</h2><p>Where your money goes</p></div><button className="more-btn" onClick={()=>setPage("Analytics")}>Details <ArrowUpRight size={14}/></button></div>{categoryTotals.length ? <><div className="donut-wrap"><Doughnut data={{labels:categoryTotals.slice(0,6).map(x=>x[0]),datasets:[{data:categoryTotals.slice(0,6).map(x=>x[1]),backgroundColor:["#6d8af7","#45bd94","#f2ad75","#a68af0","#ef8f9d","#66b9cc"],borderWidth:0,hoverOffset:5}]}} options={{responsive:true,maintainAspectRatio:false,cutout:"72%",plugins:{legend:{display:false}}}}/><div className="donut-center"><strong>{money(totals.expense)}</strong><small>Total spent</small></div></div><div className="category-legend">{categoryTotals.slice(0,4).map(([name,val],i)=><div key={name}><span><i style={{background:["#6d8af7","#45bd94","#f2ad75","#a68af0"][i%4]}}/>{name}</span><b>{Math.round(val/(totals.expense||1)*100)}%</b></div>)}</div></> : <Empty text="No expenses recorded for this month yet."/>}</div>
          </section>
          <section className="panel transactions-panel"><div className="panel-heading"><div><h2>Recent transactions</h2><p>Your latest money movements</p></div><button className="more-btn" onClick={()=>setPage("Transactions")}>View all <ArrowUpRight size={14}/></button></div><TransactionTable rows={filtered.slice(0,5)} onEdit={openEdit} onDelete={deleteItem}/></section>
          <section className="insight-banner"><div className="insight-icon"><Sparkles size={20}/></div><div><b>Your monthly insight</b><p>{insight}</p></div><button className="icon-btn" onClick={()=>setPage("Analytics")}><ArrowUpRight size={18}/></button></section>
        </>}
        {page === "Transactions" && <><div className="page-intro"><div><div className="eyebrow">YOUR MONEY MOVEMENTS</div><p>Every transaction, organized in one place.</p></div><button className="primary-btn" onClick={openAdd}><Plus size={17}/> Add transaction</button></div><div className="panel transactions-panel"><div className="toolbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search transactions..."/></div><div className="filter-select"><Filter size={15}/><select value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select></div><button className="outline-btn" onClick={doExportCSV}><Download size={15}/> Export CSV</button></div><TransactionTable rows={filtered} onEdit={openEdit} onDelete={deleteItem}/></div></>}
        {page === "Analytics" && <><div className="page-intro"><div><div className="eyebrow">PATTERNS & PERFORMANCE</div><p>Understand the habits behind your numbers.</p></div></div><section className="metric-grid"><Metric title="Monthly income" amount={money(totals.income)} icon={ArrowDownLeft} tone="green"/><Metric title="Monthly spend" amount={money(totals.expense)} icon={ArrowUpRight} tone="red"/><Metric title="Net cash flow" amount={money(balance)} icon={Activity} tone="blue"/><Metric title="Savings rate" amount={`${savingsRate}%`} icon={TrendingUp} tone="purple"/></section><section className="chart-grid analytics-charts"><div className="panel trend-panel"><div className="panel-heading"><div><h2>Income & expenses</h2><p>Six-month comparison</p></div></div><div className="chart-wrap tall"><Line data={{labels:monthlySeries.map(x=>x.label),datasets:[{label:"Income",data:monthlySeries.map(x=>x.income),borderColor:"#3dbb8a",backgroundColor:"#3dbb8a",tension:.35,pointRadius:3},{label:"Expenses",data:monthlySeries.map(x=>x.expense),borderColor:"#f19a83",backgroundColor:"#f19a83",tension:.35,pointRadius:3}]}} options={chartOptions}/></div></div><div className="panel category-panel"><div className="panel-heading"><div><h2>Expense categories</h2><p>Ranked by amount</p></div></div>{categoryTotals.length ? <div className="rank-list">{categoryTotals.map(([name,val])=><div className="rank-item" key={name}><div className="rank-title"><span>{iconFor(name)} &nbsp;{name}</span><b>{money(val)}</b></div><div className="progress-track"><i style={{width:`${val/(categoryTotals[0]?.[1]||1)*100}%`}}/></div><small>{Math.round(val/(totals.expense||1)*100)}% of expenses</small></div>)}</div>:<Empty text="Add expenses to see your category analysis."/>}</div></section><div className="insight-banner"><div className="insight-icon"><Sparkles size={20}/></div><div><b>Personalized insight</b><p>{insight}</p></div></div></>}
        {page === "Budgets" && <><div className="page-intro"><div><div className="eyebrow">SPEND WITH INTENTION</div><p>Set monthly limits for your spending categories.</p></div></div><section className="budget-grid">{["Food","Housing","Transport","Shopping","Entertainment","Health","Bills","Travel"].map(cat=>{const spent=categoryTotals.find(x=>x[0]===cat)?.[1]||0;const limit=Number(budgets[cat]||0);const pct=limit?Math.min(100,spent/limit*100):0;return <div className="panel budget-card" key={cat}><div className="budget-card-top"><div className="category-icon">{iconFor(cat)}</div><span className={`budget-status ${limit&&spent>limit?"over":""}`}>{limit?(spent>limit?"Over budget":"On track"):"No limit"}</span></div><h3>{cat}</h3><div className="budget-numbers"><strong>{money(spent)}</strong><span>{limit?`of ${money(limit)}`:"spent this month"}</span></div><div className="progress-track"><i className={limit&&spent>limit?"over-fill":""} style={{width:`${pct}%`}}/></div><div className="budget-edit"><span>{limit?`${Math.round(spent/limit*100)}% used`:"Set a monthly limit"}</span><button onClick={()=>{const val=prompt(`Monthly budget for ${cat} (USD):`,limit||"");if(val!==null&&val.trim()!==""&&Number(val)>0)saveBudget(user?.uid,cat,Number(val)).then(()=>{if(!firebaseEnabled)setBudgets(JSON.parse(localStorage.getItem("pennywise_budgets")||"{}"));notify("Budget updated.");}).catch(e=>notify(e.message));}}><Pencil size={13}/> {limit?"Edit":"Set limit"}</button></div></div>})}</section></>}
        {page === "Reports" && <><div className="page-intro"><div><div className="eyebrow">MONTHLY MONEY REVIEW</div><p>Export a clear summary of your finances.</p></div><div className="report-actions"><button className="outline-btn" onClick={doExportCSV}><Download size={15}/> Export all CSV</button><button className="primary-btn" onClick={doExportPDF}><FileDown size={16}/> Download PDF</button></div></div><section className="metric-grid"><Metric title="Income" amount={money(totals.income)} icon={ArrowDownLeft} tone="green"/><Metric title="Expenses" amount={money(totals.expense)} icon={ArrowUpRight} tone="red"/><Metric title="Net balance" amount={money(balance)} icon={Wallet} tone="blue"/><Metric title="Transactions" amount={String(scoped.length)} icon={CreditCard} tone="purple"/></section><div className="panel report-panel"><div className="report-heading"><div className="report-mark"><FileDown size={22}/></div><div><h2>{monthLabel(month)} report</h2><p>Financial activity for the selected month</p></div></div><div className="report-summary"><div><small>Total income</small><strong className="positive">{money(totals.income)}</strong></div><div><small>Total expenses</small><strong className="negative">{money(totals.expense)}</strong></div><div><small>Net result</small><strong>{money(balance)}</strong></div><div><small>Savings rate</small><strong>{savingsRate}%</strong></div></div><div className="report-insight"><Sparkles size={18}/><span>{insight}</span></div><div className="panel-heading report-table-heading"><div><h2>Included transactions</h2><p>{scoped.length} records in this report</p></div></div><TransactionTable rows={filtered} onEdit={openEdit} onDelete={deleteItem}/><div className="report-footer"><ShieldCheck size={15}/> Generated by Pennywise • Amounts shown in USD</div></div></>}
        <footer className="app-footer"><span>© 2026 Pennywise Finance</span><span><LockKeyhole size={13}/> Your finances, your control</span></footer>
      </div>
    </main>
    {modal && <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="transaction-modal" onSubmit={submitTransaction}><div className="modal-heading"><div><span className="eyebrow">{editing?"UPDATE RECORD":"NEW RECORD"}</span><h2>{editing?"Edit transaction":"Add transaction"}</h2></div><button type="button" className="icon-btn" onClick={()=>setModal(false)}><X size={19}/></button></div><div className="type-toggle"><button type="button" className={form.type==="expense"?"selected expense-selected":""} onClick={()=>setForm({...form,type:"expense",category:"Food"})}><ArrowUpRight size={16}/> Expense</button><button type="button" className={form.type==="income"?"selected income-selected":""} onClick={()=>setForm({...form,type:"income",category:"Salary"})}><ArrowDownLeft size={16}/> Income</button></div><label>Description<input autoFocus required maxLength="100" placeholder="e.g. Weekly groceries" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><div className="form-two"><label>Amount (USD)<input type="number" required min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label>Date<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label></div><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATEGORIES.filter(c=>form.type==="income"?["Salary","Freelance","Investments","Other income"].includes(c):!["Salary","Freelance","Investments","Other income"].includes(c)).map(c=><option key={c}>{c}</option>)}</select></label><label>Note <span className="optional">(optional)</span><textarea rows="2" maxLength="300" placeholder="Add a note..." value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label><div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setModal(false)}>Cancel</button><button className="primary-btn"><Check size={16}/>{editing?"Save changes":"Add transaction"}</button></div></form></div>}
    {notice && <div className="toast"><Check size={16}/>{notice}</div>}
  </div>;
}

function Metric({title,amount,icon:Icon,tone,caption}) {
  return <div className="metric-card"><div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}><Icon size={18}/></span></div><strong className="metric-amount">{amount}</strong>{caption&&<div className="metric-caption"><span className={`caption-dot ${tone}`}/>{caption}</div>}</div>;
}
function Empty({text}) { return <div className="empty-state"><div className="empty-icon"><Activity size={22}/></div><p>{text}</p></div>; }
function TransactionTable({rows,onEdit,onDelete}) {
  if (!rows.length) return <Empty text="No transactions found. Add one to get started."/>;
  return <div className="table-scroll"><table><thead><tr><th>TRANSACTION</th><th>CATEGORY</th><th>DATE</th><th>AMOUNT</th><th></th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td><div className="transaction-name"><span className={`transaction-icon ${t.type}`}>{iconFor(t.category)}</span><span><b>{t.title}</b><small>{t.note || (t.type==="income"?"Money received":"Money spent")}</small></span></div></td><td><span className="category-tag">{t.category}</span></td><td className="date-cell">{t.date}</td><td><b className={t.type==="income"?"positive":"negative"}>{t.type==="income"?"+":"−"}{money(t.amount)}</b></td><td><div className="row-actions"><button title="Edit" onClick={()=>onEdit(t)}><Pencil size={14}/></button><button title="Delete" onClick={()=>onDelete(t)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>;
}
createRoot(document.getElementById("root")).render(<App/>);