import { describe, expect, it } from "vitest";

import { createPrototypeAssessment } from "../ui/prototype/create-prototype-assessment";
import { performanceAssessmentDraftSchema } from "./performance-assessment-draft";

describe("performanceAssessmentDraftSchema", () => {
  it("accepts the valid prototype assessment", () => {
    expect(performanceAssessmentDraftSchema.safeParse(createPrototypeAssessment()).success).toBe(true);
  });

  it("rejects a draft whose section total differs from the assessment score", () => {
    const assessment = createPrototypeAssessment();
    assessment.sections[0] = { ...assessment.sections[0], maxScore: 29 };

    expect(performanceAssessmentDraftSchema.safeParse(assessment).success).toBe(false);
  });

  it("rejects oversized free text before it reaches Firestore", () => {
    const assessment = createPrototypeAssessment();
    assessment.sections[0] = { ...assessment.sections[0], title: "가".repeat(121) };

    expect(performanceAssessmentDraftSchema.safeParse(assessment).success).toBe(false);
  });
});
