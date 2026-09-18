# Template module

학교별 평가계획의 입력 Schema와 출력 레이아웃 차이를 담당합니다.

## 책임

- 문서 Section 목록/순서/제목
- 전년도 평가계획 PDF에서 Section 구조 초안 생성
- 교수·학습표 Column Schema
- Section별 portrait/landscape
- page break / 반복 헤더 등 출력 정책
- 교사 입력 UI가 어떤 데이터 필드를 보여줄지 결정하는 Schema

## 문서 제목 단계

Template Section은 학교 공문서에서 익숙한 7단계 제목 구조를 사용합니다.

1. `대분류(제목)`
2. `1. 단위`
3. `가. 단위`
4. `1) 단위`
5. `가) 단위`
6. `(1) 단위`
7. `(가) 단위`

PDF import는 번호 표기와 문서의 포함 관계를 함께 보고 이 단계의 초안을 제안합니다. 저장 시에는 제목, 단계, 순서, 상위 항목 관계와 원문 페이지 정보를 보관합니다.

## 원칙

- Domain 데이터를 변경하지 않는다.
- 학교별 차이를 source code `if/else`로 만들지 않는다.
- AI가 생성한 임의 React/JavaScript 코드를 실행하지 않는다.
- AI는 제한된 Template Schema 초안만 제안할 수 있다.
- Template 설정은 평가계 담당자가 검토/수정/확정한다.
- PDF 원문에서 번호가 붙은 제목 후보를 먼저 수집하고, AI는 문서 문맥을 보고 실제 Section 제목과 단계를 제한된 Schema로 분류한다.
- 사용 사례가 없는 범용 DSL이나 재귀적 무제한 트리를 미리 만들지 않는다.

상세 설계는 `docs/13_EVALUATION_TEMPLATE_DESIGN.md`를 따른다.
