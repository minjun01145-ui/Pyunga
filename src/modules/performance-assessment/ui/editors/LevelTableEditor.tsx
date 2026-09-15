"use client";

import type { LevelTableModel } from "../../domain/scoring-model";
import { numberFromInput } from "./shared";

type Props = {
  model: LevelTableModel;
  onChange: (model: LevelTableModel) => void;
  createId: () => string;
};

export function LevelTableEditor({ model, onChange, createId }: Props) {
  return (
    <div className="editor-block">
      <table className="simple-table compact-table">
        <thead>
          <tr>
            <th>수준</th>
            <th>평가기준</th>
            <th className="score-column">점수</th>
            <th className="action-column">관리</th>
          </tr>
        </thead>
        <tbody>
          {model.levels.map((level) => (
            <tr key={level.id}>
              <td>
                <input
                  aria-label="수준명"
                  value={level.label}
                  onChange={(event) => {
                    onChange({
                      ...model,
                      levels: model.levels.map((item) =>
                        item.id === level.id ? { ...item, label: event.target.value } : item,
                      ),
                    });
                  }}
                />
              </td>
              <td>
                <textarea
                  aria-label={`${level.label || "수준"} 평가기준`}
                  rows={2}
                  value={level.description}
                  onChange={(event) => {
                    onChange({
                      ...model,
                      levels: model.levels.map((item) =>
                        item.id === level.id ? { ...item, description: event.target.value } : item,
                      ),
                    });
                  }}
                />
              </td>
              <td>
                <input
                  aria-label={`${level.label || "수준"} 점수`}
                  type="number"
                  min={0}
                  value={level.score}
                  onChange={(event) => {
                    const score = numberFromInput(event);
                    onChange({
                      ...model,
                      levels: model.levels.map((item) =>
                        item.id === level.id ? { ...item, score } : item,
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
                    onChange({ ...model, levels: model.levels.filter((item) => item.id !== level.id) });
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
            levels: [...model.levels, { id: createId(), label: "", description: "", score: 0 }],
          });
        }}
      >
        수준 추가
      </button>
    </div>
  );
}
