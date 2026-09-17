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

권장 개념 모델:

```ts
type DocumentSectionType =
  | "teaching_learning_table"
  | "evaluation_direction"
  | "evaluation_notes"
  | "evaluation_summary"
  | "written_assessment"
  | "performance_assessment"
  | "achievement_standard"
  | "custom_text";

type DocumentSectionTemplate = {
  id: string;
  type: DocumentSectionType;
  title: string;
  order: number;
  enabled: boolean;
  layout: {
    orientation: "portrait" | "landscape";
    startNewPage: boolean;
    keepTogether?: boolean;
    repeatHeader?: boolean;
  };
  config: unknown;
};
```

`config`를 무제한 JSON으로 방치하지 않는다. Section type별 명시적 Schema를 둔다.

## 교수·학습표 설정

교수·학습표는 학사일정과 연결된다.

### 학사일정 역할

- 학년도/학기 시작일과 종료일을 기준으로 주차 후보를 생성한다.
- 휴업일, 공휴일, 학교행사, 정기고사 등 공식 일정을 주차 맥락으로 제공한다.
- 시스템이 주별 행을 자동 생성하되, 실제 수업 내용은 교사가 입력한다.
- 일정 자체가 교수·학습표의 모든 행을 결정하는 것은 아니다. 일정은 주차 생성과 작성 보조 정보의 기준이다.

### 동적 열 구성

학교별로 다음 열의 존재 여부, 표시명, 순서, 폭을 설정할 수 있어야 한다.

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

권장 Schema:

```ts
type TeachingLearningColumn = {
  id: string;
  fieldKey: string;
  label: string;
  source: "system" | "teacher" | "custom";
  order: number;
  widthWeight?: number;
  required?: boolean;
};

type TeachingLearningTableTemplate = {
  columns: TeachingLearningColumn[];
  repeatHeader: boolean;
  orientation: "portrait" | "landscape";
};
```

`fieldKey`와 `label`을 분리한다. 예를 들어 내부 `achievementStandards` 필드를 학교에서는 `교육과정 성취기준`으로 표시할 수 있다.

### 교사 UI 생성

교사 화면은 Template의 column Schema를 읽어 입력 필드를 생성한다.

```text
학교 Template
  [주차][단원][성취기준][교수학습활동][평가요소]
       ↓
교사 입력 화면
  시스템 주차 | 입력 | 성취기준 선택 | 입력 | 입력
```

출력 표를 그대로 편집하는 WYSIWYG 방식보다 데이터 입력 UI를 우선한다. 미리보기는 별도로 제공할 수 있다.

## 작년도 PDF의 AI 분석

AI의 책임은 "문서 양식을 해석하여 Template Schema 초안을 제안"하는 것이다.

AI가 추출할 수 있는 항목:

- Section 제목 후보와 순서
- 교수·학습표 열 제목과 순서
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
