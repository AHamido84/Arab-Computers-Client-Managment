import { z } from "zod";
import { reqStr } from "./common";

/** Password policy: ≥ 10 chars with letters and digits. */
export const passwordSchema = z
  .string()
  .min(10, "users.passwordRule")
  .max(128, "validation.maxLength")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "users.passwordRule");

export const userCreateSchema = z.object({
  name: reqStr(120),
  email: z.string().trim().toLowerCase().pipe(z.email("validation.email")),
  role: z.enum(["ADMIN", "ACCOUNT_MANAGER", "VIEWER"]),
  locale: z.enum(["ar", "en"]),
  password: passwordSchema,
});

export const userUpdateSchema = z.object({
  name: reqStr(120),
  email: z.string().trim().toLowerCase().pipe(z.email("validation.email")),
  role: z.enum(["ADMIN", "ACCOUNT_MANAGER", "VIEWER"]),
  locale: z.enum(["ar", "en"]),
  active: z.boolean(),
});

export const changePasswordSchema = z
  .object({ current: z.string().min(1, "validation.required"), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "users.passwordMismatch" });

export const resetPasswordSchema = z
  .object({ token: z.string().min(20), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "users.passwordMismatch" });

export type UserCreateInput = z.input<typeof userCreateSchema>;
export type UserUpdateInput = z.input<typeof userUpdateSchema>;
