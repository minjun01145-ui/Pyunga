import { z } from "zod";

export const EVALUATION_DOCUMENT_STYLES = [
  { id: "standard", label: "표준형", description: "중앙 제목과 옅은 회색 표 머리글을 사용합니다." },
  { id: "official", label: "공문형", description: "명조 제목과 이중 구분선으로 문서의 구획을 표시합니다." },
  { id: "compact", label: "간결형", description: "왼쪽 제목과 좁은 간격으로 내용을 간결하게 배치합니다." },
] as const;

export const MAX_SCHOOL_LOGO_BYTES = 180_000;

export const schoolLogoSchema = z.string().max(240_100).refine((value) => {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  try {
    const bytes = atob(match[2]);
    if (bytes.length > MAX_SCHOOL_LOGO_BYTES) return false;
    if (match[1] === "png") return bytes.startsWith("\x89PNG\r\n\x1a\n");
    if (match[1] === "jpeg") return bytes.startsWith("\xff\xd8\xff");
    return bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
  } catch {
    return false;
  }
}, "PNG, JPEG 또는 WebP 교표 이미지를 선택해 주세요.");

export const evaluationTemplatePresentationSchema = z.object({
  style: z.enum(["standard", "official", "compact"]),
  schoolName: z.string().trim().max(80),
  logoDataUrl: schoolLogoSchema.optional(),
}).strict();

export type EvaluationTemplatePresentation = z.infer<typeof evaluationTemplatePresentationSchema>;

export const evaluationAcademicPeriodSchema = z.object({
  academicYear: z.number().int().min(2000).max(2100),
  semester: z.union([z.literal(1), z.literal(2)]),
}).strict();

export type EvaluationAcademicPeriod = z.infer<typeof evaluationAcademicPeriodSchema>;

export function resolveEvaluationTemplatePresentation(
  presentation?: EvaluationTemplatePresentation,
): EvaluationTemplatePresentation {
  return presentation ?? { style: "standard", schoolName: "" };
}
