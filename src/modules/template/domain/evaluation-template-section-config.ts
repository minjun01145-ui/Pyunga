export * from "./evaluation-template-section-config-canonical";

import { parseCompatibleEvaluationTemplateSectionConfig } from "./evaluation-template-section-config-compat";

export function parseEvaluationTemplateSectionConfig(value: unknown) {
  return parseCompatibleEvaluationTemplateSectionConfig(value);
}
