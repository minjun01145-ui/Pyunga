# 평가계 설정 및 학교 문서 Template 설계

## 목적

평가계 담당자가 학교의 평가계획 문서 구조를 먼저 설정하고, 일반 교사는 그 설정에 따라 필요한 데이터만 입력하도록 한다.

핵심 원칙은 다음과 같다.

- 교사가 HWP/PDF 서식을 직접 맞추지 않는다.
- 학교별 문서 차이는 Domain 데이터가 아니라 Template 설정으로 처리한다.
- 작년도 평가계획 PDF를 AI가 분석해 Template 초안을 만들 수 있지만, AI 결과는 확정값이 아니다.
- 평가계 담당자는 AI 초안을 수정하거나 처음부터 직접 Template을 만들 수 있다.
- AI가 임의의 React/JavaScript 코드를 생성하여 실행하는 방식은 사용하지 않는다.
- Template은 제한된 Schema로 저장한다.

## 전체 흐름

```text
학사일정 설정
  ↓
평가계 담당자 문서 Template 설정
  ├─ 작년도 PDF → AI Template 초안 → 담당자 검토/수정
  └─ 또는 빈 Template부터 직접 작성
  ↓
학교 Template 확정
  ├─ 문서 Section 구성/순서
  ├─ 교수·학습표 열 구성
  ├─ 평가 공통 정책
  └─ 출력 레이아웃 정책
  ↓
교사 입력 화면 생성
  ↓
교과별 EvaluationPlan Domain Data
  ↓
문서 렌더링
```

## 문서 Section

문서는 고정 페이지가 아니라 의미 단위 Section의 순서로 표현한다.

예시:

1. 교수·학습 및 평가 연계계획
2. 평가의 방향
3. 평가 유의사항
4. 평가 개요
5. 수행평가 세부계획
6. 성취기준/성취수준
7. 기타 평가 처리사항

학교는 Section을 추가/삭제/이름 변경/순서 변경할 수 있다.

각 Section 제목에는 `교과에서 제목 설정 가능` 정책을 둘 수 있다. 정책이 꺼져 있으면 평가계가 저장한 제목을 교과가 그대로 사용한다. 정책이 켜져 있으면 평가계가 입력한 제목은 교사용 편집기에서 회색 예시 제목으로 제공하고, 교과 교사가 실제 제목을 입력할 수 있다. 이 정책은 관리자 화면의 표시 상태가 아니라 Template Schema에 저장하여 교사용 편집기와 동일한 규칙을 공유한다.

Section 제목 단계는 국내 공문서에서 익숙한 번호 체계를 따라 최대 7단계로 제한한다.

```text
대분류(제목)
  1. 단위
    가. 단위
      1) 단위
        가) 단위
          (1) 단위
            (가) 단위
```

저장 데이터에는 번호 문자열을 제목에 중복 보관하지 않고 `level` 값으로 계층을 표현한다. PDF import는 원문의 번호 표기와 포함 관계를 바탕으로 이 단계의 초안을 제안하며, 평가계 담당자가 최종 단계와 순서를 수정할 수 있다.

관리자 왼쪽 메뉴의 `<현재 양식 수정>`은 저장된 Section 전체를 `parentId` 관계로 트리화하여 보여 준다. 메뉴 링크는 제목이 아니라 Section `id`를 사용하므로 제목 변경과 관계없이 같은 Section 편집 화면을 가리킨다.

현재 구현 모델은 Section 계층과 입력 양식을 분리한다. 제목만 있는 상위 묶음은 `config`가 없을 수 있고, 실제 입력이 필요한 Section만 제한된 `config`를 가진다.

```ts
type EvaluationTemplateSectionConfig =
  | { type: "title_only" }
  | { type: "teaching_learning_table"; /* 교수학습 필드/배치 */ }
  | { type: "outline_text"; /* 번호 단계 */ }
  | { type: "achievement_rate_table"; /* 성취율/성취도 행 */ }
  | { type: "semester_achievement_level_table"; /* 성취수준 단계 */ }
  | { type: "evaluation_method_table"; /* 평가 방법 행/입력필드 */ }
  | { type: "written_assessment_table"; /* 정기시험 입력필드 */ }
  | { type: "performance_assessment_table"; /* 수행평가 상단/채점표 */ };

type DocumentSectionTemplate = {
  id: string;
  title: string;
  teacherEditableTitle: boolean;
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  parentId?: string;
  order: number;
  sourcePage?: number;
  config?: EvaluationTemplateSectionConfig;
};
```

`config`는 무제한 JSON이 아니다. 각 유형은 저장 전에 명시적인 Schema로 검증하며, AI가 알 수 없는 유형이나 실행 가능한 코드는 저장하지 않는다.

## 교수·학습표 설정

교수·학습표는 학사일정과 연결된다.

### 학사일정 역할

- 저장된 학사일정 중 해당 학기·학년에 적용되는 일정을 기준으로 월별 또는 월·주별 기간을 연속 생성한다.
- 기간 사이에 행사가 없는 주도 빠뜨리지 않고 교수·학습표 행을 만든다.
- 휴업일, 공휴일, 학교행사, 정기고사 등 공식 일정을 각 기간의 `주요 학사 일정` 값으로 제공한다.
- 시스템이 기간별 행을 자동 생성하되, 단원·성취기준·수업·평가 내용은 교사가 입력한다.

교수·학습표에 제공할 일정은 원본 학사일정을 복제 저장하지 않고 월별 또는 월·주별 보기로 계산한다. 월·주별 보기는 월요일부터 일요일까지를 한 주로 보고, 월 경계에 걸친 주는 그 주의 목요일이 속한 달의 주차로 표시한다. 예를 들어 목요일이 9월 3일인 주는 `9월 1주`다. 학교 양식에 따라 `월` 하나만 자동 표시하거나, `월 / 주 / 기간 / 주요 학사 일정`을 각각 별도 시스템 셀로 둘 수 있다.

교수·학습표 Template에는 행 생성 정책을 별도로 둔다.

```ts
calendarRows: {
  enabled: boolean;
  periodUnit: "month" | "month_week";
}
```

`month`는 월별 한 행(또는 관리자가 만든 한 본문 블록)을, `month_week`는 주별 한 본문 블록을 생성한다. 실제 표의 머리글과 본문 블록 구조는 평가계가 Tiptap에서 확정한 canonical Table Template을 그대로 사용한다. 즉 자동 행 생성 때문에 별도의 표 구조를 두 번째로 저장하지 않는다.

### 표 구조 편집

학교별로 다음 열의 존재 여부, 표시명, 순서, 폭과 병합 구조를 설정할 수 있어야 한다.

- 주차/시기
- 단원명
- 성취기준
- 교수·학습 활동
- 수업방법
- 평가요소
- 평가방법
- 수업·평가 연계 주안점
- 범교과/학교행사
- 기타 학교 커스텀 열

평가계 담당자는 개발자용 필드 목록을 먼저 수정하는 방식이 아니라 실제 표를 보면서 다음 작업을 수행한다.

- 셀 안의 제목/안내 문구 직접 수정
- 행/열 추가 및 삭제
- 셀 병합 및 분할
- 열 폭 조절
- 머리글 행 지정
- 실제 교과 데이터나 시스템 자동값을 받을 셀만 `데이터 칸`으로 지정

표 편집 UI는 Tiptap TableKit을 사용한다. Tiptap은 편집 동작만 담당하며, 저장 시에는 Tiptap의 임의 문서 전체를 보관하지 않는다. Pyunga Domain이 허용한 `table / row / cell / paragraph / text`, `rowspan / colspan / colwidth`, 입력필드 연결 속성만 제한된 Schema로 검증하여 저장한다. 따라서 문서 출력기는 Tiptap에 의존하지 않고 같은 Table Template을 읽을 수 있다.

핵심 Schema:

```ts
type TableInputBinding = {
  fieldKey: string;
  fieldLabel: string;
  inputKind:
    | "text"
    | "multiline"
    | "number"
    | "percentage"
    | "achievement_standards"
    | "bullet_list"
    | "checkbox_list";
  inputSource: "system" | "teacher" | "custom";
  systemValue?:
    | "academic_calendar.period"
    | "academic_calendar.month"
    | "academic_calendar.week"
    | "academic_calendar.date_range"
    | "academic_calendar.events";
  required?: boolean;
};

type TableCellTemplate = {
  type: "tableCell" | "tableHeader";
  colspan: number;
  rowspan: number;
  colwidth: number[] | null;
  input?: TableInputBinding;
  text?: string;
};

type TeachingLearningTableTemplate = {
  type: "teaching_learning_table";
  table: TableTemplateDocument;
  calendarRows: {
    enabled: boolean;
    periodUnit: "month" | "month_week";
  };
  layout: {
    repeatHeader: boolean;
    orientation: "portrait" | "landscape";
  };
};
```

`fieldKey`와 화면 표시명은 분리한다. 예를 들어 내부 `achievementStandards` 필드를 학교에서는 `교육과정 성취기준`으로 표시할 수 있다. 셀 병합과 열 폭은 표 자체의 구조로 표현하므로 `main/detail` 같은 화면 전용 배치 값에 의존하지 않는다.

기준 성취율, 학기단위 성취수준, 평가 방법, 정기시험 계획, 수행평가 계획 등 다른 표 Section도 같은 Table Template Schema와 편집기를 사용한다. 표 Section 공통의 `layout`에는 페이지 방향과 반복 머리글 정책을 둔다.

Table Template은 학교가 확정한 **표 양식의 단일 저장 기준**이다. 고정 문구, 행·열·병합 구조, 열 폭, 교과 입력칸의 `fieldKey/inputKind/inputSource` 연결을 함께 보관한다. 과거 PDF import가 반환하던 `fields`, `rows`, `rubricColumnLabels` 같은 구조는 호환 입력으로만 받아 Table Template으로 변환하고 저장 모델에는 중복 보관하지 않는다. 이렇게 해야 관리자가 표에서 직접 수정한 내용과 별도 설정값이 서로 어긋나지 않는다.

### 교사 UI 생성

Table Template은 EvaluationPlan의 실제 업무 데이터를 대체하지 않는다. 교사 화면은 Template의 `fieldKey`와 입력 형식을 읽어 필요한 입력 UI를 배치하고, 실제 정기시험·수행평가·채점 결과 같은 값은 별도의 Domain 데이터에 저장한다. 즉 학교 양식의 모양과 입력 위치는 Template이, 실제 평가 사실과 반복 데이터는 EvaluationPlan Domain이 책임진다.

```text
학교 Template
  [주차][단원][성취기준][교수학습활동][평가요소]
       ↓
교사 입력 화면
  시스템 주차 | 입력 | 성취기준 선택 | 입력 | 입력
```

평가계의 **학교 양식 설정 화면**은 표 구조를 직접 보며 수정하는 편집 방식을 사용한다. 반면 일반 교사의 **실제 평가 데이터 입력 화면**은 표 모양을 직접 고치는 화면이 아니라, 확정된 Template이 요구하는 데이터 입력에 집중한다. 양식 편집과 업무 데이터 입력의 책임을 분리한다.

현재 교사용 작성 화면은 이 원칙대로 canonical Table Template을 읽어 고정 문구·병합·열 폭을 그대로 표시하고, `fieldKey`가 지정된 셀에만 입력 컨트롤을 배치한다. 교수·학습표의 `inputSource="system"` 셀은 학사일정 resolver가 월·주·기간·주요일정을 자동 공급하므로 교사가 수정하지 않는다. 학사일정 자동 행이 켜진 표는 머리글 아래의 본문 블록을 월/주 기간 수만큼 반복하고, 교사가 입력한 값은 `기간 key + fieldKey` 단위로 Form Draft에 저장한다. 로그인 기능이 비활성화된 데모 단계에서는 교사 Form Draft를 브라우저 로컬 저장소에만 저장하여 서로 다른 방문자가 같은 개발 사용자 문서를 덮어쓰지 않게 한다.

Table Template 자체에는 반복 컬렉션의 의미가 없다. 따라서 한 `fieldKey`를 임의로 여러 주차·여러 수행평가 행으로 복제하지 않는다. 주차별 교수·학습 데이터나 여러 지필/수행평가처럼 반복되는 실제 업무 데이터는 `EvaluationPlan` Domain의 반복 구조가 연결되는 시점에 명시적으로 매핑한다.

## 작년도 PDF의 AI 분석

AI의 책임은 "문서 양식을 해석하여 Template Schema 초안을 제안"하는 것이다.

AI가 추출할 수 있는 항목:

- Section 제목 후보와 순서
- 교수·학습표 열 제목과 순서
- 개조식 번호 단계와 기준 성취율/성취도 표 구조
- 학기단위 성취수준, 평가 방법, 정기시험, 수행평가 표의 입력 구조
- 반복되는 평가계획 구성요소
- 페이지 방향/표 헤더 등 레이아웃 힌트

AI가 하면 안 되는 일:

- 추출 결과를 검토 없이 학교 Template로 확정
- 임의 React/JS 코드 생성 및 실행
- 교과 평가 사실을 추정해서 Domain 데이터로 확정
- PDF 최종 생성에 매번 개입

## Template과 Domain 분리

같은 Domain Data는 여러 Template으로 출력될 수 있어야 한다.

```text
EvaluationPlan Domain Data
      ├─ 학교 Template A → A학교 평가계획
      ├─ 학교 Template B → B학교 평가계획
      └─ 공개용 Template → 학부모 공개 문서
```

학교의 표 모양을 `EvaluationPlan` 내부 필드로 누적하지 않는다.

## 구현 순서

1. Section Template Schema 확정
2. 학사일정 → 주차 생성 규칙 확정
3. 교수·학습표 Column Schema 및 관리자 설정 UI
4. Template을 읽는 교사용 동적 입력 UI
5. 실제 데이터로 Render POC
6. 필요성이 확인된 Section type만 추가

학교명을 기준으로 source code `if/else`를 추가하지 않는다.
