import fs from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import { createTranslator } from "next-intl";
import { getCurrentUser } from "@/server/auth-guard";
import { buildReport, formatCell, parseFilters, REPORT_TYPES, type ReportResult, type ReportType } from "@/server/services/reports";
import { getSettings } from "@/server/services/settings";
import { readFileBuffer } from "@/server/services/storage";
import { messagesFor } from "@/i18n/messages";
import { registerPdfFonts } from "@/pdf/fonts";
import { ReportPdf } from "@/pdf/report";

/** GET /api/reports/{type}?format=pdf|xlsx&lang=ar|en&from&to&status&clientId&userId */
export async function GET(req: Request, ctx: RouteContext<"/api/reports/[type]">) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { type } = await ctx.params;
  if (!REPORT_TYPES.includes(type as ReportType)) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") === "en" ? "en" : url.searchParams.get("lang") === "ar" ? "ar" : user.locale;
  const report = await buildReport(type as ReportType, parseFilters(Object.fromEntries(url.searchParams)), lang);
  const base = `report-${type}-${new Date().toISOString().slice(0, 10)}-${lang}`;

  if (url.searchParams.get("format") === "xlsx") {
    const buf = await toExcel(report, lang);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  registerPdfFonts();
  const s = await getSettings();
  let logo = s.logoUrl ? await readFileBuffer(s.logoUrl).catch(() => null) : null;
  if (!logo) logo = await fs.readFile(path.join(process.cwd(), "public/brand/logo.png")).catch(() => null);
  const t = createTranslator({ locale: lang, messages: messagesFor(lang) });
  const pdf = await renderToBuffer(
    createElement(ReportPdf, {
      lang,
      logo,
      company: {
        name: lang === "ar" ? s.companyNameAr : s.companyNameEn,
        address: lang === "ar" ? s.addressAr : s.addressEn,
        phone: s.phone, email: s.email, website: s.website, taxNumber: s.taxNumber, commercialRegister: s.commercialRegister,
        footer: lang === "ar" ? s.letterheadFooterAr : s.letterheadFooterEn,
      },
      labels: { page: (p: number, n: number) => t("pdf.page", { page: p, pages: n }), taxNo: t("pdf.taxNo"), cr: t("pdf.cr") },
      title: report.title,
      filtersText: report.filtersText,
      summary: report.summary,
      emptyText: t("reports.empty"),
      tables: report.tables.map((tb) => {
        const weights = tb.columns.map((c) => (c.type === "text" ? 2 : 1));
        const sum = weights.reduce((a, b) => a + b, 0);
        return {
          title: tb.title,
          cols: tb.columns.map((c, i) => ({ label: c.label, width: `${((weights[i] / sum) * 100).toFixed(2)}%`, align: c.align === "end" ? ("end" as const) : ("start" as const) })),
          rows: tb.rows.map((r) => tb.columns.map((c) => formatCell(c, r, lang))),
        };
      }) as never,
    }) as never,
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${base}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function toExcel(report: ReportResult, lang: "ar" | "en") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Arab Computers";
  const rtl = lang === "ar";
  const header = (ws: ExcelJS.Worksheet) => {
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E4C9A" } };
  };
  const sum = wb.addWorksheet(lang === "ar" ? "الملخص" : "Summary", { views: [{ rightToLeft: rtl }] });
  sum.addRow([report.title]).font = { bold: true, size: 14 };
  if (report.filtersText) sum.addRow([report.filtersText]);
  sum.addRow([]);
  report.summary.forEach(([k, v]) => sum.addRow([k, v]));
  sum.getColumn(1).width = 36;
  sum.getColumn(2).width = 28;

  report.tables.forEach((tb, i) => {
    const name = (tb.title ?? `${lang === "ar" ? "البيانات" : "Data"} ${i + 1}`).replace(/[\\/*?:[\]]/g, " ").slice(0, 31);
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: rtl, state: "frozen", ySplit: 1 }] });
    const hasCurrency = tb.columns.some((c) => c.type === "money");
    ws.addRow([...tb.columns.map((c) => c.label), ...(hasCurrency ? [lang === "ar" ? "العملة" : "Currency"] : [])]);
    header(ws);
    for (const r of tb.rows) {
      ws.addRow([
        ...tb.columns.map((c) => {
          const v = r[c.key];
          if (v == null || v === "") return null;
          if (c.type === "date") return new Date(String(v));
          if (c.type === "money" || c.type === "number") return Number(v);
          return String(v);
        }),
        ...(hasCurrency ? [r._currency ?? ""] : []),
      ]);
    }
    tb.columns.forEach((c, idx) => {
      const col = ws.getColumn(idx + 1);
      col.width = c.type === "text" ? 32 : 16;
      if (c.type === "money") col.numFmt = "#,##0.00";
      if (c.type === "date") col.numFmt = "yyyy-mm-dd";
    });
    if (tb.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: tb.columns.length } };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
