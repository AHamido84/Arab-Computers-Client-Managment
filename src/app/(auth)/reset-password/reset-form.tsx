"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { resetPasswordAction } from "@/server/actions/users";

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("users");
  const { pending, run } = useServerAction();
  const [v, setV] = useState({ password: "", confirm: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  if (done)
    return (
      <div className="grid gap-4">
        <Alert>
          <AlertDescription>{t("resetDone")}</AlertDescription>
        </Alert>
        <Button asChild>
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
      </div>
    );
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => resetPasswordAction({ token, ...v }), { onSuccess: () => setDone(true), onError: (r) => setErr(r.fieldErrors ?? {}) });
      }}
    >
      <FormField label={t("newPassword")} htmlFor="rp-pw" error={err.password}>
        <Input id="rp-pw" type="password" dir="ltr" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
      </FormField>
      <FormField label={t("confirmPassword")} htmlFor="rp-confirm" error={err.confirm}>
        <Input id="rp-confirm" type="password" dir="ltr" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {t("resetTitle")}
      </Button>
      <Link href="/forgot-password" className="text-center text-sm text-primary hover:underline">
        {t("forgotTitle")}
      </Link>
    </form>
  );
}
