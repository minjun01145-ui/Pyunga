# 평가계획 Template의 공통 구조와 교과별 반복 항목

## 문제

전년도 평가계획 PDF 한 개를 학교 Template의 근거로 사용할 때, 해당 PDF의 교과에서만 사용하는 실제 평가명이 문서 구조처럼 보일 수 있다.

예를 들어 영어 평가계획의 다음 구조에서:

```text
평가 기준
  ├─ 기준 성취율과 성취도
  └─ 학기단위 성취수준

수행평가 세부 계획
  ├─ 영어듣기능력평가
  ├─ 영어 말하기
  └─ 영어 글쓰기
```

`학기단위 성취수준`은 학교 평가계획 양식의 공통 제목으로 재사용할 수 있지만, `영어듣기능력평가`, `영어 말하기`, `영어 글쓰기`는 영어 교과의 실제 수행평가 항목이다. 이를 학교 Template에 고정하면 다른 교과에도 영어 수행평가명이 노출된다.

## 결정

문서 Section의 하위 구성 방식을 두 가지로 제한한다.

```ts
type EvaluationTemplateChildrenMode = "fixed" | "repeatable";
```

### fixed

하위 제목 자체가 학교 공통 Template의 일부다.

```text
평가 기준 [fixed]
  ├─ 기준 성취율과 성취도
  └─ 학기단위 성취수준
```

하위 항목은 Template에 저장하고 교과별 문서에서도 같은 구조를 사용한다.

### repeatable

부모 Section까지만 학교 공통 Template이다. 하위 항목의 이름과 개수는 교과별 EvaluationPlan 데이터가 결정한다.

```text
수행평가 세부 계획 [repeatable]
  └─ 교과별 수행평가 목록
```

영어에서는 `영어듣기능력평가`, 수학에서는 `수학 주제 탐구`, 과학에서는 `실험 평가`처럼 실제 항목이 달라질 수 있다. 이 이름들은 Template Section으로 저장하지 않는다.

## PDF import

전년도 PDF 분석은 다음 두 결과를 구분한다.

```text
학교 공통 Template 초안
교과별 반복 항목 sample
```

AI는 제한된 heading Schema만 반환한다. Application 계층은 `repeatable` 부모 아래의 실제 항목을 Template Section 목록에서 분리하고 검토용 sample로 반환한다. sample은 저장 API payload에 포함하지 않는다.

AI 분류는 확정값이 아니다. 평가계 담당자는 관리자 화면에서 각 Section의 하위 구성을 `공통 하위 항목` 또는 `교과별 반복 항목`으로 수정할 수 있다.

## 저장 규칙

`schools/{schoolId}/evaluationTemplates/current`에는 공통 Template만 저장한다.

`repeatable` Section 아래에 정적인 자식 Section을 동시에 저장하는 상태는 Domain validation에서 허용하지 않는다. 기존 저장 문서에 `childrenMode`가 없으면 `fixed`로 읽어 이전 데이터와 호환한다.

PDF import가 만드는 Section ID는 단순 배열 순번이 아니라 정규화된 제목 경로를 기반으로 결정적으로 만든다. 앞쪽에 다른 Section이 추가되어도 같은 구조의 Section ID가 불필요하게 바뀌지 않도록 하여, 이후 Section별 설정을 연결할 때 안정적인 식별자로 사용할 수 있게 한다.

교과별 반복 항목의 실제 데이터는 향후 EvaluationPlan/수행평가 Domain이 소유한다. Template Firestore 문서에는 특정 교과의 실제 수행평가명을 복제하지 않는다.

## 모듈 경계

- `template/domain`: Section 계층, `childrenMode`, 이동/삭제/검증 규칙
- `template/application`: PDF 분석 결과를 공통 Template과 반복 항목 sample로 분리
- `template/infrastructure`: PDF 텍스트 추출 및 학교 Template 저장
- `template/ui`: 관리자가 import 결과를 검토하고 하위 구성 방식을 수정
- `evaluation-plan` / `performance-assessment`: 교과별 실제 평가 항목 데이터

Template 모듈은 특정 과목명을 기준으로 분기하지 않는다. 수행평가 영역을 반복 데이터로 보는 것은 과목별 예외가 아니라 평가계획 문서의 데이터 경계다.
