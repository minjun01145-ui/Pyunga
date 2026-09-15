"use client";

import type { ThresholdTableModel } from "../../domain/scoring-model";
import { numberFromInput } from "./shared";

type Props = {
  model: ThresholdTableModel;
  onChange: (model: ThresholdTableModel) => void;
  createId: () => string;
};

export function ThresholdTableEditor({ model, onChange, createId }: Props) {
  return (
    <div className="editor-block">
      <label className="field compact-field">
        <span>기준 항목명</span>
        <input
          value={model.metricLabel}
          onChange={(event) => onChange({ ...model, metricLabel: event.target.value })}
          placeholder="예: 자유투 성공 횟수, 기록"
        />
      </label>

      <table className="simple-table compact-table">
        <thead>
          <tr>
            <th>{model.metricLabel || "조건"}</th>
            <th className="score-column">점수</th>
            <th className="action-column">관리</th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <tr key={row.id}>
              <td>
                <input
                  aria-label="조건"
                  value={row.conditionLabel}
                  onChange={(event) => {
                    onChange({
                      ...model,
                      rows: model.rows.map((item) =>
                        item.id === row.id ? { ...item, conditionLabel: event.target.value } : item,
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
                      rows: model.rows.map((item) => item.id === row.id ? { ...item, score } : item),
                    });
                  }}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() => onChange({ ...model, rows: model.rows.filter((item) => item.id !== row.id) })}
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
        onClick={() => onChange({ ...model, rows: [...model.rows, { id: createId(), conditionLabel: "", score: 0 }] })}
      >
        점수 기준 추가
      </button>
    </div>
  );
}
