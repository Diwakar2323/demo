import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy,
  query, serverTimestamp, setDoc
} from "firebase/firestore";
import { db, firebaseEnabled } from "../firebase";

const sample = [
  { id: "s1", title: "Monthly salary", amount: 5200, type: "income", category: "Salary", date: "2026-10-01", note: "October pay" },
  { id: "s2", title: "Apartment rent", amount: 1450, type: "expense", category: "Housing", date: "2026-10-02", note: "" },
  { id: "s3", title: "Groceries", amount: 186.42, type: "expense", category: "Food", date: "2026-10-05", note: "" },
  { id: "s4", title: "Freelance project", amount: 850, type: "income", category: "Freelance", date: "2026-10-08", note: "Landing page" },
  { id: "s5", title: "Train pass", amount: 72, type: "expense", category: "Transport", date: "2026-10-11", note: "" },
  { id: "s6", title: "Dinner with friends", amount: 58.5, type: "expense", category: "Food", date: "2026-10-14", note: "" },
  { id: "s7", title: "Streaming services", amount: 24.99, type: "expense", category: "Entertainment", date: "2026-10-17", note: "" },
  { id: "s8", title: "Investment dividend", amount: 115, type: "income", category: "Investments", date: "2026-10-19", note: "" },
  { id: "s9", title: "Gym membership", amount: 39, type: "expense", category: "Health", date: "2026-10-20", note: "" },
  { id: "s10", title: "Coffee", amount: 6.75, type: "expense", category: "Food", date: "2026-10-22", note: "" }
];

export function getDemoData() {
  try {
    const saved = JSON.parse(localStorage.getItem("pennywise_transactions") || "null");
    return Array.isArray(saved) ? saved : sample;
  } catch { return sample; }
}
export function saveDemoData(items) {
  localStorage.setItem("pennywise_transactions", JSON.stringify(items));
}
export function listenTransactions(uid, callback) {
  if (!firebaseEnabled || !uid) {
    callback(getDemoData());
    return () => {};
  }
  const q = query(collection(db, "users", uid, "transactions"), orderBy("date", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function upsertTransaction(uid, item) {
  if (!firebaseEnabled || !uid) {
    const all = getDemoData();
    const next = item.id ? all.map(x => x.id === item.id ? item : x) : [{ ...item, id: crypto.randomUUID() }, ...all];
    saveDemoData(next);
    return next;
  }
  const col = collection(db, "users", uid, "transactions");
  if (item.id) {
    const { id, ...data } = item;
    await setDoc(doc(col, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    const { id, ...data } = item;
    await addDoc(col, { ...data, createdAt: serverTimestamp() });
  }
}
export async function removeTransaction(uid, id) {
  if (!firebaseEnabled || !uid) {
    saveDemoData(getDemoData().filter(x => x.id !== id));
    return;
  }
  await deleteDoc(doc(db, "users", uid, "transactions", id));
}
export function listenBudgets(uid, callback) {
  if (!firebaseEnabled || !uid) {
    try { callback(JSON.parse(localStorage.getItem("pennywise_budgets") || "{}")); } catch { callback({ Food: 400, Housing: 1600, Transport: 180 }); }
    return () => {};
  }
  return onSnapshot(collection(db, "users", uid, "budgets"), snap => {
    const budgets = {};
    snap.docs.forEach(d => budgets[d.id] = d.data().amount);
    callback(budgets);
  });
}
export async function saveBudget(uid, category, amount) {
  if (!firebaseEnabled || !uid) {
    const current = JSON.parse(localStorage.getItem("pennywise_budgets") || "{}");
    current[category] = Number(amount);
    localStorage.setItem("pennywise_budgets", JSON.stringify(current));
    return;
  }
  await setDoc(doc(db, "users", uid, "budgets", category), { amount: Number(amount) }, { merge: true });
}