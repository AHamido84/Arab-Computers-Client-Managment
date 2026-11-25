"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <EmptyState
      icon={AlertTriangle}
      title={t("error")}
      action={<Button onClick={reset}>{t("retry")}</Button>}
    />
  );
}
