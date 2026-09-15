import type { PerformanceAssessment } from "../../domain/performance-assessment";

export function createPrototypeAssessment(): PerformanceAssessment {
  return {
    id: "prototype-assessment",
    title: "영어 말하기",
    weightPercent: 20,
    maxScore: 100,
    achievementStandardIds: [],
    sections: [
      {
        id: "section-content",
        title: "내용",
        maxScore: 30,
        scoringModel: {
          type: "level_table",
          levels: [
            { id: "content-high", label: "상", description: "내용이 충실하고 과제 요구를 충분히 반영함", score: 30 },
            { id: "content-mid", label: "중", description: "내용이 대체로 충실함", score: 25 },
            { id: "content-low", label: "하", description: "내용이 일부 부족함", score: 20 },
          ],
        },
      },
      {
        id: "section-language",
        title: "표현",
        maxScore: 30,
        scoringModel: {
          type: "criterion_count",
          criteria: [
            { id: "criterion-1", description: "적절한 어휘를 사용함" },
            { id: "criterion-2", description: "문장 구조가 적절함" },
            { id: "criterion-3", description: "의미 전달이 명확함" },
            { id: "criterion-4", description: "과제에서 요구한 표현을 사용함" },
          ],
          scoreBySatisfiedCount: [
            { id: "count-4", satisfiedCount: 4, score: 30 },
            { id: "count-3", satisfiedCount: 3, score: 25 },
            { id: "count-2", satisfiedCount: 2, score: 20 },
            { id: "count-1", satisfiedCount: 1, score: 15 },
            { id: "count-0", satisfiedCount: 0, score: 10 },
          ],
        },
      },
      {
        id: "section-delivery",
        title: "전달력",
        maxScore: 40,
        scoringModel: {
          type: "additive_rubric",
          items: [
            {
              id: "item-fluency",
              label: "유창성",
              maxScore: 20,
              levels: [
                { id: "fluency-high", description: "자연스럽고 유창하게 발표함", score: 20 },
                { id: "fluency-mid", description: "일부 머뭇거림이 있으나 발표를 이어감", score: 15 },
              ],
            },
            {
              id: "item-attitude",
              label: "발표 태도",
              maxScore: 20,
              levels: [
                { id: "attitude-high", description: "적절한 시선과 목소리로 발표함", score: 20 },
                { id: "attitude-mid", description: "발표 태도가 대체로 적절함", score: 15 },
              ],
            },
          ],
        },
      },
    ],
  };
}
