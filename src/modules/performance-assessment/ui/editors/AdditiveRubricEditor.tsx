"use client";

import type { AdditiveRubricModel } from "../../domain/scoring-model";
import { numberFromInput } from "./shared";

type Props = {
  model: AdditiveRubricModel;
  onChange: (model: AdditiveRubricModel) => void;
  createId: () => string;
};

export function AdditiveRubricEditor({ model, onChange, createId }: Props) {
  return (
    <div className="editor-block stack-list">
      {model.items.map((item, itemIndex) => (
        <section className="rubric-item" key={item.id}>
          <div className="form-grid three-columns">
            <label className="field">
              <span>세부항목 {itemIndex + 1}</span>
              <input
                value={item.label}
                onChange={(event) => {
                  onChange({
                    ...model,
                    items: model.items.map((candidate) =>
                      candidate.id === item.id ? { ...candidate, label: event.target.value } : candidate,
                    ),
                  });
                }}
              />
            </label>
            <label className="field">
              <span>최고점</span>
              <input
                type="number"
                min={0}
                value={item.maxScore}
                onChange={(event) => {
                  const maxScore = numberFromInput(event);
                  onChange({
                    ...model,
                    items: model.items.map((candidate) =>
                      candidate.id === item.id ? { ...candidate, maxScore } : candidate,
                    ),
                  });
                }}
              />
            </label>
            <div className="field action-field">
              <span>관리</span>
              <button
                type="button"
                className="secondary-button danger-outline"
                onClick={() => onChange({ ...model, items: model.items.filter((candidate) => candidate.id !== item.id) })}
              >
                세부항목 삭제
              </button>
            </div>
          </div>

          <table className="simple-table compact-table">
            <thead>
              <tr>
                <th>기준</th>
                <th className="score-column">점수</th>
                <th className="action-column">관리</th>
              </tr>
            </thead>
            <tbody>
              {item.levels.map((level) => (
                <tr key={level.id}>
                  <td>
                    <input
                      aria-label={`${item.label} 기준`}
                      value={level.description}
                      onChange={(event) => {
                        onChange({
                          ...model,
                          items: model.items.map((candidate) =>
                            candidate.id === item.id
                              ? {
                                  ...candidate,
                                  levels: candidate.levels.map((candidateLevel) =>
                                    candidateLevel.id === level.id
                                      ? { ...candidateLevel, description: event.target.value }
                                      : candidateLevel,
                                  ),
                                }
                              : candidate,
                          ),
                        });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${item.label} 점수`}
                      type="number"
                      min={0}
                      value={level.score}
                      onChange={(event) => {
                        const score = numberFromInput(event);
                        onChange({
                          ...model,
                          items: model.items.map((candidate) =>
                            candidate.id === item.id
                              ? {
                                  ...candidate,
                                  levels: candidate.levels.map((candidateLevel) =>
                                    candidateLevel.id === level.id ? { ...candidateLevel, score } : candidateLevel,
                                  ),
                                }
                              : candidate,
                          ),
                        });
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-button danger-text"
                      onClick={() => {
                        onChange({
                          ...model,
                          items: model.items.map((candidate) =>
                            candidate.id === item.id
                              ? { ...candidate, levels: candidate.levels.filter((candidateLevel) => candidateLevel.id !== level.id) }
                              : candidate,
                          ),
                        });
                      }}
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
            onClick={() => {
              onChange({
                ...model,
                items: model.items.map((candidate) =>
                  candidate.id === item.id
                    ? {
                        ...candidate,
                        levels: [...candidate.levels, { id: createId(), description: "", score: 0 }],
                      }
                    : candidate,
                ),
              });
            }}
          >
            기준 추가
          </button>
        </section>
      ))}

      <button
        type="button"
        className="secondary-button"
        onClick={() => onChange({
          ...model,
          items: [
            ...model.items,
            {
              id: createId(),
              label: `세부항목 ${model.items.length + 1}`,
              maxScore: 0,
              levels: [{ id: createId(), description: "충족", score: 0 }],
            },
          ],
        })}
      >
        세부항목 추가
      </button>
    </div>
  );
}
