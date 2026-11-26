import { Text, View } from "@react-pdf/renderer";
import { LetterheadDocument, styles, BRAND, type Company, type Lang } from "./letterhead";
import { DataTable, type Col } from "./templates";
import { clean } from "./fonts";

export type PdfReportTable = { title?: string; cols: Col[]; rows: string[][] };

/** Landscape report on the letterhead: title, filter line, summary tiles, tables. */
export function ReportPdf({
  lang,
  company,
  logo,
  labels,
  title,
  filtersText,
  summary,
  tables,
  emptyText,
}: {
  lang: Lang;
  company: Company;
  logo: Buffer | null;
  labels: { page: (p: number, n: number) => string; taxNo: string; cr: string };
  title: string;
  filtersText: string;
  summary: [string, string][];
  tables: PdfReportTable[];
  emptyText: string;
}) {
  const s = styles(lang);
  return (
    <LetterheadDocument lang={lang} title={title} company={company} logo={logo} labels={labels} orientation="landscape">
      <Text style={s.h1}>{clean(title)}</Text>
      {!!filtersText && <Text style={[s.text, s.muted, { marginBottom: 10 }]}>{clean(filtersText)}</Text>}
      {summary.length > 0 && (
        <View style={[s.row, { gap: 8, marginBottom: 12 }]}>
          {summary.map(([k, v]) => (
            <View key={k} style={[s.box, { flex: 1 }]}>
              <Text style={[s.text, s.muted, { fontSize: 8 }]}>{clean(k)}</Text>
              <Text style={[s.text, { fontWeight: 700, color: BRAND.navy, fontSize: 11 }]}>{clean(v)}</Text>
            </View>
          ))}
        </View>
      )}
      {tables.every((t) => t.rows.length === 0) && <Text style={[s.text, s.muted]}>{emptyText}</Text>}
      {tables
        .filter((t) => t.rows.length > 0)
        .map((t, i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            {!!t.title && <Text style={s.h2}>{clean(t.title)}</Text>}
            <DataTable lang={lang} cols={t.cols} rows={t.rows} />
          </View>
        ))}
    </LetterheadDocument>
  );
}
