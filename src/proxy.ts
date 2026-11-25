import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Optimistic auth gate: unauthenticated users are redirected to /login
 * (via the `authorized` callback in auth.config.ts).
 * Role checks are enforced again in every server action / route handler.
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Skip static assets, Next internals, auth endpoints and the cron endpoint (secret-protected).
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|brand|fonts|favicon.ico|icon.png|.*\\.(?:png|jpg|svg|webp|ico|ttf)$).*)"],
};
