import { z } from "zod";

import { getAcademicCalendarEventIssues, isRealIsoDate } from "../domain/academic-calendar-validation";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealIsoDate);

export const academicCalendarSaveSchema = z.object({
  academicYear: z.number().int().min(2000).max(2100),
  events: z
    .array(
      z.object({
        academicYear: z.number().int().min(2000).max(2100),
        title: z.string().trim().min(1).max(120),
        type: z.enum(["written_exam", "school_event", "vacation", "other"]),
        semester: z.union([z.literal(1), z.literal(2)]),
        startDate: isoDateSchema,
        endDate: isoDateSchema.optional(),
        targetGrades: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).max(3),
        writtenExamKind: z.enum(["midterm", "final", "other"]).optional(),
        sourceText: z.string().trim().min(1).max(300),
      }),
    )
    .min(1)
    .max(500),
}).superRefine((value, context) => {
  const eventKeys = new Set<string>();

  value.events.forEach((event, index) => {
    if (event.academicYear !== value.academicYear) {
      context.addIssue({
        code: "custom",
        path: ["events", index, "academicYear"],
        message: "학년도가 일치하지 않습니다.",
      });
    }
    for (const issue of getAcademicCalendarEventIssues(event, value.academicYear)) {
      context.addIssue({ code: "custom", path: ["events", index], message: issue });
    }

    const eventKey = [event.type, event.title, event.startDate, event.endDate ?? "", event.targetGrades.join(",")].join("|");
    if (eventKeys.has(eventKey)) {
      context.addIssue({ code: "custom", path: ["events", index], message: "동일한 일정이 중복되어 있습니다." });
    }
    eventKeys.add(eventKey);
  });
});

export type AcademicCalendarSaveInput = z.infer<typeof academicCalendarSaveSchema>;
