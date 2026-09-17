import { z } from "zod";

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
        issues: z.array(z.string().max(300)).max(10),
      }),
    )
    .min(1)
    .max(500),
}).superRefine((value, context) => {
  value.events.forEach((event, index) => {
    if (event.academicYear !== value.academicYear) {
      context.addIssue({
        code: "custom",
        path: ["events", index, "academicYear"],
        message: "학년도가 일치하지 않습니다.",
      });
    }
    if (event.endDate && event.endDate < event.startDate) {
      context.addIssue({
        code: "custom",
        path: ["events", index, "endDate"],
        message: "종료일이 시작일보다 빠릅니다.",
      });
    }
  });
});

export type AcademicCalendarSaveInput = z.infer<typeof academicCalendarSaveSchema>;

function isRealIsoDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
