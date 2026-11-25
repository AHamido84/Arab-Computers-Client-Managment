"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut, auth } from "@/auth";
import { db } from "@/lib/db";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

export type LoginState = { error?: "invalidCredentials" | "inactive" } | undefined;

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code;
      return { error: code === "inactive" ? "inactive" : "invalidCredentials" };
    }
    throw e;
  }
  // Remember the user's language: apply their saved preference on login.
  const user = await db.user.findUnique({ where: { email }, select: { locale: true } });
  if (user) (await cookies()).set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  redirect(safeCallbackPath(String(formData.get("callbackUrl") || "/")));
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

/** Switch UI language; persisted on the user record and in a cookie. */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  const session = await auth();
  if (session?.user?.id) {
    await db.user.update({ where: { id: session.user.id }, data: { locale } });
  }
}

/** Only allow redirects back into this app (prevents open redirects). */
function safeCallbackPath(raw: string): string {
  try {
    const url = new URL(raw, "http://local");
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/login")) return "/";
    return path;
  } catch {
    return "/";
  }
}
