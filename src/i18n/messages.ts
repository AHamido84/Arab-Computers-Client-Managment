/**
 * Server-side message loader for contexts without a request locale
 * (PDF rendering, cron emails) where the language comes from the client
 * preference instead of the current user.
 */
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import type { AppLocale } from "./config";

export const allMessages = { ar, en } as const;
export type Messages = typeof en;
export const messagesFor = (l: AppLocale): Messages => allMessages[l] as Messages;
