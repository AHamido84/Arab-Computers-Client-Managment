"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, FileText, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/forms/form-field";
import { unresolvedPlaceholders } from "@/lib/templates/render";
import { splitEmails } from "@/lib/validation/email";
import { sendEmailAction } from "@/server/actions/email";
import type { ComposeDraft } from "@/server/services/compose";
import { cn } from "@/lib/utils";

export function ComposeForm({ draft, devOutbox }: { draft: ComposeDraft; devOutbox: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [to, setTo] = useState<string[]>(draft.defaultTo);
  const [extraTo, setExtraTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [attach, setAttach] = useState(true);
  const [markSent, setMarkSent] = useState(draft.quotationStatus === "DRAFT");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const dirty = subject !== draft.subject || body !== draft.body;
  const unresolved = useMemo(() => unresolvedPlaceholders(`${subject}\n${body}`), [subject, body]);
  const dir = draft.lang === "ar" ? "rtl" : "ltr";

  function switchLang(lang: "ar" | "en") {
    if (lang === draft.lang) return;
    if (dirty && !window.confirm(t("email.langSwitchConfirm"))) return;
    router.replace(`/emails/compose?kind=${draft.kind}&id=${draft.id}&lang=${lang}`);
  }

  async function send() {
    setPending(true);
    setErrors({});
    const r = await sendEmailAction({
      kind: draft.kind,
      id: draft.id,
      lang: draft.lang,
      to: [...to, ...splitEmails(extraTo)],
      cc: splitEmails(cc),
      subject,
      body,
      attach: attach && draft.kind !== "request",
      markQuotationSent: markSent,
    });
    setPending(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      const first = r.error === "validation.invalid" ? Object.values(r.fieldErrors ?? {})[0] : undefined;
      const key = first && t.has(first) ? first : r.error;
      toast.error(t.has(key) ? t(key) : t("common.error"));
      return;
    }
    toast.success(r.data.provider === "outbox" ? t("email.sentOutbox") : t("email.sent"));
    router.push(`/clients/${r.data.clientId}?tab=emails`);
    router.refresh();
  }

  const fieldErr = (prefix: string) => Object.entries(errors).find(([k]) => k === prefix || k.startsWith(prefix + "."))?.[1];

  return (
    <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
      <Card className="xl:col-span-2">
        <CardContent className="space-y-4">
          {devOutbox && (
            <Alert>
              <AlertDescription>{t("email.devOutboxBanner")}</AlertDescription>
            </Alert>
          )}
          <FormField label={t("email.to")} error={fieldErr("to")} required>
            {draft.contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("email.noContactEmails")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {draft.contacts.map((c) => {
                  const on = to.includes(c.email);
                  return (
                    <label
                      key={c.email}
                      className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", on && "border-primary bg-accent/40")}
                    >
                      <Checkbox checked={on} onCheckedChange={(v) => setTo((cur) => (v ? [...cur, c.email] : cur.filter((x) => x !== c.email)))} />
                      <span>
                        <span className="block font-medium" dir="auto">
                          {c.name}
                        </span>
                        <span className="block text-xs text-muted-foreground" dir="ltr">
                          {c.email}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t("email.otherRecipients")} hint={t("email.emailsHint")} htmlFor="extraTo">
              <Input id="extraTo" dir="ltr" value={extraTo} onChange={(e) => setExtraTo(e.target.value)} placeholder="name@company.com" />
            </FormField>
            <FormField label={t("email.cc")} hint={t("email.emailsHint")} htmlFor="cc" error={fieldErr("cc")}>
              <Input id="cc" dir="ltr" value={cc} onChange={(e) => setCc(e.target.value)} />
            </FormField>
          </div>
          <FormField label={t("email.subject")} htmlFor="subject" error={fieldErr("subject")} required>
            <Input id="subject" dir={dir} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </FormField>
          <FormField label={t("email.body")} htmlFor="body" error={fieldErr("body")} required>
            <Textarea id="body" dir={dir} rows={16} value={body} onChange={(e) => setBody(e.target.value)} className="font-[inherit] leading-relaxed" />
          </FormField>
          {unresolved.length > 0 && (
            <p className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="size-4" /> {t("email.unresolved", { list: unresolved.join(", ") })}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("email.language")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label={t("email.language")}>
              {(["ar", "en"] as const).map((l) => (
                <Button key={l} type="button" size="sm" variant={draft.lang === l ? "secondary" : "ghost"} aria-pressed={draft.lang === l} onClick={() => switchLang(l)}>
                  {t(`languages.${l}`)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
        {draft.kind !== "request" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("email.attachment")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <FileText className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium" dir="ltr">
                {draft.attachmentName}
              </span>
              <Button asChild variant="ghost" size="sm">
                <a href={`/api/pdf/${draft.kind}/${draft.id}?lang=${draft.lang}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> {t("email.previewPdf")}
                </a>
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={attach} onCheckedChange={(v) => setAttach(!!v)} /> {t("email.attach")}
            </label>
            {draft.kind === "quotation" && draft.quotationStatus === "DRAFT" && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={markSent} onCheckedChange={(v) => setMarkSent(!!v)} /> {t("email.markSent")}
              </label>
            )}
          </CardContent>
        </Card>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            {t("common.cancel")}
          </Button>
          <Button onClick={send} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Send className="rtl:-scale-x-100" />}
            {pending ? t("email.sending") : t("email.send")}
          </Button>
        </div>
      </div>
    </div>
  );
}
