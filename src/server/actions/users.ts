"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { createTranslator } from "next-intl";
import { db } from "@/lib/db";
import { messagesFor } from "@/i18n/messages";
import {
  changePasswordSchema,
  passwordSchema,
  resetPasswordSchema,
  userCreateSchema,
  userUpdateSchema,
  type UserCreateInput,
  type UserUpdateInput,
} from "@/lib/validation/user";
import { getCurrentUser, requirePermission } from "@/server/auth-guard";
import { DomainError, runAction } from "@/server/action-result";
import { audit } from "@/server/services/audit";
import { emailHtml, sendMail } from "@/server/services/email";
import { getSettings } from "@/server/services/settings";

const strip = <T extends { passwordHash?: string }>(u: T) => {
  const { passwordHash: _p, ...rest } = u;
  void _p;
  return rest;
};

export async function createUserAction(input: UserCreateInput) {
  return runAction(async () => {
    const admin = await requirePermission("manageUsers");
    const { password, ...data } = userCreateSchema.parse(input);
    const u = await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 12) } });
    await audit(db, { actorId: admin.id, action: "CREATE", entity: "User", entityId: u.id, after: strip(u) });
    revalidatePath("/settings/users");
    return { id: u.id };
  });
}

export async function updateUserAction(id: string, input: UserUpdateInput) {
  return runAction(async () => {
    const admin = await requirePermission("manageUsers");
    const data = userUpdateSchema.parse(input);
    const before = await db.user.findUniqueOrThrow({ where: { id } });
    // Never lock the organisation out: keep at least one active admin, and admins can't demote/deactivate themselves.
    if (id === admin.id && (data.role !== "ADMIN" || !data.active)) throw new DomainError("users.cannotDemoteSelf");
    if (before.role === "ADMIN" && (data.role !== "ADMIN" || !data.active)) {
      const others = await db.user.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
      if (others === 0) throw new DomainError("users.lastAdmin");
    }
    const after = await db.user.update({ where: { id }, data });
    await audit(db, { actorId: admin.id, action: "UPDATE", entity: "User", entityId: id, before: strip(before), after: strip(after) });
    revalidatePath("/settings/users");
  });
}

/** Admin sets a new password for a user (e.g. a forgotten one). */
export async function adminSetPasswordAction(id: string, password: string) {
  return runAction(async () => {
    const admin = await requirePermission("manageUsers");
    const pw = passwordSchema.parse(password);
    await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(pw, 12) } });
    await audit(db, { actorId: admin.id, action: "UPDATE", entity: "User", entityId: id, after: { password: "reset by admin" } });
  });
}

/** Any signed-in user changes their own password. */
export async function changeOwnPasswordAction(input: { current: string; password: string; confirm: string }) {
  return runAction(async () => {
    const me = await getCurrentUser();
    if (!me) throw new DomainError("auth.forbidden");
    const data = changePasswordSchema.parse(input);
    const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await bcrypt.compare(data.current, user.passwordHash))) {
      const { z } = await import("zod");
      throw new z.ZodError([{ code: "custom", path: ["current"], message: "users.currentWrong", input: "" }]);
    }
    await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(data.password, 12) } });
    await audit(db, { actorId: me.id, action: "UPDATE", entity: "User", entityId: me.id, after: { password: "changed by user" } });
  });
}

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/**
 * Forgot password: emails a one-hour reset link. Always returns ok so the
 * form never reveals whether an address has an account.
 */
export async function requestPasswordResetAction(email: string) {
  return runAction(async () => {
    const addr = String(email ?? "").trim().toLowerCase();
    const user = addr ? await db.user.findUnique({ where: { email: addr } }) : null;
    if (!user || !user.active) return;
    // Throttle: at most one link per 2 minutes per user.
    const recent = await db.passwordResetToken.findFirst({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 120_000) } } });
    if (recent) return;
    const token = crypto.randomBytes(32).toString("base64url");
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) } });
    const s = await getSettings();
    const t = createTranslator({ locale: user.locale, messages: messagesFor(user.locale), namespace: "users" });
    const link = `${process.env.APP_URL ?? ""}/reset-password?token=${token}`;
    const text = t("resetEmailBody", { name: user.name, link });
    try {
      await sendMail({
        to: [user.email],
        subject: t("resetEmailSubject"),
        text,
        html: emailHtml(text, { lang: user.locale, companyName: user.locale === "ar" ? s.companyNameAr : s.companyNameEn }),
      });
    } catch (e) {
      console.error("password reset email failed", e);
    }
  });
}

export async function resetPasswordAction(input: { token: string; password: string; confirm: string }) {
  return runAction(async () => {
    const data = resetPasswordSchema.parse(input);
    const row = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(data.token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new DomainError("users.resetInvalid");
    await db.$transaction([
      db.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(data.password, 12) } }),
      db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      db.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null, id: { not: row.id } } }),
    ]);
    await audit(db, { actorId: row.userId, action: "UPDATE", entity: "User", entityId: row.userId, after: { password: "reset via email link" } });
  });
}
