export type SchoolSubject = {
  id: string;
  name: string;
  legacyNames: string[];
  activeForPlans: boolean;
  revision: number;
  updatedAt: number;
};

export function normalizeSubjectName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function validateSubjectName(value: string): string | null {
  const normalized = normalizeSubjectName(value);
  if (!normalized) return "과목명을 입력해 주세요.";
  if (normalized.length > 80) return "과목명은 80자 이내로 입력해 주세요.";
  return null;
}
