"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/forms/form-field";
import { useServerAction } from "@/components/forms/use-action";
import { StatusBadge } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";
import { adminSetPasswordAction, createUserAction, updateUserAction } from "@/server/actions/users";

export type UserRow = { id: string; name: string; email: string; role: "ADMIN" | "ACCOUNT_MANAGER" | "VIEWER" | "TEAM_MEMBER"; locale: "ar" | "en"; active: boolean; lastLoginAt: string | null };
type Form = { name: string; email: string; role: UserRow["role"]; locale: "ar" | "en"; active: boolean; password: string };
const ROLES = ["ADMIN", "ACCOUNT_MANAGER", "TEAM_MEMBER", "VIEWER"] as const;

export function UsersManager({ users, meId }: { users: UserRow[]; meId: string }) {
  const t = useTranslations();
  const f = useFmt();
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [pwFor, setPwFor] = useState<UserRow | null>(null);
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">{t("users.rolesHelp")}</p>
        <Button onClick={() => setEditing("new")}>
          <Plus /> {t("users.new")}
        </Button>
      </div>
      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("users.name")}</TableHead>
                <TableHead>{t("users.email")}</TableHead>
                <TableHead>{t("users.role")}</TableHead>
                <TableHead>{t("users.language")}</TableHead>
                <TableHead>{t("users.status")}</TableHead>
                <TableHead>{t("users.lastLogin")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className={u.active ? "" : "opacity-60"}>
                  <TableCell className="font-medium">
                    {u.name} {u.id === meId && <span className="text-xs text-muted-foreground">({t("users.you")})</span>}
                  </TableCell>
                  <TableCell dir="ltr">{u.email}</TableCell>
                  <TableCell>
                    <StatusBadge color={{ ADMIN: "violet", ACCOUNT_MANAGER: "blue", TEAM_MEMBER: "sky", VIEWER: "slate" }[u.role]}>{t(`roles.${u.role}`)}</StatusBadge>
                  </TableCell>
                  <TableCell>{t(`languages.${u.locale}`)}</TableCell>
                  <TableCell>{u.active ? t("users.active") : t("users.inactive")}</TableCell>
                  <TableCell>{u.lastLoginAt ? f.dateTime(u.lastLoginAt) : t("users.never")}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon-sm" aria-label={`${t("common.edit")} ${u.name}`} onClick={() => setEditing(u)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`${t("users.setPassword")} ${u.name}`} onClick={() => setPwFor(u)}>
                        <KeyRound />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <UserDialog state={editing} onClose={() => setEditing(null)} />
      <PasswordDialog user={pwFor} onClose={() => setPwFor(null)} />
    </>
  );
}

function UserDialog({ state, onClose }: { state: UserRow | "new" | null; onClose: () => void }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const isNew = state === "new";
  const init: Form = state && state !== "new" ? { ...state, password: "" } : { name: "", email: "", role: "ACCOUNT_MANAGER", locale: "ar", active: true, password: "" };
  const [v, setV] = useState<Form>(init);
  const [err, setErr] = useState<Record<string, string>>({});
  const [key, setKey] = useState<unknown>(null);
  if (key !== state) {
    setKey(state);
    setV(init);
    setErr({});
  }
  const save = () =>
    run<unknown>(() => (isNew ? createUserAction(v) : updateUserAction((state as UserRow).id, v)), {
      success: isNew ? "users.created" : "users.updated",
      onSuccess: () => {
        onClose();
        router.refresh();
      },
      onError: (r) => setErr(r.fieldErrors ?? {}),
    });
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? t("users.new") : t("users.edit")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label={t("users.name")} htmlFor="u-name" error={err.name} required>
            <Input id="u-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </FormField>
          <FormField label={t("users.email")} htmlFor="u-email" error={err.email} required>
            <Input id="u-email" type="email" dir="ltr" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("users.role")}>
              <Select value={v.role} onValueChange={(r) => setV({ ...v, role: r as Form["role"] })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label={t("users.language")}>
              <Select value={v.locale} onValueChange={(l) => setV({ ...v, locale: l as "ar" | "en" })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">{t("languages.ar")}</SelectItem>
                  <SelectItem value="en">{t("languages.en")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          {isNew ? (
            <FormField label={t("users.password")} htmlFor="u-pw" error={err.password} hint={t("users.passwordRule")} required>
              <Input id="u-pw" type="password" autoComplete="new-password" dir="ltr" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
            </FormField>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={v.active} onCheckedChange={(a) => setV({ ...v, active: a })} /> {t("users.active")}
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const t = useTranslations();
  const { pending, run } = useServerAction();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | undefined>();
  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) { onClose(); setPw(""); setErr(undefined); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.setPasswordTitle", { name: user?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("users.passwordRule")}</DialogDescription>
        </DialogHeader>
        <FormField label={t("users.newPassword")} htmlFor="admin-pw" error={err}>
          <Input id="admin-pw" type="password" autoComplete="new-password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => adminSetPasswordAction(user!.id, pw), {
                success: "users.passwordChanged",
                onSuccess: () => { setPw(""); onClose(); },
                onError: (r) => setErr(Object.values(r.fieldErrors ?? {})[0] ?? r.error),
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />} {t("users.setPassword")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
