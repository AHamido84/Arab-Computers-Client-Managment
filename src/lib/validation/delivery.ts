import { z } from "zod";
import { optDateStr, optNum, optStr, reqStr, dateStr, num } from "./common";
import { TASK_STATUSES } from "@/lib/delivery";

const assignee = z.object({ userId: z.string().min(1), role: z.enum(["LEAD", "MEMBER"]) });

/** At most one lead per task. */
const assigneeList = z
  .array(assignee)
  .max(20)
  .refine((a) => a.filter((x) => x.role === "LEAD").length <= 1, "tasks.leadRequired")
  .refine((a) => new Set(a.map((x) => x.userId)).size === a.length, "validation.invalid");

export const draftTaskSchema = z.object({
  title: reqStr(200),
  scope: optStr(5000),
  price: optNum({ min: 0, max: 1e10 }),
  estimatedHours: optNum({ min: 0, max: 100000 }),
  startDate: optDateStr,
  dueDate: optDateStr,
  requestId: z.string().nullish().transform((v) => v || null),
  quotationItemId: z.string().nullish().transform((v) => v || null),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assignees: assigneeList.default([]),
  watchers: z.array(z.string()).max(30).default([]),
});

export const createProjectSchema = z.object({
  source: z.enum(["QUOTATION", "CONTRACT", "MANUAL"]),
  sourceId: z.string().nullish(),
  clientId: z.string().min(1),
  title: reqStr(200),
  startDate: optDateStr,
  targetDate: optDateStr,
  notes: optStr(5000),
  tasks: z.array(draftTaskSchema).min(1, "delivery.needTasks").max(300),
});
export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  title: reqStr(200),
  status: z.enum(["ACTIVE", "ON_HOLD", "DELIVERED", "CLIENT_ACCEPTED", "CANCELLED"]),
  startDate: optDateStr,
  targetDate: optDateStr,
  notes: optStr(5000),
});

/** Fields only managers may edit. */
export const taskManagerPatchSchema = z
  .object({
    title: reqStr(200),
    scope: optStr(5000),
    price: optNum({ min: 0, max: 1e10 }),
    estimatedHours: optNum({ min: 0, max: 100000 }),
    startDate: optDateStr,
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  })
  .partial();

/** Fields assignees may edit. */
export const taskWorkPatchSchema = z
  .object({
    status: z.enum(TASK_STATUSES),
    progress: num({ min: 0, max: 100, int: true }),
    delayReason: optStr(2000),
  })
  .partial();

export const dueDateChangeSchema = z.object({
  newDate: optDateStr,
  reason: z.string().trim().min(3, "tasks.reasonRequired").max(1000, "validation.maxLength"),
});

export const timeLogSchema = z.object({
  date: dateStr,
  hours: num({ min: 0.25, max: 24 }),
  note: optStr(500),
});

export const commentSchema = z.object({ body: z.string().trim().min(1, "validation.required").max(5000, "validation.maxLength") });
export const checklistSchema = z.object({ title: reqStr(300) });
