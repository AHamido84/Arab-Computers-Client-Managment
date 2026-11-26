/**
 * Demo data seed — 10 clients with contacts, contracts (with AMC schedules),
 * requests (with line items), quotations, templates and users.
 *
 *   npm run db:seed           (idempotent for settings/lookups/templates/users;
 *                              business data is only created on an empty DB)
 *
 * Demo logins (change immediately in production!):
 *   admin@arab-computers.com   / SEED_ADMIN_PASSWORD (default: Admin@12345)
 *   manager@arab-computers.com / Manager@12345
 *   viewer@arab-computers.com  / Viewer@12345
 *   dev@arab-computers.com     / Team@12345   (team member — sees only their delivery tasks)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type LookupKind } from "../src/generated/prisma/client";
import { generateAmcSchedule, defaultAmcStartDate, deriveAmcStatus } from "../src/lib/amc/engine";
import { formatDocNumber, counterScope } from "../src/lib/numbering";
import {
  DEFAULT_DOCUMENT_TEMPLATES,
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_QUOTATION_TERMS,
} from "../src/lib/templates/defaults";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
const daysFromToday = (n: number) => new Date(today.getTime() + n * 86_400_000);
const date = (s: string) => new Date(`${s}T00:00:00Z`);

async function nextNumber(kind: "contract" | "request" | "quotation" | "client", format: string, at = today) {
  const scope = counterScope(kind, format, at);
  const c = await db.counter.upsert({ where: { scope }, create: { scope, value: 1 }, update: { value: { increment: 1 } } });
  return formatDocNumber(format, c.value, at);
}

const LOOKUPS: Record<LookupKind, { key: string; ar: string; en: string; color?: string; system?: boolean }[]> = {
  CLIENT_STATUS: [
    { key: "LEAD", ar: "عميل محتمل", en: "Lead", color: "sky", system: true },
    { key: "ACTIVE", ar: "نشط", en: "Active", color: "green", system: true },
    { key: "UNDER_IMPLEMENTATION", ar: "قيد التنفيذ", en: "Under implementation", color: "amber", system: true },
    { key: "SUSPENDED", ar: "موقوف", en: "Suspended", color: "orange", system: true },
    { key: "CHURNED", ar: "مفقود", en: "Churned", color: "red", system: true },
  ],
  INDUSTRY: [
    { key: "MANUFACTURING", ar: "صناعة", en: "Manufacturing" },
    { key: "LOGISTICS", ar: "نقل وشحن", en: "Logistics & shipping" },
    { key: "TRADING", ar: "تجارة", en: "Trading" },
    { key: "HEALTHCARE", ar: "رعاية صحية", en: "Healthcare" },
    { key: "EDUCATION", ar: "تعليم", en: "Education" },
    { key: "REAL_ESTATE", ar: "عقارات", en: "Real estate" },
    { key: "FOOD", ar: "صناعات غذائية", en: "Food & beverage" },
  ],
  PRODUCT: [
    { key: "HR_PAYROLL", ar: "نظام الموارد البشرية والأجور", en: "HR & Payroll System" },
    { key: "ACCOUNTING", ar: "النظام المحاسبي", en: "Accounting System" },
    { key: "SHIPPING", ar: "نظام الشحن", en: "Shipping System" },
    { key: "ODOO_IMPL", ar: "تطبيق نظام أودو", en: "Odoo Implementation" },
    { key: "ODOO_SUPPORT", ar: "دعم أودو", en: "Odoo Support" },
  ],
  REQUEST_TYPE: [
    { key: "CHANGE_REQUEST", ar: "طلب تعديل", en: "Change request" },
    { key: "NEW_FEATURE", ar: "ميزة جديدة", en: "New feature" },
    { key: "SUPPORT", ar: "دعم فني", en: "Support" },
    { key: "REPORT", ar: "تقرير جديد", en: "New report" },
    { key: "TRAINING", ar: "تدريب", en: "Training" },
  ],
  PAYMENT_TERM: [
    { key: "ADVANCE_50", ar: "50٪ مقدم و50٪ عند التسليم", en: "50% advance, 50% on delivery" },
    { key: "THIRDS", ar: "ثلاث دفعات متساوية", en: "Three equal instalments" },
    { key: "FULL_ADVANCE", ar: "100٪ مقدم", en: "100% in advance" },
    { key: "NET_30", ar: "خلال 30 يومًا من الفاتورة", en: "Net 30 days" },
  ],
};

async function seedBase() {
  await db.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyNameAr: "العربية للحاسبات",
      companyNameEn: "Arab Computers",
      addressAr: "الإسكندرية، جمهورية مصر العربية",
      addressEn: "Alexandria, Egypt",
      phone: "+20 3 000 0000",
      email: "info@arab-computers.com",
      website: "arab-computers.com",
      emailFrom: "Arab Computers <no-reply@arab-computers.com>",
    },
  });

  for (const [kind, values] of Object.entries(LOOKUPS) as [LookupKind, (typeof LOOKUPS)[LookupKind]][]) {
    for (const [i, v] of values.entries()) {
      await db.lookupValue.upsert({
        where: { kind_key: { kind, key: v.key } },
        update: {},
        create: { kind, key: v.key, labelAr: v.ar, labelEn: v.en, color: v.color, sortOrder: i, isSystem: !!v.system },
      });
    }
  }

  for (const [kind, langs] of Object.entries(DEFAULT_DOCUMENT_TEMPLATES)) {
    for (const [lang, tpl] of Object.entries(langs)) {
      await db.documentTemplate.upsert({
        where: { kind_lang: { kind: kind as never, lang: lang as never } },
        update: {},
        create: { kind: kind as never, lang: lang as never, ...tpl },
      });
    }
  }
  for (const [kind, langs] of Object.entries(DEFAULT_EMAIL_TEMPLATES)) {
    for (const [lang, tpl] of Object.entries(langs)) {
      await db.emailTemplate.upsert({
        where: { kind_lang: { kind: kind as never, lang: lang as never } },
        update: {},
        create: { kind: kind as never, lang: lang as never, ...tpl },
      });
    }
  }

  const users = [
    { email: "admin@arab-computers.com", name: "System Admin", role: "ADMIN", password: process.env.SEED_ADMIN_PASSWORD || "Admin@12345", locale: "ar" },
    { email: "manager@arab-computers.com", name: "Mona Saleh", role: "ACCOUNT_MANAGER", password: "Manager@12345", locale: "ar" },
    { email: "karim@arab-computers.com", name: "Karim Fathy", role: "ACCOUNT_MANAGER", password: "Manager@12345", locale: "en" },
    { email: "viewer@arab-computers.com", name: "Sara Adel", role: "VIEWER", password: "Viewer@12345", locale: "en" },
    { email: "dev@arab-computers.com", name: "Omar Developer", role: "TEAM_MEMBER", password: "Team@12345", locale: "ar" },
  ] as const;
  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, role: u.role, locale: u.locale, passwordHash: await bcrypt.hash(u.password, 10) },
    });
  }
}

type ClientSeed = {
  ar: string;
  en: string;
  status: string;
  industry: string;
  lang: "ar" | "en";
  city: string;
  manager: string;
  contacts: { name: string; title: string; phone: string; email: string }[];
  contracts: {
    products: string[];
    date: string;
    value: number;
    amcPercent?: number;
    inc: number;
    method: "COMPOUND" | "SIMPLE";
    years?: number;
    status: "DRAFT" | "ACTIVE" | "EXPIRED" | "CANCELLED";
    paidYears?: number;
    terms: string;
  }[];
};

const CLIENTS: ClientSeed[] = [
  {
    ar: "شركة الإسكندرية للملاحة والشحن", en: "Alexandria Navigation & Shipping Co.", status: "ACTIVE", industry: "LOGISTICS", lang: "ar", city: "Alexandria", manager: "manager@arab-computers.com",
    contacts: [{ name: "م. حسام الدين عبد العزيز", title: "مدير تكنولوجيا المعلومات", phone: "+201001234567", email: "it@alexnav.example.com" }, { name: "أ. نهى إبراهيم", title: "مدير مالي", phone: "+201112223334", email: "finance@alexnav.example.com" }],
    contracts: [{ products: ["SHIPPING", "ACCOUNTING"], date: "2022-01-10", value: 450000, inc: 10, method: "COMPOUND", status: "ACTIVE", paidYears: 3, terms: "THIRDS" }],
  },
  {
    ar: "مصنع النيل للصناعات الغذائية", en: "Nile Food Industries", status: "ACTIVE", industry: "FOOD", lang: "ar", city: "Borg El Arab", manager: "manager@arab-computers.com",
    contacts: [{ name: "أ. محمود الشاذلي", title: "مدير الموارد البشرية", phone: "+201223344556", email: "hr@nilefood.example.com" }],
    contracts: [{ products: ["HR_PAYROLL"], date: "2024-12-20", value: 180000, inc: 15, method: "SIMPLE", status: "ACTIVE", terms: "ADVANCE_50" }],
  },
  {
    ar: "مجموعة المتوسط التجارية", en: "Mediterranean Trading Group", status: "ACTIVE", industry: "TRADING", lang: "en", city: "Alexandria", manager: "karim@arab-computers.com",
    contacts: [{ name: "Omar Khaled", title: "CFO", phone: "+201005556667", email: "omar.khaled@medtrading.example.com" }, { name: "Yasmine Fouad", title: "IT Manager", phone: "+201007778889", email: "y.fouad@medtrading.example.com" }],
    contracts: [{ products: ["ODOO_IMPL"], date: "2023-02-15", value: 620000, amcPercent: 12, inc: 8, method: "COMPOUND", status: "ACTIVE", paidYears: 1, terms: "THIRDS" }],
  },
  {
    ar: "مستشفى السلام الدولي", en: "Al Salam International Hospital", status: "ACTIVE", industry: "HEALTHCARE", lang: "ar", city: "Cairo", manager: "manager@arab-computers.com",
    contacts: [{ name: "د. رانيا منصور", title: "المدير الإداري", phone: "+201550001112", email: "admin@salamhospital.example.com" }],
    contracts: [
      { products: ["HR_PAYROLL"], date: "2021-11-01", value: 260000, inc: 10, method: "COMPOUND", status: "ACTIVE", paidYears: 3, terms: "ADVANCE_50" },
      { products: ["ACCOUNTING"], date: "2025-01-05", value: 210000, inc: 10, method: "SIMPLE", status: "ACTIVE", terms: "NET_30" },
    ],
  },
  {
    ar: "شركة دلتا للمقاولات والعقارات", en: "Delta Contracting & Real Estate", status: "UNDER_IMPLEMENTATION", industry: "REAL_ESTATE", lang: "ar", city: "Alexandria", manager: "karim@arab-computers.com",
    contacts: [{ name: "م. طارق السيد", title: "مدير المشروعات", phone: "+201229998887", email: "tarek@deltacr.example.com" }],
    contracts: [{ products: ["ODOO_IMPL", "HR_PAYROLL"], date: "2026-08-01", value: 540000, inc: 10, method: "COMPOUND", status: "ACTIVE", terms: "THIRDS" }],
  },
  {
    ar: "مدارس الرواد الدولية", en: "Al Rowad International Schools", status: "ACTIVE", industry: "EDUCATION", lang: "en", city: "Alexandria", manager: "karim@arab-computers.com",
    contacts: [{ name: "Heba Mostafa", title: "Finance Director", phone: "+201066554433", email: "heba@rowadschools.example.com" }],
    contracts: [{ products: ["ACCOUNTING", "HR_PAYROLL"], date: "2023-12-12", value: 320000, inc: 7.5, method: "SIMPLE", status: "ACTIVE", paidYears: 1, terms: "ADVANCE_50" }],
  },
  {
    ar: "شركة بورسعيد للحاويات", en: "Port Said Container Services", status: "SUSPENDED", industry: "LOGISTICS", lang: "en", city: "Port Said", manager: "manager@arab-computers.com",
    contacts: [{ name: "Ayman Rashad", title: "Operations Manager", phone: "+201288877766", email: "ayman@pscs.example.com" }],
    contracts: [{ products: ["SHIPPING"], date: "2020-06-01", value: 300000, inc: 10, method: "COMPOUND", status: "EXPIRED", years: 3, paidYears: 3, terms: "FULL_ADVANCE" }],
  },
  {
    ar: "الشركة العربية للبلاستيك", en: "Arab Plastics Company", status: "ACTIVE", industry: "MANUFACTURING", lang: "ar", city: "10th of Ramadan", manager: "manager@arab-computers.com",
    contacts: [{ name: "أ. وليد عبد الحميد", title: "رئيس الحسابات", phone: "+201011122233", email: "accounts@arabplastics.example.com" }],
    contracts: [{ products: ["ACCOUNTING"], date: "2024-11-28", value: 150000, inc: 12, method: "COMPOUND", status: "ACTIVE", terms: "ADVANCE_50" }],
  },
  {
    ar: "شركة الفنار للتجارة والتوزيع", en: "Al Fanar Trading & Distribution", status: "LEAD", industry: "TRADING", lang: "ar", city: "Alexandria", manager: "karim@arab-computers.com",
    contacts: [{ name: "أ. شريف عزت", title: "المدير العام", phone: "+201277766655", email: "sherif@alfanar.example.com" }],
    contracts: [{ products: ["ODOO_IMPL"], date: "2026-11-15", value: 380000, inc: 10, method: "COMPOUND", status: "DRAFT", terms: "THIRDS" }],
  },
  {
    ar: "مجموعة سيناء للأسمدة", en: "Sinai Fertilizers Group", status: "CHURNED", industry: "MANUFACTURING", lang: "en", city: "Suez", manager: "manager@arab-computers.com",
    contacts: [{ name: "Nader Helmy", title: "HR Manager", phone: "+201099988877", email: "nader@sinaifert.example.com" }],
    contracts: [{ products: ["HR_PAYROLL"], date: "2019-03-01", value: 120000, inc: 10, method: "SIMPLE", status: "CANCELLED", years: 2, paidYears: 1, terms: "FULL_ADVANCE" }],
  },
];

async function seedBusiness() {
  if ((await db.client.count()) > 0) {
    console.log("• Business data exists — skipping demo clients/contracts.");
    return;
  }
  const settings = await db.settings.findUniqueOrThrow({ where: { id: "default" } });
  const lookup = async (kind: LookupKind, key: string) =>
    (await db.lookupValue.findUniqueOrThrow({ where: { kind_key: { kind, key } } })).id;
  const userId = async (email: string) => (await db.user.findUniqueOrThrow({ where: { email } })).id;
  const types = await db.lookupValue.findMany({ where: { kind: "REQUEST_TYPE" } });
  const termsMap = Object.fromEntries(LOOKUPS.PAYMENT_TERM.map((p) => [p.key, p]));

  for (const c of CLIENTS) {
    const client = await db.client.create({
      data: {
        code: await nextNumber("client", settings.clientCodeFormat),
        nameAr: c.ar,
        nameEn: c.en,
        statusId: await lookup("CLIENT_STATUS", c.status),
        industryId: await lookup("INDUSTRY", c.industry),
        preferredLang: c.lang,
        city: c.city,
        address: c.city,
        accountManagerId: await userId(c.manager),
        contacts: {
          create: c.contacts.map((p, i) => ({ name: p.name, jobTitle: p.title, phone: p.phone, whatsapp: p.phone, email: p.email, isPrimary: i === 0 })),
        },
      },
    });
    await db.activity.create({ data: { clientId: client.id, type: "client.created", summary: "Client created (seed)" } });

    for (const k of c.contracts) {
      const contractDate = date(k.date);
      const amcStart = defaultAmcStartDate(contractDate);
      const years = k.years ?? 5;
      const amcPercent = k.amcPercent ?? 10;
      const lines = generateAmcSchedule({
        contractValue: k.value, amcPercent, increasePercent: k.inc, method: k.method, startDate: amcStart, years,
      });
      const term = termsMap[k.terms];
      const contract = await db.contract.create({
        data: {
          number: await nextNumber("contract", settings.contractNumberFormat, contractDate),
          clientId: client.id,
          contractDate,
          startDate: contractDate,
          value: k.value,
          currency: "EGP",
          paymentTerms: c.lang === "ar" ? term.ar : term.en,
          status: k.status,
          amcPercent,
          amcIncreasePercent: k.inc,
          amcMethod: k.method,
          amcStartDate: amcStart,
          amcYears: years,
          products: { create: await Promise.all(k.products.map(async (p) => ({ productId: await lookup("PRODUCT", p) }))) },
          amcLines: {
            create: lines.map((l) => {
              const paid = l.yearIndex <= (k.paidYears ?? 0) && l.dueDate <= today;
              return {
                yearIndex: l.yearIndex,
                dueDate: l.dueDate,
                amount: l.amount,
                status: paid ? "PAID" : deriveAmcStatus({ dueDate: l.dueDate }, today),
                paidAt: paid ? new Date(l.dueDate.getTime() + 10 * 86_400_000) : null,
                paidAmount: paid ? l.amount : null,
              };
            }),
          },
        },
      });
      await db.activity.create({ data: { clientId: client.id, type: "contract.created", refType: "contract", refId: contract.id, summary: `Contract ${contract.number}` } });
    }
  }

  // ---- Requests -----------------------------------------------------------
  const clients = await db.client.findMany({ include: { contracts: true }, orderBy: { code: "asc" } });
  const mgr = await userId("manager@arab-computers.com");
  const karim = await userId("karim@arab-computers.com");
  const reqSeeds = [
    { ci: 0, title: "Customs clearance module", titleAr: "موديول التخليص الجمركي", type: "NEW_FEATURE", priority: "HIGH", status: "QUOTED", due: 20, items: [["Analysis & design", 1, 15000], ["Development", 1, 45000], ["Training (2 days)", 2, 4000]] },
    { ci: 0, title: "Container tracking report", titleAr: "تقرير تتبع الحاويات", type: "REPORT", priority: "MEDIUM", status: "IN_PROGRESS", due: -5, items: [["Report development", 1, 8000]] },
    { ci: 1, title: "Overtime rules for night shift", titleAr: "قواعد الوقت الإضافي للوردية الليلية", type: "CHANGE_REQUEST", priority: "MEDIUM", status: "UNDER_STUDY", due: 10, items: [["Rule engine changes", 1, 12000]] },
    { ci: 2, title: "Odoo e-invoicing integration (ETA)", titleAr: "ربط الفاتورة الإلكترونية مع منظومة الضرائب", type: "NEW_FEATURE", priority: "URGENT", status: "APPROVED", due: 3, items: [["ETA integration", 1, 55000], ["Testing & go-live", 1, 10000]] },
    { ci: 3, title: "Medical insurance deductions", titleAr: "استقطاعات التأمين الطبي", type: "CHANGE_REQUEST", priority: "HIGH", status: "NEW", due: 14, items: [] },
    { ci: 3, title: "Cost-centre P&L report", titleAr: "تقرير أرباح وخسائر مراكز التكلفة", type: "REPORT", priority: "LOW", status: "DELIVERED", due: -20, items: [["Report", 1, 6000]] },
    { ci: 4, title: "Odoo project module customisation", titleAr: "تخصيص موديول المشروعات في أودو", type: "NEW_FEATURE", priority: "HIGH", status: "IN_PROGRESS", due: -2, items: [["Customisation", 40, 900]] },
    { ci: 5, title: "Staff training — payroll closing", titleAr: "تدريب الموظفين على إقفال الرواتب", type: "TRAINING", priority: "LOW", status: "CLOSED", due: -40, items: [["Training day", 1, 3500]] },
    { ci: 7, title: "Fixed assets depreciation fix", titleAr: "إصلاح حساب إهلاك الأصول الثابتة", type: "SUPPORT", priority: "URGENT", status: "IN_PROGRESS", due: 1, items: [] },
    { ci: 8, title: "Odoo demo & requirements workshop", titleAr: "ورشة متطلبات وعرض أودو", type: "NEW_FEATURE", priority: "MEDIUM", status: "QUOTED", due: 30, items: [["Workshop (2 days)", 2, 7500], ["Requirements document", 1, 12000]] },
    { ci: 2, title: "Multi-warehouse transfer approval", titleAr: "اعتماد التحويلات بين المخازن", type: "CHANGE_REQUEST", priority: "MEDIUM", status: "REJECTED", due: -10, items: [["Workflow", 1, 9000]] },
  ] as const;

  const createdRequests: { id: string; clientId: string; items: { item: string; qty: number; unitPrice: number }[]; title: string; due: Date }[] = [];
  for (const [i, r] of reqSeeds.entries()) {
    const cl = clients[r.ci];
    const typeId = types.find((t) => t.key === r.type)?.id;
    const reqDate = daysFromToday(-30 + i);
    const due = daysFromToday(r.due);
    const req = await db.clientRequest.create({
      data: {
        number: await nextNumber("request", settings.requestNumberFormat, reqDate),
        clientId: cl.id,
        contractId: cl.contracts[0]?.id,
        typeId,
        title: cl.preferredLang === "ar" ? r.titleAr : r.title,
        description: cl.preferredLang === "ar" ? `تفاصيل الطلب: ${r.titleAr}` : `Details: ${r.title}`,
        priority: r.priority,
        status: r.status,
        assigneeId: i % 2 ? karim : mgr,
        requestDate: reqDate,
        dueDate: due,
        estimatedHours: r.items.length ? 8 * r.items.length : null,
        vatPercent: settings.vatPercent,
        sortOrder: i,
        closedAt: ["CLOSED", "REJECTED"].includes(r.status) ? daysFromToday(r.due) : null,
        items: { create: r.items.map(([item, qty, price], j) => ({ item, qty, unitPrice: price, sortOrder: j })) },
      },
    });
    createdRequests.push({ id: req.id, clientId: cl.id, title: req.title, due, items: r.items.map(([item, qty, unitPrice]) => ({ item, qty, unitPrice })) });
  }

  // ---- Quotations (for QUOTED requests) -----------------------------------
  const quoted = createdRequests.filter((_, i) => reqSeeds[i].status === "QUOTED" || reqSeeds[i].status === "APPROVED");
  for (const [i, r] of quoted.entries()) {
    const cl = clients.find((c) => c.id === r.clientId)!;
    const issue = daysFromToday(-7 - i);
    const status = (["SENT", "ACCEPTED", "DRAFT"] as const)[i % 3];
    await db.quotation.create({
      data: {
        number: await nextNumber("quotation", settings.quotationNumberFormat, issue),
        clientId: cl.id,
        title: r.title,
        status,
        lang: cl.preferredLang,
        issueDate: issue,
        validUntil: new Date(issue.getTime() + settings.quotationValidityDays * 86_400_000),
        currency: "EGP",
        vatPercent: settings.vatPercent,
        terms: DEFAULT_QUOTATION_TERMS[cl.preferredLang],
        sentAt: status !== "DRAFT" ? issue : null,
        decidedAt: status === "ACCEPTED" ? daysFromToday(-2) : null,
        items: {
          create: r.items.map((it, j) => ({
            requestId: r.id, title: it.item, scope: `${it.item} — ${r.title}`, qty: it.qty, unitPrice: it.unitPrice, dueDate: r.due, sortOrder: j,
          })),
        },
      },
    });
  }
  console.log(`• Created ${clients.length} clients, ${createdRequests.length} requests, ${quoted.length} quotations.`);
}

async function main() {
  await seedBase();
  await seedBusiness();
  console.log("✔ Seed complete. Admin login: admin@arab-computers.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
