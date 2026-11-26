import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { ComposeForm } from "@/components/email/compose-form";
import { requirePagePermission } from "@/server/auth-guard";
import { COMPOSE_KINDS, prepareEmail, type ComposeKind } from "@/server/services/compose";
import { emailStatus } from "@/server/services/email";

export async function generateMetadata() {
  return { title: (await getTranslations("email"))("compose") };
}

export default async function ComposePage({ searchParams }: PageProps<"/emails/compose">) {
  await requirePagePermission("sendEmail");
  const sp = (await searchParams) as { kind?: string; id?: string; lang?: string };
  if (!sp.id || !COMPOSE_KINDS.includes(sp.kind as ComposeKind)) notFound();
  const lang = sp.lang === "ar" || sp.lang === "en" ? sp.lang : undefined;
  const [t, locale, draft, status] = await Promise.all([getTranslations("email"), getLocale(), prepareEmail(sp.kind as ComposeKind, sp.id, lang), emailStatus()]);
  if (!draft) notFound();
  return (
    <>
      <PageHeader
        title={t("compose")}
        description={
          <span>
            {locale === "ar" ? draft.client.nameAr : draft.client.nameEn} · <span dir="ltr">{draft.reference}</span> — {t("composeHint")}
          </span>
        }
      />
      {/* key: remount when language changes so the new template text is loaded */}
      <ComposeForm key={draft.lang} draft={draft} devOutbox={status.devOutbox} />
    </>
  );
}
