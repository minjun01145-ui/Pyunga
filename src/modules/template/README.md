# Template module

학교별 평가계획의 입력 Schema와 출력 레이아웃 차이를 담당합니다.

## 책임

- 문서 Section 목록/순서/제목
- 전년도 평가계획 PDF에서 Section 구조 초안 생성
- 공통 하위 항목과 교과별 반복 항목의 경계
- 교수·학습표 Column Schema
- Section별 portrait/landscape
- page break / 반복 헤더 등 출력 정책
- 교사 입력 UI가 어떤 데이터 필드를 보여줄지 결정하는 Schema

## 공통 구조와 교과별 데이터

Template에는 여러 교과가 공통으로 사용하는 문서 골격만 저장합니다.

- `fixed`: 하위 제목 자체가 학교 공통 양식입니다. 예: `평가 기준 > 학기단위 성취수준`.
- `repeatable`: 부모 Section까지만 학교 공통 양식이며 그 아래 항목 이름과 개수는 교과 EvaluationPlan 데이터가 결정합니다. 예: `수행평가 세부 계획 > 영어듣기평가/프로젝트/실험`.

`repeatable` Section 아래에서 전년도 PDF로 발견한 실제 교과 항목은 import 검토용 sample로만 반환하고 `evaluationTemplates/current`에는 저장하지 않습니다. 따라서 특정 교과 PDF를 양식의 기준으로 사용해도 그 교과의 수행평가명이 다른 교과의 학교 공통 메뉴에 섞이지 않습니다.

이 구분은 문서 제목 문자열에 따라 UI를 하드코딩하기 위한 것이 아닙니다. PDF import가 초안을 제안하고 평가계 담당자가 관리자 화면에서 `공통 하위 항목` 또는 `교과별 반복 항목`을 검토·수정합니다.

## 원칙

- Domain 데이터를 변경하지 않는다.
- 학교별 차이를 source code `if/else`로 만들지 않는다.
- AI가 생성한 임의 React/JavaScript 코드를 실행하지 않는다.
- AI는 제한된 Template Schema 초안만 제안할 수 있다.
- Template 설정은 평가계 담당자가 검토/수정/확정한다.
- PDF 원문에서 번호가 붙은 제목 후보를 먼저 수집하고, AI는 문서 문맥을 보고 실제 Section 제목과 단계를 제한된 Schema로 분류한다.
- 소분류 항목의 실제 이름이 교과마다 달라지는 경우 Template에 고정 제목으로 저장하지 않는다.
- 사용 사례가 없는 범용 DSL이나 재귀적 무제한 트리를 미리 만들지 않는다.

상세 설계는 `docs/13_EVALUATION_TEMPLATE_DESIGN.md`와 `docs/18_EVALUATION_TEMPLATE_REPEATABLE_ITEMS.md`를 따른다.
