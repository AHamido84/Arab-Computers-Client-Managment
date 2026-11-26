/**
 * Company letterhead shared by every PDF: logo + company block in the header,
 * contact line + page numbers in the footer. Direction-aware (ar = RTL).
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_FONT, clean } from "./fonts";

export const BRAND = { navy: "#183878", royal: "#1E4C9A", cyan: "#00A8D0", muted: "#5B6B85", border: "#DDE3EC", soft: "#F2F6FB" };

export type Company = {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  taxNumber?: string | null;
  commercialRegister?: string | null;
  footer?: string | null;
};

export type Lang = "ar" | "en";

export function styles(lang: Lang) {
  const rtl = lang === "ar";
  return StyleSheet.create({
    page: { fontFamily: PDF_FONT, fontSize: 9.5, color: "#0F1B33", paddingTop: 108, paddingBottom: 70, paddingHorizontal: 42 },
    // NOTE: lineHeight must not be set on Page — react-pdf then drops fixed absolute elements (footer).
    text: { textAlign: rtl ? "right" : "left", direction: rtl ? "rtl" : "ltr", lineHeight: 1.4 },
    row: { flexDirection: rtl ? "row-reverse" : "row" },
    h1: { fontSize: 17, fontWeight: 700, color: BRAND.navy, textAlign: rtl ? "right" : "left", marginBottom: 4 },
    h2: { fontSize: 11, fontWeight: 700, color: BRAND.royal, textAlign: rtl ? "right" : "left", marginTop: 14, marginBottom: 6 },
    muted: { color: BRAND.muted },
    bold: { fontWeight: 700 },
    th: { backgroundColor: BRAND.royal, color: "#FFFFFF", fontWeight: 600, paddingVertical: 5, paddingHorizontal: 6, fontSize: 9 },
    td: { paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BRAND.border, fontSize: 9 },
    box: { borderWidth: 0.75, borderColor: BRAND.border, borderRadius: 4, padding: 10, backgroundColor: BRAND.soft },
  });
}

/** Align a table cell according to language (numbers stay aligned to the "end"). */
export const cellAlign = (lang: Lang, kind: "start" | "end" | "center" = "start") =>
  kind === "center" ? "center" : (lang === "ar") === (kind === "start") ? "right" : "left";

export function LetterheadDocument({
  lang,
  title,
  company,
  logo,
  labels,
  children,
}: {
  lang: Lang;
  title: string;
  company: Company;
  logo: Buffer | null;
  labels: { page: (p: number, n: number) => string; taxNo: string; cr: string };
  children: React.ReactNode;
}) {
  const s = styles(lang);
  const contact = [company.phone, company.email, company.website].filter(Boolean).map(clean).join("   •   ");
  const legal = [company.taxNumber && `${labels.taxNo}: ${company.taxNumber}`, company.commercialRegister && `${labels.cr}: ${company.commercialRegister}`]
    .filter(Boolean)
    .join("   •   ");
  return (
    <Document title={title} author={company.name} creator={company.name} producer={company.name} language={lang}>
      <Page size="A4" style={s.page} wrap>
        {/* Header */}
        <View fixed style={{ position: "absolute", top: 26, left: 42, right: 42 }}>
          <View style={[s.row, { justifyContent: "space-between", alignItems: "center" }]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {logo ? <Image src={{ data: logo, format: "png" }} style={{ width: 170, height: 33, objectFit: "contain" }} /> : <Text style={s.h1}>{company.name}</Text>}
            <View style={{ alignItems: lang === "ar" ? "flex-start" : "flex-end", maxWidth: 260 }}>
              <Text style={[s.text, s.bold, { color: BRAND.navy, fontSize: 10.5 }]}>{clean(company.name)}</Text>
              {!!company.address && <Text style={[s.text, s.muted, { fontSize: 8.5 }]}>{clean(company.address)}</Text>}
            </View>
          </View>
          <View style={[s.row, { marginTop: 10 }]}>
            <View style={{ flex: 3, height: 2.5, backgroundColor: BRAND.navy }} />
            <View style={{ flex: 1, height: 2.5, backgroundColor: BRAND.cyan }} />
          </View>
        </View>

        {children}

        {/* Footer */}
        <View fixed style={{ position: "absolute", bottom: 24, left: 42, right: 42 }}>
          <View style={{ height: 0.75, backgroundColor: BRAND.border, marginBottom: 6 }} />
          {!!company.footer && <Text style={[s.muted, { fontSize: 7.5, textAlign: "center", direction: lang === "ar" ? "rtl" : "ltr" }]}>{clean(company.footer)}</Text>}
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={[s.muted, { fontSize: 7.5 }]}>{contact}</Text>
            <Text style={[s.muted, { fontSize: 7.5 }]} render={({ pageNumber, totalPages }) => labels.page(pageNumber, totalPages)} />
          </View>
          {!!legal && <Text style={[s.muted, { fontSize: 7, textAlign: "center", marginTop: 2 }]}>{legal}</Text>}
        </View>
      </Page>
    </Document>
  );
}

/**
 * Render template text: blank lines separate paragraphs; a short clause title
 * on the first line of a paragraph ("البند الأول: …", "1. Subject") is bold.
 */
export function TemplateBody({ text, lang }: { text: string; lang: Lang }) {
  const s = styles(lang);
  const paragraphs = clean(text).split(/\n\s*\n/).map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean)).filter((p) => p.length);
  return (
    <View>
      {paragraphs.map((lines, i) => {
        // Clause headings: "1. Subject", "البند الأول: …", "Article 2 …" — but not numbered lists.
        const clause = /^(\d+[.)]\s+\S|البند|المادة|Article\b|Clause\b)/i;
        const heading = lines.length > 1 && lines[0].length <= 60 && clause.test(lines[0]) && !/^\d+[.)]\s/.test(lines[1]);
        return (
          <View key={i} style={{ marginBottom: 7 }} wrap={false}>
            {lines.map((l, j) => (
              <Text key={j} style={[s.text, heading && j === 0 ? { fontWeight: 700, color: BRAND.navy } : {}]}>
                {l}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export function KeyValueGrid({ items, lang }: { items: [string, string][]; lang: Lang }) {
  const s = styles(lang);
  return (
    <View style={[s.box, s.row, { flexWrap: "wrap" }]}>
      {items.map(([k, v], i) => (
        <View key={i} style={{ width: "50%", paddingVertical: 2 }}>
          <Text style={[s.text, s.muted, { fontSize: 8 }]}>{k}</Text>
          <Text style={[s.text, s.bold]}>{clean(v) || "—"}</Text>
        </View>
      ))}
    </View>
  );
}

function SignatureBlock({ lang, title, labels }: { lang: Lang; title: string; labels: { signature: string; name: string; stamp: string } }) {
  const s = styles(lang);
  return (
    <View style={{ width: "45%" }}>
      <Text style={[s.text, s.bold, { color: BRAND.navy, marginBottom: 18 }]}>{title}</Text>
      {[labels.name, labels.signature, labels.stamp].map((l) => (
        <View key={l} style={[s.row, { marginBottom: 14 }]}>
          <Text style={[s.text, s.muted, { width: 60 }]}>{l}:</Text>
          <View style={{ flex: 1, borderBottomWidth: 0.75, borderBottomColor: "#9AA7BD" }} />
        </View>
      ))}
    </View>
  );
}

export function Signatures({ lang, left, right, labels }: { lang: Lang; left: string; right: string; labels: { signature: string; name: string; stamp: string } }) {
  const s = styles(lang);
  return (
    <View style={[s.row, { justifyContent: "space-between", marginTop: 26 }]} wrap={false}>
      <SignatureBlock lang={lang} title={left} labels={labels} />
      <SignatureBlock lang={lang} title={right} labels={labels} />
    </View>
  );
}
