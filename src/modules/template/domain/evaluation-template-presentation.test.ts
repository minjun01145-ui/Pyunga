import { describe, expect, it } from "vitest";
import { createDefaultEvaluationTemplate } from "./default-evaluation-template";
import { evaluationTemplatePresentationSchema, schoolLogoSchema, EVALUATION_DOCUMENT_STYLES } from "./evaluation-template-presentation";
import { parseEvaluationTemplateSaveInput } from "../application/evaluation-template-save";
import { buildRawEvaluationPlanDocument } from "@/modules/document-export/application/raw-evaluation-plan-document";
import { createEmptyEvaluationPlanDraft, getEvaluationPlanTemplateSignature } from "@/modules/evaluation-plan";

const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZ8AAAAASUVORK5CYII=";

describe("school document presentation", () => {
  it.each(EVALUATION_DOCUMENT_STYLES)("round-trips $id and keeps teacher data attached", ({ id }) => {
    const template = createDefaultEvaluationTemplate();
    const next = parseEvaluationTemplateSaveInput({ ...template, presentation: { style: id, schoolName: "가온중학교", logoDataUrl: logo } });
    expect(next).not.toBeNull();
    if (!next) throw new Error("Template expected");
    expect(getEvaluationPlanTemplateSignature(next)).toBe(getEvaluationPlanTemplateSignature(template));
    const document = buildRawEvaluationPlanDocument(next, createEmptyEvaluationPlanDraft());
    expect(document.presentation).toEqual(next.presentation);
    expect(document.sections).toEqual(buildRawEvaluationPlanDocument(template, createEmptyEvaluationPlanDraft()).sections);
  });

  it("defaults old school templates to the standard style without requiring a logo", () => {
    const view = buildRawEvaluationPlanDocument({ sections: [] }, createEmptyEvaluationPlanDraft());
    expect(view.presentation).toEqual({ style: "standard", schoolName: "" });
  });

  it.each(["https://example.com/logo.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,PHNjcmlwdD4=", "javascript:alert(1)", "data:image/png;base64,broken"])("rejects unsafe or invalid logo %s", (value) => {
    expect(schoolLogoSchema.safeParse(value).success).toBe(false);
  });

  it("rejects oversized logos and unsupported presentation fields", () => {
    expect(schoolLogoSchema.safeParse(`data:image/png;base64,${btoa("\x89PNG\r\n\x1a\n" + "x".repeat(180_000))}`).success).toBe(false);
    expect(evaluationTemplatePresentationSchema.safeParse({ style: "standard", schoolName: "학교", html: "<script>" }).success).toBe(false);
    expect(evaluationTemplatePresentationSchema.safeParse({ style: "fancy", schoolName: "학교" }).success).toBe(false);
  });
});
