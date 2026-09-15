import type { ChangeEvent } from "react";

export function numberFromInput(event: ChangeEvent<HTMLInputElement>): number {
  const value = event.currentTarget.valueAsNumber;
  return Number.isNaN(value) ? 0 : value;
}
