import type {
  TableTemplateCellAttrs,
  TableTemplateInputKind,
  TableTemplateInputSource,
  TableTemplateSystemValue,
} from "./table-template";

export type TableTemplateCellBinding = {
  fieldKey: string;
  fieldLabel: string;
  inputKind: TableTemplateInputKind;
  inputSource: TableTemplateInputSource;
  systemValue?: TableTemplateSystemValue;
  required: boolean;
};

export function readTableTemplateCellBinding(
  attrs: TableTemplateCellAttrs,
): TableTemplateCellBinding | undefined {
  if (!attrs.fieldKey) return undefined;
  return {
    fieldKey: attrs.fieldKey,
    fieldLabel: attrs.fieldLabel ?? "입력 항목",
    inputKind: attrs.inputKind ?? "text",
    inputSource: attrs.inputSource ?? "teacher",
    ...(attrs.inputSource === "system" && attrs.systemValue ? { systemValue: attrs.systemValue } : {}),
    required: attrs.required === true,
  };
}

export function applyTableTemplateCellBinding(
  attrs: TableTemplateCellAttrs,
  binding: TableTemplateCellBinding,
): TableTemplateCellAttrs {
  const cleared = clearTableTemplateCellBinding(attrs);
  return {
    ...cleared,
    fieldKey: binding.fieldKey,
    fieldLabel: binding.fieldLabel,
    inputKind: binding.inputKind,
    inputSource: binding.inputSource,
    ...(binding.inputSource === "system" && binding.systemValue
      ? { systemValue: binding.systemValue }
      : {}),
    required: binding.required,
  };
}

export function clearTableTemplateCellBinding(
  attrs: TableTemplateCellAttrs,
): TableTemplateCellAttrs {
  return {
    colspan: attrs.colspan,
    rowspan: attrs.rowspan,
    colwidth: attrs.colwidth,
  };
}

export function createCustomTableTemplateCellBinding(fieldKey: string): TableTemplateCellBinding {
  return {
    fieldKey,
    fieldLabel: "새 입력 항목",
    inputKind: "text",
    inputSource: "custom",
    required: false,
  };
}

export function createAcademicCalendarTableTemplateCellBinding(
  fieldKey: string,
  systemValue: TableTemplateSystemValue,
): TableTemplateCellBinding {
  return {
    fieldKey,
    fieldLabel: getAcademicCalendarSystemValueLabel(systemValue),
    inputKind: systemValue === "academic_calendar.events" ? "multiline" : "text",
    inputSource: "system",
    systemValue,
    required: false,
  };
}

export function changeTableTemplateCellBindingSource(
  binding: TableTemplateCellBinding,
  inputSource: TableTemplateInputSource,
): TableTemplateCellBinding {
  return {
    ...binding,
    inputSource,
    ...(inputSource === "system"
      ? { systemValue: binding.systemValue ?? "academic_calendar.period" }
      : { systemValue: undefined }),
  };
}

export function getAcademicCalendarSystemValueLabel(value: TableTemplateSystemValue): string {
  switch (value) {
    case "academic_calendar.period": return "월/주 표시";
    case "academic_calendar.month": return "월";
    case "academic_calendar.week": return "주";
    case "academic_calendar.date_range": return "기간(날짜)";
    case "academic_calendar.events": return "주요 학사 일정";
  }
}
