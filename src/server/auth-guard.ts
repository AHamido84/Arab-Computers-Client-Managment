import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/generated/prisma/enums";

/**
 * Permission matrix. Keep all role logic here so it is easy to audit.
 *  - ADMIN: everything
 *  - ACCOUNT_MANAGER: manage business data and send emails; no settings/users
 *  - VIEWER: read-only
 */
export type Permission =
  | "read"
  | "write" // create/update clients, contracts, requests, quotations
  | "delete"
  | "sendEmail"
  | "manageSettings"
  | "manageUsers";

const matrix: Record<Role, Permission[]> = {
  ADMIN: ["read", "write", "delete", "sendEmail", "manageSettings", "manageUsers"],
  ACCOUNT_MANAGER: ["read", "write", "delete", "sendEmail"],
  VIEWER: ["read"],
};

export const can = (role: Role | undefined, p: Permission) => !!role && matrix[role].includes(p);

export class ForbiddenError extends Error {
  constructor() {
    super("FORBIDDEN");
  }
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** For pages: redirects to /login when signed out. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For server actions / route handlers: throws when the permission is missing. */
export async function requirePermission(p: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError();
  if (!can(user.role, p)) throw new ForbiddenError();
  return user;
}

/** For pages that need a permission: redirect home instead of throwing. */
export async function requirePagePermission(p: Permission) {
  const user = await requireUser();
  if (!can(user.role, p)) redirect("/?forbidden=1");
  return user;
}
