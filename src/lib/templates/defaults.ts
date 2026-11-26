/**
 * Default document & email templates (AR / EN).
 * Used by the seed script and by Settings → "Reset to default".
 *
 * Placeholders use {{snake_case}} and are listed in PLACEHOLDERS so the
 * template editor can offer them. Unknown placeholders are left as-is.
 */

export const PLACEHOLDERS = {
  common: ["company_name", "company_phone", "company_email", "company_website", "today", "client_name", "contact_name"],
  contract: ["contract_number", "contract_date", "contract_start_date", "contract_value", "currency", "products", "payment_terms", "amc_percent", "amc_start_date", "amc_increase_percent", "amc_method"],
  amc: ["contract_number", "products", "amc_year", "amc_amount", "due_date", "days_remaining", "days_overdue", "currency"],
  quotation: ["quotation_number", "quotation_version", "quotation_date", "valid_until", "quotation_total", "currency"],
  request: ["request_number", "request_title", "request_status", "due_date"],
  delivery: ["project_number", "project_title", "delivery_date", "items_count", "reference"],
} as const;

type Lang = "ar" | "en";
type DocKind = "CONTRACT" | "AMC_RENEWAL" | "QUOTATION" | "DELIVERY_NOTE";
type MailKind = "AMC_REMINDER" | "AMC_OVERDUE" | "QUOTATION" | "CONTRACT" | "REQUEST_UPDATE" | "DELIVERY_NOTE";

export const DEFAULT_DOCUMENT_TEMPLATES: Record<DocKind, Record<Lang, { title: string; body: string }>> = {
  CONTRACT: {
    en: {
      title: "Software License & Services Contract",
      body: `This contract is made on {{contract_date}} between {{company_name}} ("the Company") and {{client_name}} ("the Client").

1. Subject
The Company shall supply, install and implement the following system(s): {{products}}.

2. Contract value
The total contract value is {{contract_value}}, payable as follows: {{payment_terms}}.

3. Commencement
Work starts on {{contract_start_date}}.

4. Annual maintenance (AMC)
After the warranty year, the Client shall pay an annual maintenance fee of {{amc_percent}}% of the contract value, starting {{amc_start_date}}, with an annual increase of {{amc_increase_percent}}% ({{amc_method}}). The AMC covers technical support, bug fixes and version updates.

5. Confidentiality
Both parties shall keep all information exchanged under this contract confidential.

6. Governing law
This contract is governed by the laws of the Arab Republic of Egypt; the courts of Alexandria have jurisdiction.`,
    },
    ar: {
      title: "عقد ترخيص برمجيات وتقديم خدمات",
      body: `حُرِّر هذا العقد بتاريخ {{contract_date}} بين {{company_name}} (ويُشار إليها بـ"الشركة") و{{client_name}} (ويُشار إليه بـ"العميل").

البند الأول: موضوع العقد
تلتزم الشركة بتوريد وتركيب وتشغيل النظام/الأنظمة التالية: {{products}}.

البند الثاني: قيمة العقد
القيمة الإجمالية للعقد {{contract_value}}، تُسدَّد وفقًا لما يلي: {{payment_terms}}.

البند الثالث: بدء التنفيذ
يبدأ التنفيذ اعتبارًا من {{contract_start_date}}.

البند الرابع: عقد الصيانة السنوي
بعد انتهاء سنة الضمان يلتزم العميل بسداد رسوم صيانة سنوية بنسبة {{amc_percent}}٪ من قيمة العقد اعتبارًا من {{amc_start_date}}، بزيادة سنوية قدرها {{amc_increase_percent}}٪ ({{amc_method}})، وتشمل الصيانة الدعم الفني وإصلاح الأخطاء وتحديثات الإصدارات.

البند الخامس: السرية
يلتزم الطرفان بالحفاظ على سرية كافة المعلومات المتبادلة بموجب هذا العقد.

البند السادس: القانون الواجب التطبيق
يخضع هذا العقد لقوانين جمهورية مصر العربية، وتختص محاكم الإسكندرية بنظر أي نزاع ينشأ عنه.`,
    },
  },
  AMC_RENEWAL: {
    en: {
      title: "Annual Maintenance Renewal Notice",
      body: `Dear {{contact_name}},

We would like to remind you that the annual maintenance contract for {{products}} (contract no. {{contract_number}}) is due for renewal.

Maintenance year: {{amc_year}}
Due date: {{due_date}}
Amount due: {{amc_amount}}

Renewing on time guarantees uninterrupted technical support, updates and fixes. Kindly arrange payment on or before the due date.

Thank you for your continued trust in {{company_name}}.`,
    },
    ar: {
      title: "إشعار تجديد عقد الصيانة السنوي",
      body: `السيد/ة {{contact_name}} المحترم/ة،

نود تذكيركم بأن عقد الصيانة السنوي الخاص بـ {{products}} (عقد رقم {{contract_number}}) مستحق التجديد.

سنة الصيانة: {{amc_year}}
تاريخ الاستحقاق: {{due_date}}
المبلغ المستحق: {{amc_amount}}

يضمن التجديد في الموعد استمرار الدعم الفني والتحديثات دون انقطاع. نرجو التكرم بالسداد في موعد أقصاه تاريخ الاستحقاق.

شاكرين لكم ثقتكم الدائمة في {{company_name}}.`,
    },
  },
  QUOTATION: {
    en: {
      title: "Quotation",
      body: `Dear {{contact_name}},

Further to your request, we are pleased to submit our quotation no. {{quotation_number}} for the items below. This offer is valid until {{valid_until}}.`,
    },
    ar: {
      title: "عرض سعر",
      body: `السيد/ة {{contact_name}} المحترم/ة،

بالإشارة إلى طلبكم، يسعدنا أن نقدم لكم عرض السعر رقم {{quotation_number}} للبنود الموضحة أدناه، ويسري هذا العرض حتى {{valid_until}}.`,
    },
  },
  DELIVERY_NOTE: {
    en: {
      title: "Delivery Note",
      body: `On {{delivery_date}}, {{company_name}} delivered to {{client_name}} the items listed below for project {{project_number}} — {{project_title}} (ref. {{reference}}).

The client confirms receipt of the delivered scope and that it was tested and accepted, subject to any remarks noted below. Signing this note starts the warranty period and the annual maintenance terms agreed in the contract.

Remarks:
…………………………………………………………………………`,
    },
    ar: {
      title: "محضر تسليم",
      body: `إنه في يوم {{delivery_date}} قامت {{company_name}} بتسليم {{client_name}} البنود الموضحة أدناه الخاصة بمشروع رقم {{project_number}} — {{project_title}} (المرجع {{reference}}).

ويقر العميل باستلام نطاق العمل المسلَّم واختباره وقبوله، مع مراعاة أي ملاحظات مدونة أدناه، ويبدأ بالتوقيع على هذا المحضر سريان فترة الضمان وشروط الصيانة السنوية المتفق عليها في العقد.

ملاحظات:
…………………………………………………………………………`,
    },
  },
};

export const DEFAULT_QUOTATION_TERMS: Record<Lang, string> = {
  en: `1. All prices are in {{currency}} and exclude any items not explicitly listed.
2. 50% advance payment upon approval; balance upon delivery.
3. Delivery dates start from receipt of the advance payment and approved requirements.
4. Any change in scope after approval will be quoted separately.
5. This quotation is valid until {{valid_until}}.`,
  ar: `1. جميع الأسعار بعملة {{currency}} ولا تشمل أي بنود غير مذكورة صراحةً.
2. دفعة مقدمة 50٪ عند الموافقة، والباقي عند التسليم.
3. تبدأ مواعيد التسليم من تاريخ استلام الدفعة المقدمة واعتماد المتطلبات.
4. أي تعديل على نطاق العمل بعد الاعتماد يتم تسعيره بشكل منفصل.
5. يسري هذا العرض حتى {{valid_until}}.`,
};

export const DEFAULT_EMAIL_TEMPLATES: Record<MailKind, Record<Lang, { subject: string; body: string }>> = {
  AMC_REMINDER: {
    en: {
      subject: "AMC renewal — {{contract_number}} due {{due_date}}",
      body: `Dear {{contact_name}},

This is a friendly reminder that the annual maintenance for {{products}} (contract {{contract_number}}, year {{amc_year}}) is due on {{due_date}}.

Amount due: {{amc_amount}}

Please find the renewal notice attached. Do not hesitate to contact us for any clarification.

Best regards,
{{company_name}}
{{company_phone}} · {{company_website}}`,
    },
    ar: {
      subject: "تجديد عقد الصيانة — {{contract_number}} المستحق في {{due_date}}",
      body: `السيد/ة {{contact_name}} المحترم/ة،

تحية طيبة وبعد،

نود تذكيركم بأن موعد تجديد عقد الصيانة السنوي الخاص بـ {{products}} (عقد رقم {{contract_number}}، السنة {{amc_year}}) هو {{due_date}}.

المبلغ المستحق: {{amc_amount}}

مرفق إشعار التجديد، ولا تترددوا في التواصل معنا لأي استفسار.

مع خالص التحية،
{{company_name}}
{{company_phone}} · {{company_website}}`,
    },
  },
  AMC_OVERDUE: {
    en: {
      subject: "Overdue AMC payment — {{contract_number}}",
      body: `Dear {{contact_name}},

Our records show that the annual maintenance payment for {{products}} (contract {{contract_number}}, year {{amc_year}}) of {{amc_amount}} was due on {{due_date}} and is now {{days_overdue}} days overdue.

To avoid any interruption of support services, kindly arrange the payment at your earliest convenience. If you have already paid, please disregard this message and share the payment reference with us.

Best regards,
{{company_name}}`,
    },
    ar: {
      subject: "تأخر سداد رسوم الصيانة — {{contract_number}}",
      body: `السيد/ة {{contact_name}} المحترم/ة،

تحية طيبة وبعد،

تشير سجلاتنا إلى أن رسوم الصيانة السنوية الخاصة بـ {{products}} (عقد رقم {{contract_number}}، السنة {{amc_year}}) بقيمة {{amc_amount}} كانت مستحقة بتاريخ {{due_date}}، وقد مضى على استحقاقها {{days_overdue}} يومًا.

تجنبًا لأي توقف في خدمات الدعم، نرجو التكرم بسرعة السداد. وفي حال تم السداد بالفعل، نرجو تجاهل هذه الرسالة وموافاتنا بمرجع الدفع.

مع خالص التحية،
{{company_name}}`,
    },
  },
  QUOTATION: {
    en: {
      subject: "Quotation {{quotation_number}} — {{company_name}}",
      body: `Dear {{contact_name}},

Please find attached our quotation {{quotation_number}} with a total of {{quotation_total}}, valid until {{valid_until}}.

We are happy to discuss any detail at your convenience.

Best regards,
{{company_name}}`,
    },
    ar: {
      subject: "عرض سعر رقم {{quotation_number}} — {{company_name}}",
      body: `السيد/ة {{contact_name}} المحترم/ة،

تحية طيبة وبعد،

مرفق لسيادتكم عرض السعر رقم {{quotation_number}} بإجمالي {{quotation_total}}، ويسري حتى {{valid_until}}.

يسعدنا مناقشة أي تفاصيل في الوقت المناسب لكم.

مع خالص التحية،
{{company_name}}`,
    },
  },
  CONTRACT: {
    en: {
      subject: "Contract {{contract_number}} — {{company_name}}",
      body: `Dear {{contact_name}},

Please find attached contract {{contract_number}} for {{products}}.

Kindly review, sign and return a copy to us.

Best regards,
{{company_name}}`,
    },
    ar: {
      subject: "العقد رقم {{contract_number}} — {{company_name}}",
      body: `السيد/ة {{contact_name}} المحترم/ة،

تحية طيبة وبعد،

مرفق لسيادتكم العقد رقم {{contract_number}} الخاص بـ {{products}}.

نرجو التكرم بالمراجعة والتوقيع وإعادة نسخة إلينا.

مع خالص التحية،
{{company_name}}`,
    },
  },
  REQUEST_UPDATE: {
    en: {
      subject: "Update on your request {{request_number}} — {{company_name}}",
      body: `Dear {{contact_name}},

We would like to update you on your request "{{request_title}}" ({{request_number}}).

Current status: {{request_status}}
Target date: {{due_date}}

Please let us know if you have any questions.

Best regards,
{{company_name}}`,
    },
    ar: {
      subject: "تحديث بشأن طلبكم {{request_number}} — {{company_name}}",
      body: `السيد/ة {{contact_name}} المحترم/ة،

تحية طيبة وبعد،

نود إفادتكم بآخر مستجدات طلبكم "{{request_title}}" (رقم {{request_number}}).

الحالة الحالية: {{request_status}}
التاريخ المستهدف: {{due_date}}

لا تترددوا في التواصل معنا لأي استفسار.

مع خالص التحية،
{{company_name}}`,
    },
  },
  DELIVERY_NOTE: {
    en: {
      subject: "Delivery note — {{project_number}} — {{company_name}}",
      body: `Dear {{contact_name}},

We are pleased to inform you that all items of project {{project_number}} — {{project_title}} ({{items_count}} items) have been delivered.

Please find attached the delivery note. Kindly review it, sign and stamp it, and send us a copy.

Best regards,
{{company_name}}`,
    },
    ar: {
      subject: "محضر تسليم — {{project_number}} — {{company_name}}",
      body: `السيد/ة {{contact_name}} المحترم/ة،

تحية طيبة وبعد،

يسعدنا إفادتكم بأنه تم تسليم جميع بنود المشروع رقم {{project_number}} — {{project_title}} (عدد {{items_count}} بند).

مرفق لسيادتكم محضر التسليم، نرجو التكرم بمراجعته وتوقيعه وختمه وموافاتنا بنسخة منه.

مع خالص التحية،
{{company_name}}`,
    },
  },
};
