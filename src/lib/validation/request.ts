import { z } from "zod";
import { currencyCode, dateStr, num, optDateStr, optId, optNum, optStr, reqStr } from "./common";

export const REQUEST_STATUSES = ["NEW", "UNDER_STUDY", "QUOTED", "APPROVED", "IN_PROGRESS", "DELIVERED", "CLOSED", "REJECTED"] as const;
export const OPEN_REQUEST_STATUSES = ["NEW", "UNDER_STUDY", "QUOTED", "APPROVED", "IN_PROGRESS"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const lineItemSchema = z.object({
  id: z.string().optional(),
  item: reqStr(200),
  description: optStr(2000),
  qty: num({ min: 0, max: 1e6 }),
  unitPrice: num({ min: 0, max: 1e10 }),
});

export const requestSchema = z
  .object({
    clientId: reqStr(50),
    contractId: optId,
    typeId: optId,
    title: reqStr(200),
    description: optStr(10000),
    priority: z.enum(PRIORITIES),
    assigneeId: optId,
    requestDate: dateStr,
    dueDate: optDateStr,
    estimatedHours: optNum({ min: 0, max: 100000 }),
    status: z.enum(REQUEST_STATUSES),
    currency: currencyCode,
    discount: num({ min: 0, max: 1e10 }),
    vatPercent: num({ min: 0, max: 100 }),
    items: z.array(lineItemSchema).max(200),
  })
  .refine((r) => !r.dueDate || r.dueDate >= r.requestDate, { path: ["dueDate"], message: "validation.dateOrder" });

export type RequestInput = z.input<typeof requestSchema>;

/** Request is overdue when it is still open and its due date has passed. */
export function isRequestOverdue(r: { status: string; dueDate: Date | string | null }, today: Date) {
  if (!r.dueDate || !(OPEN_REQUEST_STATUSES as readonly string[]).includes(r.status)) return false;
  return new Date(r.dueDate).getTime() < today.getTime();
}
