# 문서 렌더링 및 PDF 출력 설계

## 목표

긴 교수·학습표와 복잡한 수행평가 세부계획을 학교 Template에 맞춰 안정적으로 PDF로 출력한다.

최종 PDF 생성은 AI 작업이 아니다.

AI는 과거 문서 분석, Template 초안 제안, 내용 검토 등에 사용할 수 있지만 최종 문서 생성은 동일 입력에 동일 결과가 나오는 결정론적 렌더링 파이프라인으로 처리한다.

## 권장 파이프라인

```text
Domain Data
  ↓
Document View Model
  ↓
Template Resolver
  ↓
Layout Engine
  ↓
Print HTML/CSS
  ↓
Headless Chromium
  ↓
PDF
```

현재 `Document View Model -> Template -> Output` 원칙을 확장한 구조다.

## 책임 분리

### Domain Data

평가의 사실과 규칙을 보관한다.

예:

- 교수·학습 주차별 데이터
- 지필평가/수행평가
- 성취기준
- 채점기준

### Document View Model

출력에 필요한 의미 단위로 Domain 데이터를 정리한다.

예:

```ts
type DocumentView = {
  sections: DocumentSectionView[];
};
```

Domain을 PDF 전용 필드로 오염시키지 않는다.

### Template Resolver

학교 Template의 Section 순서, 제목, 열 구성, 표시 정책을 View Model에 적용한다.

### Layout Engine

다음을 결정한다.

- A4 세로/가로
- 열 폭
- 페이지 여백
- Section별 새 페이지 시작 여부
- 표 헤더 반복 여부
- 가능한 한 묶어서 출력할 블록
- 페이지 분할 fallback

### Renderer

레이아웃 결정 결과를 Print HTML/CSS로 생성하고 Chromium 기반 PDF로 출력한다.

## HTML/CSS + Chromium 우선

Pyunga의 핵심 문서는 긴 표, 병합 셀, 한글, 가변 열, 긴 루브릭이 많다.

우선 구현 후보는 HTML/CSS print layout + Headless Chromium(예: Playwright)이다.

최종 라이브러리 선택은 Render POC에서 다음 요구를 검증한 뒤 확정한다.

- A4 portrait/landscape
- 반복 table header
- rowspan/colspan
- 한글 글꼴
- 다중 페이지 긴 표
- section page break
- 서버 실행 환경

## Pagination 정책

### 기본 규칙

- 표의 `thead`는 다음 페이지에서도 반복한다.
- 일반적인 `tr`은 가능하면 페이지 중간에서 분리하지 않는다.
- 수행평가의 하나의 채점 블록은 가능한 한 같은 페이지에 둔다.
- 제목만 페이지 하단에 남고 내용이 다음 페이지로 넘어가는 상황을 피한다.

Print CSS의 `break-inside`, `break-before`, `break-after` 등을 활용하되 CSS 한 줄에만 의존하지 않는다.

### 초대형 행/블록

한 행 자체가 한 페이지 높이를 초과하는 경우 "절대 분할 금지"는 물리적으로 불가능하다.

따라서 fallback 정책을 둔다.

1. 우선 행/블록 단위로 다음 페이지 이동
2. 그래도 한 페이지보다 큰 경우에만 안전한 내부 분할 허용
3. 필요 시 `(계속)` 표시 또는 헤더 재출력
4. 텍스트가 잘리거나 겹치는 출력은 실패로 본다.

## 혼합 방향

교수·학습표는 가로, 평가 방향/유의사항은 세로가 필요한 학교가 있을 수 있다.

Section별 `orientation`을 Template에서 지정한다.

한 PDF 엔진 호출에서 안정적으로 혼합 방향을 지원하기 어려우면 Section 그룹별 PDF를 생성한 뒤 병합하는 방식도 허용한다. 이는 Renderer 내부 구현 상세이며 Domain에 노출하지 않는다.

## Preview

교사용/평가계용 미리보기와 PDF는 가능한 한 같은 Document View Model 및 Print 컴포넌트를 사용한다.

```text
Domain + Template
      ↓
Document View Model
      ├─ Browser Preview
      └─ PDF Renderer
```

화면 전용 UI를 캡처해서 PDF로 만드는 방식은 핵심 전략으로 사용하지 않는다.

### Raw 평가계획 미리보기

정식 디자인 엔진보다 먼저 교과 입력값과 학교 Template이 올바르게 결합되는지 확인하는 raw 미리보기를 제공한다. 이 미리보기는 `EvaluationPlan Form Draft + EvaluationTemplate -> Raw Document View`의 결정론적 변환을 사용하며, 결과 View를 저장하지 않는다.

raw 미리보기의 목적은 장식이 아니라 문서 구조와 출력 안정성 검증이다.

- Section 1~7단계 번호 체계와 들여쓰기/내어쓰기를 일관되게 표시한다.
- 표는 canonical Table Template의 `rowspan`, `colspan`, 열 폭, 고정 문구를 그대로 사용한다.
- `repeatHeader=true`인 표는 선두 머리글 행을 `thead`로 렌더링한다.
- 일반 행은 `break-inside: avoid`를 우선 적용하고, 한 페이지보다 큰 행은 브라우저 인쇄 엔진의 안전한 분할을 허용한다.
- Section의 세로/가로 방향은 named `@page` 규칙으로 분리하고, 내용 없는 상위 제목은 첫 실제 하위 내용의 방향을 따라 제목만 별도 페이지에 남는 상황을 줄인다.
- 이 단계에서는 Headless Chromium PDF 생성이나 시각적 최종 양식 가공을 구현하지 않는다. 브라우저 Preview와 인쇄 미리보기로 raw 레이아웃을 검증한다.

## AI 사용 원칙

PDF를 만들 때마다 LLM에게 문서를 생성시키지 않는다.

AI 사용 가능:

- 작년도 PDF에서 Template Schema 초안 추출
- 입력 내용 품질 검토
- 누락 후보 제안

AI 사용 금지/비권장:

- 최종 PDF 레이아웃을 매번 생성
- 임의 HTML/React 코드를 실행
- 페이지 분할을 LLM 판단에 의존

## Render POC

전체 제품 UI가 끝날 때까지 렌더링 검증을 미루지 않는다. 정식 Renderer 완성은 뒤에 해도 되지만 데이터 모델이 확정되기 전에 POC를 한 번 수행한다.

POC 데이터는 일부러 어려운 사례로 만든다.

- 교수·학습표 20주 이상
- 6~8개 열
- 긴 성취기준/교수학습활동
- 페이지 끝에 걸리는 행
- 매우 긴 단일 행
- 수행평가 3개 이상
- 서로 다른 ScoringModel 혼합
- Group/병합 셀이 필요한 사례
- 긴 결시자 처리 문장

POC 통과 기준:

- 텍스트 잘림/겹침 없음
- 표 헤더 반복 정상
- 일반 행 불필요한 분할 없음
- 초대형 행 fallback 정상
- 세로/가로 정책 정상
- Preview와 PDF 구조가 크게 다르지 않음

이 POC 결과에 따라 Domain/Template Schema가 부족한 경우 UI를 전부 완성하기 전에 보완한다.
