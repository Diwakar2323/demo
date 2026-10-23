import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportCSV(rows) {
  const headers = ["Date", "Title", "Type", "Category", "Amount", "Note"];
  const cell = v => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [headers, ...rows.map(r => [r.date, r.title, r.type, r.category, r.amount, r.note])].map(row => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "pennywise-transactions.csv"; a.click();
  URL.revokeObjectURL(url);
}
export function exportPDF(rows, month, totals) {
  const pdf = new jsPDF();
  pdf.setFontSize(20); pdf.text("Pennywise Monthly Report", 14, 18);
  pdf.setFontSize(10); pdf.text(`Period: ${month}`, 14, 26);
  pdf.text(`Income: ${totals.income.toFixed(2)}   Expenses: ${totals.expense.toFixed(2)}   Net: ${(totals.income - totals.expense).toFixed(2)}`, 14, 34);
  autoTable(pdf, {
    startY: 42,
    head: [["Date", "Description", "Type", "Category", "Amount"]],
    body: rows.map(r => [r.date, r.title, r.type, r.category, Number(r.amount).toFixed(2)]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [25, 48, 76] }
  });
  pdf.save(`pennywise-report-${month}.pdf`);
}