"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setLocaleAction } from "@/server/actions/auth";

/** Switches AR ⇄ EN. Saved to the user's profile and a cookie. */
export function LanguageToggle() {
  const locale = useLocale();
  const t = useTranslations("header");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setLocaleAction(locale === "ar" ? "en" : "ar");
          router.refresh();
        })
      }
      title={t("language")}
    >
      <Languages />
      <span>{t("switchTo")}</span>
    </Button>
  );
}
