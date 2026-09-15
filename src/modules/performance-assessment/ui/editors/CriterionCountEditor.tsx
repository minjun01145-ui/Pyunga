"use client";

import type { CriterionCountModel } from "../../domain/scoring-model";
import { numberFromInput } from "./shared";

type Props = {
  model: CriterionCountModel;
  onChange: (model: CriterionCountModel) => void;
  createId: () => string;
};

export function CriterionCountEditor({ model, onChange, createId }: Props) {
  return (
    <div className="editor-block split-editor">
      <section>
        <h4 className="subsection-title">평가 조건</h4>
        <div className="stack-list">
          {model.criteria.map((criterion, index) => (
            <div className="inline-row" key={criterion.id}>
              <span className="row-number">{index + 1}</span>
              <input
                aria-label={`조건 ${index + 1}`}
                value={criterion.description}
                onChange={(event) => {
                  onChange({
                    ...model,
                    criteria: model.criteria.map((item) =>
                      item.id === criterion.id ? { ...item, description: event.target.value } : item,
                    ),
                  });
                }}
              />
              <button
                type="button"
                className="text-button danger-text"
                onClick={() => onChange({ ...model, criteria: model.criteria.filter((item) => item.id !== criterion.id) })}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => onChange({
            ...model,
            criteria: [...model.criteria, { id: createId(), description: `조건 ${model.criteria.length + 1}` }],
          })}
        >
          조건 추가
        </button>
      </section>

      <section>
        <h4 className="subsection-title">충족 개수별 점수</h4>
        <table className="simple-table compact-table">
          <thead>
            <tr>
              <th>충족 개수</th>
              <th>점수</th>
              <th className="action-column">관리</th>
            </tr>
          </thead>
          <tbody>
            {model.scoreBySatisfiedCount.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    aria-label="충족 개수"
                    type="number"
                    min={0}
                    value={row.satisfiedCount}
                    onChange={(event) => {
                      const satisfiedCount = numberFromInput(event);
                      onChange({
                        ...model,
                        scoreBySatisfiedCount: model.scoreBySatisfiedCount.map((item) =>
                          item.id === row.id ? { ...item, satisfiedCount } : item,
                        ),
                      });
                    }}
                  />
                </td>
                <td>
                  <input
                    aria-label="점수"
                    type="number"
                    min={0}
                    value={row.score}
                    onChange={(event) => {
                      const score = numberFromInput(event);
                      onChange({
                        ...model,
                        scoreBySatisfiedCount: model.scoreBySatisfiedCount.map((item) =>
                          item.id === row.id ? { ...item, score } : item,
                        ),
                      });
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="text-button danger-text"
                    onClick={() => onChange({
                      ...model,
                      scoreBySatisfiedCount: model.scoreBySatisfiedCount.filter((item) => item.id !== row.id),
                    })}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="secondary-button"
          onClick={() => onChange({
            ...model,
            scoreBySatisfiedCount: [
              ...model.scoreBySatisfiedCount,
              { id: createId(), satisfiedCount: 0, score: 0 },
            ],
          })}
        >
          점수 규칙 추가
        </button>
      </section>
    </div>
  );
}
