import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no DB / bcrypt imports) shared by `src/proxy.ts`
 * and the full config in `src/auth.ts`.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  trustHost: true,
  providers: [],
  callbacks: {
    /** Optimistic route protection used by the proxy. Real checks happen server-side. */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password");
      if (isPublic) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.locale = user.locale;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role;
      session.user.locale = token.locale;
      return session;
    },
  },
} satisfies NextAuthConfig;
