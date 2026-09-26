import {
  normalizeEvaluationTemplateSections,
  type EvaluationTemplate,
} from "./evaluation-template";
import { createDefaultEvaluationTemplateSectionConfig } from "./evaluation-template-section-config";

export function createDefaultEvaluationTemplate(): EvaluationTemplate {
  const teachingLearningConfig = createDefaultEvaluationTemplateSectionConfig("teaching_learning_table");
  if (teachingLearningConfig.type !== "teaching_learning_table") {
    throw new Error("Default teaching-learning config is invalid");
  }

  return {
    documentTitle: "교수학습 및 평가 계획",
    sections: normalizeEvaluationTemplateSections([
      {
        id: "teaching-learning",
        title: "교수학습-평가 방법",
        level: 1,
        config: {
          ...teachingLearningConfig,
          calendarRows: { enabled: true, periodUnit: "month" },
        },
      },
      {
        id: "evaluation-details",
        title: "평가 세부계획",
        level: 1,
        config: createDefaultEvaluationTemplateSectionConfig("title_only"),
      },
      {
        id: "evaluation-overview",
        title: "평가 개요",
        level: 2,
        config: createDefaultEvaluationTemplateSectionConfig("title_only"),
      },
      {
        id: "evaluation-purpose",
        title: "평가의 목적",
        level: 3,
        config: createDefaultEvaluationTemplateSectionConfig("outline_text"),
      },
      {
        id: "evaluation-direction",
        title: "평가의 기본 방향",
        level: 3,
        config: createDefaultEvaluationTemplateSectionConfig("outline_text"),
      },
      {
        id: "evaluation-policy",
        title: "평가 방침 및 유의사항",
        level: 3,
        config: createDefaultEvaluationTemplateSectionConfig("outline_text"),
      },
      {
        id: "evaluation-criteria",
        title: "평가 기준",
        level: 2,
        config: createDefaultEvaluationTemplateSectionConfig("title_only"),
      },
      {
        id: "achievement-rate",
        title: "기준 성취율과 성취도",
        level: 3,
        config: createDefaultEvaluationTemplateSectionConfig("achievement_rate_table"),
      },
      {
        id: "semester-achievement-level",
        title: "학기단위 성취수준",
        level: 3,
        config: createDefaultEvaluationTemplateSectionConfig("semester_achievement_level_table"),
      },
      {
        id: "evaluation-method",
        title: "평가 방법",
        level: 2,
        config: createDefaultEvaluationTemplateSectionConfig("evaluation_method_table"),
      },
      {
        id: "written-assessment",
        title: "정기시험 세부 계획",
        level: 2,
        config: createDefaultEvaluationTemplateSectionConfig("written_assessment_table"),
      },
      {
        id: "performance-assessment",
        title: "수행평가 세부 계획",
        level: 2,
        config: createDefaultEvaluationTemplateSectionConfig("title_only"),
      },
      {
        id: "performance-assessment-1",
        title: "수행평가 1",
        level: 3,
        teacherEditableTitle: true,
        config: createDefaultEvaluationTemplateSectionConfig("performance_assessment_table"),
      },
      {
        id: "performance-assessment-2",
        title: "수행평가 2",
        level: 3,
        teacherEditableTitle: true,
        config: createDefaultEvaluationTemplateSectionConfig("performance_assessment_table"),
      },
      {
        id: "performance-assessment-3",
        title: "수행평가 3",
        level: 3,
        teacherEditableTitle: true,
        config: createDefaultEvaluationTemplateSectionConfig("performance_assessment_table"),
      },
      {
        id: "evaluation-results-use",
        title: "평가 결과 활용",
        level: 2,
        config: createDefaultEvaluationTemplateSectionConfig("outline_text"),
      },
    ]),
  };
}
