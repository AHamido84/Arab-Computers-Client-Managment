/**
 * Client-side Excel export. ExcelJS is loaded on demand so it never weighs
 * on the initial page bundle.
 */
export async function exportToExcel({
  fileName,
  headers,
  rows,
  rtl,
  sheetName = "Data",
}: {
  fileName: string;
  headers: string[];
  rows: (string | number)[][];
  rtl?: boolean;
  sheetName?: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Arab Computers";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ rightToLeft: !!rtl, state: "frozen", ySplit: 1 }] });
  ws.addRow(headers);
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E4C9A" } };
  header.alignment = { vertical: "middle" };
  rows.forEach((r) => ws.addRow(r));
  ws.columns.forEach((col, i) => {
    const max = Math.max(headers[i]?.length ?? 10, ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length));
    col.width = Math.min(60, Math.max(10, max + 2));
    if (rows.some((r) => typeof r[i] === "number")) col.numFmt = "#,##0.00";
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
