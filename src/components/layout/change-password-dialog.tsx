"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { changeOwnPasswordAction } from "@/server/actions/users";

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const { pending, run } = useServerAction();
  const [v, setV] = useState({ current: "", password: "", confirm: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const close = () => {
    onOpenChange(false);
    setV({ current: "", password: "", confirm: "" });
    setErr({});
  };
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("changePassword")}</DialogTitle>
          <DialogDescription>{t("passwordRule")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {(["current", "password", "confirm"] as const).map((k) => (
            <FormField key={k} label={t(k === "current" ? "currentPassword" : k === "password" ? "newPassword" : "confirmPassword")} htmlFor={`cp-${k}`} error={err[k]}>
              <Input
                id={`cp-${k}`}
                type="password"
                dir="ltr"
                autoComplete={k === "current" ? "current-password" : "new-password"}
                value={v[k]}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
              />
            </FormField>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>{tc("cancel")}</Button>
          <Button disabled={pending} onClick={() => run(() => changeOwnPasswordAction(v), { success: "users.passwordChanged", onSuccess: close, onError: (r) => setErr(r.fieldErrors ?? {}) })}>
            {pending && <Loader2 className="animate-spin" />} {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
