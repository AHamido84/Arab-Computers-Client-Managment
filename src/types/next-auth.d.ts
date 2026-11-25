import type { DefaultSession } from "next-auth";
import type { Role, Locale } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    role: Role;
    locale: Locale;
  }
  interface Session {
    user: { id: string; role: Role; locale: Locale } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    locale: Locale;
  }
}
