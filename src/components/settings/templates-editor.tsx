"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PLACEHOLDERS } from "@/lib/templates/defaults";
import { SAMPLE_VARS } from "@/lib/templates/sample";
import { fillPlaceholders } from "@/lib/templates/render";
import { getDefaultTemplateAction, saveDocumentTemplateAction, saveEmailTemplateAction } from "@/server/actions/settings";

type Lang = "ar" | "en";
export type TemplateEntry = { type: "document" | "email"; kind: string; lang: Lang; title: string; body: string };

const PLACEHOLDER_GROUPS: Record<string, (keyof typeof PLACEHOLDERS)[]> = {
  CONTRACT: ["common", "contract"],
  AMC_RENEWAL: ["common", "contract", "amc"],
  QUOTATION: ["common", "quotation"],
  AMC_REMINDER: ["common", "contract", "amc"],
  AMC_OVERDUE: ["common", "contract", "amc"],
  REQUEST_UPDATE: ["common"],
};

export function TemplatesEditor({ templates }: { templates: TemplateEntry[] }) {
  const t = useTranslations();
  const [type, setType] = useState<"document" | "email">("document");
  const kinds = [...new Set(templates.filter((x) => x.type === type).map((x) => x.kind))];
  const [kind, setKind] = useState(kinds[0]);
  const [lang, setLang] = useState<Lang>("ar");
  const current = templates.find((x) => x.type === type && x.kind === kind && x.lang === lang) ?? templates.find((x) => x.type === type)!;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={type}
          onValueChange={(v) => {
            const nt = v as "document" | "email";
            setType(nt);
            setKind(templates.find((x) => x.type === nt)!.kind);
          }}
        >
          <TabsList>
            <TabsTrigger value="document">{t("settings.templatesDocuments")}</TabsTrigger>
            <TabsTrigger value="email">{t("settings.templatesEmails")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={kind} onValueChange={setKind}>
          <TabsList>
            {kinds.map((k) => (
              <TabsTrigger key={k} value={k}>
                {t(`settings.${type === "email" && (k === "QUOTATION" || k === "CONTRACT") ? `tpl_EMAIL_${k}` : `tpl_${k}`}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={lang} onValueChange={(v) => setLang(v as Lang)}>
          <TabsList>
            <TabsTrigger value="ar">{t("languages.ar")}</TabsTrigger>
            <TabsTrigger value="en">{t("languages.en")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {/* key: reset editor state when switching template */}
      <Editor key={`${current.type}-${current.kind}-${current.lang}`} entry={current} />
    </div>
  );
}

function Editor({ entry }: { entry: TemplateEntry }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);
  const [err, setErr] = useState<Record<string, string>>({});
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dir = entry.lang === "ar" ? "rtl" : "ltr";
  const dirty = title !== entry.title || body !== entry.body;
  const vars = SAMPLE_VARS[entry.lang];
  const placeholders = useMemo(() => [...new Set((PLACEHOLDER_GROUPS[entry.kind] ?? ["common"]).flatMap((g) => PLACEHOLDERS[g]))], [entry.kind]);

  function insert(p: string) {
    const el = bodyRef.current;
    const token = `{{${p}}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const save = () =>
    run(
      () => (entry.type === "document" ? saveDocumentTemplateAction(entry.kind as never, entry.lang, { title, body }) : saveEmailTemplateAction(entry.kind as never, entry.lang, { title, body })),
      {
        success: "common.saved",
        onSuccess: () => router.refresh(),
        onError: (r) => setErr(r.fieldErrors ?? {}),
      },
    );

  return (
    <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
      <Card>
        <CardContent className="space-y-4">
          <FormField label={entry.type === "email" ? t("settings.templateSubject") : t("settings.templateTitle")} htmlFor="tplTitle" error={err.title}>
            <Input id="tplTitle" dir={dir} value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label={t("settings.templateBody")} htmlFor="tplBody" error={err.body}>
            <Textarea id="tplBody" ref={bodyRef} dir={dir} rows={18} value={body} onChange={(e) => setBody(e.target.value)} className="leading-relaxed" />
          </FormField>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("settings.placeholders")} <span className="font-normal text-muted-foreground">— {t("settings.placeholdersHint")}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {placeholders.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => insert(p)}
                  className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs hover:border-primary hover:bg-accent"
                  dir="ltr"
                >
                  {`{{${p}}}`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ConfirmDialog
              destructive={false}
              title={t("settings.resetDefault")}
              description={t("common.confirm")}
              confirmLabel={t("settings.resetDefault")}
              trigger={
                <Button type="button" variant="ghost">
                  <RotateCcw /> {t("settings.resetDefault")}
                </Button>
              }
              onConfirm={async () => {
                const d = await getDefaultTemplateAction(entry.type, entry.kind, entry.lang);
                setTitle(d.title);
                setBody(d.body);
                toast.info(t("settings.unsaved"));
              }}
            />
            <div className="flex items-center gap-3">
              {dirty && <span className="text-xs text-warning">{t("settings.unsaved")}</span>}
              <Button type="button" onClick={save} disabled={pending || !dirty}>
                {pending && <Loader2 className="animate-spin" />} {t("common.save")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.preview")}</CardTitle>
        </CardHeader>
        <CardContent dir={dir} className="space-y-3">
          <p className="font-semibold">{fillPlaceholders(title, vars)}</p>
          <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">{fillPlaceholders(body, vars)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
