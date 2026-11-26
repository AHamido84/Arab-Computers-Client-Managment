/**
 * The three printable documents. Data arrives fully prepared (strings already
 * formatted for the document language) from src/server/services/documents.ts.
 */
import { Text, View } from "@react-pdf/renderer";
import { BRAND, KeyValueGrid, LetterheadDocument, Signatures, TemplateBody, cellAlign, styles, type Company, type Lang } from "./letterhead";
import { clean } from "./fonts";

/** Translated labels for documents (strings) plus the page-number formatter. */
export type Labels = { [key: string]: string } & { readonly pageFn: (p: number, n: number) => string };

type Common = { lang: Lang; company: Company; logo: Buffer | null; L: Labels };

function Header({ lang, title, meta }: { lang: Lang; title: string; meta: [string, string][] }) {
  const s = styles(lang);
  return (
    <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }]}>
      <Text style={s.h1}>{clean(title)}</Text>
      <View>
        {meta.map(([k, v]) => (
          <View key={k} style={[s.row, { gap: 6 }]}>
            <Text style={[s.text, s.muted]}>{k}:</Text>
            <Text style={[s.text, s.bold]}>{clean(v)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ToBlock({ lang, L, client, contact }: { lang: Lang; L: Labels; client: string; contact?: string | null }) {
  const s = styles(lang);
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={[s.row, { gap: 6 }]}>
        <Text style={[s.text, s.muted]}>{L.to}:</Text>
        <Text style={[s.text, s.bold]}>{clean(client)}</Text>
      </View>
      {!!contact && (
        <View style={[s.row, { gap: 6 }]}>
          <Text style={[s.text, s.muted]}>{L.attn}:</Text>
          <Text style={s.text}>{clean(contact)}</Text>
        </View>
      )}
    </View>
  );
}

export type Col = { label: string; width: string; align: "start" | "end" | "center" };

export function DataTable({ lang, cols, rows }: { lang: Lang; cols: Col[]; rows: (string | { main: string; sub?: string })[][] }) {
  const s = styles(lang);
  return (
    <View style={{ borderWidth: 0.75, borderColor: BRAND.border, borderRadius: 3 }}>
      <View style={s.row} fixed>
        {cols.map((c) => (
          <Text key={c.label} style={[s.th, { width: c.width, textAlign: cellAlign(lang, c.align) }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[s.row, i % 2 ? { backgroundColor: "#FAFBFD" } : {}]} wrap={false}>
          {r.map((cell, j) => {
            const c = cols[j];
            const align = cellAlign(lang, c.align);
            if (typeof cell === "string")
              return (
                <Text key={j} style={[s.td, { width: c.width, textAlign: align, direction: lang === "ar" ? "rtl" : "ltr" }]}>
                  {clean(cell)}
                </Text>
              );
            return (
              <View key={j} style={[s.td, { width: c.width }]}>
                <Text style={[s.bold, { textAlign: align, direction: lang === "ar" ? "rtl" : "ltr" }]}>{clean(cell.main)}</Text>
                {cell.sub ? <Text style={[s.muted, { fontSize: 8, textAlign: align, direction: lang === "ar" ? "rtl" : "ltr" }]}>{clean(cell.sub)}</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function TotalsBox({ lang, rows }: { lang: Lang; rows: [string, string, boolean?][] }) {
  const s = styles(lang);
  return (
    <View style={[s.row, { marginTop: 8 }]} wrap={false}>
      <View style={{ flex: 1 }} />
      <View style={{ width: 220 }}>
        {rows.map(([k, v, strong]) => (
          <View
            key={k}
            style={[
              s.row,
              { justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 6 },
              strong ? { backgroundColor: BRAND.navy, color: "#FFFFFF", borderRadius: 3, marginTop: 3 } : {},
            ]}
          >
            <Text style={[s.text, strong ? { fontWeight: 700, color: "#FFFFFF" } : s.muted]}>{k}</Text>
            <Text style={[strong ? { fontWeight: 700, color: "#FFFFFF" } : s.bold]}>{clean(v)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

export type ContractDocData = Common & {
  title: string;
  number: string;
  date: string;
  client: string;
  contact?: string | null;
  summary: [string, string][];
  body: string;
  amc: { year: string; due: string; amount: string }[] | null;
};

export function ContractPdf(d: ContractDocData) {
  const s = styles(d.lang);
  return (
    <LetterheadDocument lang={d.lang} title={`${d.title} ${d.number}`} company={d.company} logo={d.logo} labels={{ page: d.L.pageFn, taxNo: d.L.taxNo, cr: d.L.cr }}>
      <Header lang={d.lang} title={d.title} meta={[[d.L.contractNo, d.number], [d.L.date, d.date]]} />
      <ToBlock lang={d.lang} L={d.L} client={d.client} contact={d.contact} />
      <KeyValueGrid lang={d.lang} items={d.summary} />
      <View style={{ marginTop: 14 }}>
        <TemplateBody text={d.body} lang={d.lang} />
      </View>
      {d.amc && d.amc.length > 0 && (
        <View wrap={false}>
          <Text style={s.h2}>{d.L.amcSchedule}</Text>
          <DataTable
            lang={d.lang}
            cols={[
              { label: d.L.year, width: "20%", align: "center" },
              { label: d.L.dueDate, width: "40%", align: "start" },
              { label: d.L.amount, width: "40%", align: "end" },
            ]}
            rows={d.amc.map((a) => [a.year, a.due, a.amount])}
          />
        </View>
      )}
      <Signatures lang={d.lang} left={d.L.forCompanyName} right={d.L.forClient} labels={{ signature: d.L.signature, name: d.L.name, stamp: d.L.stamp }} />
    </LetterheadDocument>
  );
}

// ---------------------------------------------------------------------------

export type AmcNoticeDocData = Common & {
  title: string;
  reference: string;
  date: string;
  client: string;
  contact?: string | null;
  summary: [string, string][];
  body: string;
  amountDue: string;
};

export function AmcNoticePdf(d: AmcNoticeDocData) {
  const s = styles(d.lang);
  return (
    <LetterheadDocument lang={d.lang} title={`${d.title} ${d.reference}`} company={d.company} logo={d.logo} labels={{ page: d.L.pageFn, taxNo: d.L.taxNo, cr: d.L.cr }}>
      <Header lang={d.lang} title={d.title} meta={[[d.L.noticeNo, d.reference], [d.L.date, d.date]]} />
      <ToBlock lang={d.lang} L={d.L} client={d.client} contact={d.contact} />
      <KeyValueGrid lang={d.lang} items={d.summary} />
      <View style={[s.row, { marginTop: 12, marginBottom: 12, padding: 12, borderRadius: 4, backgroundColor: BRAND.navy, justifyContent: "space-between", alignItems: "center" }]}>
        <Text style={[s.text, { color: "#FFFFFF", fontWeight: 600 }]}>{d.L.amountDue}</Text>
        <Text style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 15 }}>{clean(d.amountDue)}</Text>
      </View>
      <TemplateBody text={d.body} lang={d.lang} />
      <View style={{ marginTop: 24 }} wrap={false}>
        <Text style={[s.text, s.bold, { color: BRAND.navy }]}>{d.L.forCompanyName}</Text>
        <View style={[s.row, { marginTop: 22 }]}>
          <Text style={[s.text, s.muted, { width: 60 }]}>{d.L.signature}:</Text>
          <View style={{ width: 160, borderBottomWidth: 0.75, borderBottomColor: "#9AA7BD" }} />
        </View>
      </View>
    </LetterheadDocument>
  );
}

// ---------------------------------------------------------------------------

export type QuotationDocData = Common & {
  title: string;
  number: string;
  date: string;
  validUntil: string;
  client: string;
  contact?: string | null;
  subject?: string | null;
  intro: string;
  items: { n: string; title: string; scope?: string | null; delivery: string; qty: string; unitPrice: string; total: string }[];
  totals: [string, string, boolean?][];
  terms: string;
};

export function QuotationPdf(d: QuotationDocData) {
  const s = styles(d.lang);
  return (
    <LetterheadDocument lang={d.lang} title={`${d.title} ${d.number}`} company={d.company} logo={d.logo} labels={{ page: d.L.pageFn, taxNo: d.L.taxNo, cr: d.L.cr }}>
      <Header lang={d.lang} title={d.title} meta={[[d.L.quotationNo, d.number], [d.L.date, d.date], [d.L.validUntil, d.validUntil]]} />
      <ToBlock lang={d.lang} L={d.L} client={d.client} contact={d.contact} />
      {!!d.subject && <Text style={[s.text, s.bold, { marginBottom: 8, color: BRAND.royal }]}>{clean(d.subject)}</Text>}
      {!!d.intro && (
        <View style={{ marginBottom: 6 }}>
          <TemplateBody text={d.intro} lang={d.lang} />
        </View>
      )}
      <DataTable
        lang={d.lang}
        cols={[
          { label: "#", width: "6%", align: "center" },
          { label: d.L.item, width: "40%", align: "start" },
          { label: d.L.delivery, width: "15%", align: "start" },
          { label: d.L.qty, width: "8%", align: "center" },
          { label: d.L.unitPrice, width: "15%", align: "end" },
          { label: d.L.total, width: "16%", align: "end" },
        ]}
        rows={d.items.map((i) => [i.n, { main: i.title, sub: i.scope ?? undefined }, i.delivery, i.qty, i.unitPrice, i.total])}
      />
      <TotalsBox lang={d.lang} rows={d.totals} />
      {!!d.terms && (
        <View>
          <Text style={s.h2}>{d.L.terms}</Text>
          <TemplateBody text={d.terms} lang={d.lang} />
        </View>
      )}
      <Signatures lang={d.lang} left={d.L.forCompanyName} right={d.L.forClient} labels={{ signature: d.L.signature, name: d.L.name, stamp: d.L.stamp }} />
    </LetterheadDocument>
  );
}

// ---------------------------------------------------------------------------

export type DeliveryNoteDocData = Common & {
  title: string;
  number: string;
  date: string;
  client: string;
  contact?: string | null;
  summary: [string, string][];
  body: string;
  items: { n: string; title: string; scope?: string | null; delivered: string }[];
};

/** محضر تسليم — delivered items with signature blocks for both parties. */
export function DeliveryNotePdf(d: DeliveryNoteDocData) {
  const s = styles(d.lang);
  return (
    <LetterheadDocument lang={d.lang} title={`${d.title} ${d.number}`} company={d.company} logo={d.logo} labels={{ page: d.L.pageFn, taxNo: d.L.taxNo, cr: d.L.cr }}>
      <Header lang={d.lang} title={d.title} meta={[[d.L.projectNo, d.number], [d.L.date, d.date]]} />
      <ToBlock lang={d.lang} L={d.L} client={d.client} contact={d.contact} />
      {d.summary.length > 0 && <KeyValueGrid lang={d.lang} items={d.summary} />}
      <View style={{ marginTop: 10 }}>
        <TemplateBody text={d.body} lang={d.lang} />
      </View>
      <DataTable
        lang={d.lang}
        cols={[
          { label: "#", width: "7%", align: "center" },
          { label: d.L.deliveredItem, width: "68%", align: "start" },
          { label: d.L.deliveredOn, width: "25%", align: "start" },
        ]}
        rows={d.items.map((i) => [i.n, { main: i.title, sub: i.scope ?? undefined }, i.delivered])}
      />
      <View style={{ marginTop: 12 }} wrap={false}>
        <Text style={[s.text, s.bold]}>{d.L.remarks}:</Text>
        <View style={{ marginTop: 16, borderBottomWidth: 0.75, borderBottomColor: "#9AA7BD", borderStyle: "dotted" }} />
        <View style={{ marginTop: 16, borderBottomWidth: 0.75, borderBottomColor: "#9AA7BD", borderStyle: "dotted" }} />
      </View>
      <Signatures lang={d.lang} left={d.L.deliveredBy} right={d.L.receivedBy} labels={{ signature: d.L.signature, name: d.L.name, stamp: d.L.stamp }} />
    </LetterheadDocument>
  );
}
