import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/** Singleton settings row; created with defaults on first access. */
export const getSettings = cache(async () => {
  const existing = await db.settings.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return db.settings.create({
    data: { id: "default", companyNameAr: "العربية للحاسبات", companyNameEn: "Arab Computers" },
  });
});
