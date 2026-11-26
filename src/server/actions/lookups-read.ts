"use server";

import { requirePermission } from "@/server/auth-guard";
import { getQuotableRequests } from "@/server/services/requests";

/** Open requests of a client for the quotation builder. */
export async function getQuotableRequestsAction(clientId: string) {
  await requirePermission("read");
  return getQuotableRequests(clientId);
}
