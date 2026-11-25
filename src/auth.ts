import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";

class InactiveAccount extends CredentialsSignin {
  code = "inactive";
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        if (!user) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        if (!user.active) throw new InactiveAccount();
        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, name: user.name, email: user.email, role: user.role, locale: user.locale };
      },
    }),
  ],
});
