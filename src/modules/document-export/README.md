# Document Export module

교과별 평가계획과 파생 문서의 결정론적 출력을 담당합니다.

## 기본 구조

```text
Domain Data
 -> Document View Model
 -> Template Resolver
 -> Layout Engine
 -> Print HTML/CSS
 -> Renderer
 -> Output
```

## 출력 대상

- 교과별 상세 평가계획 PDF
- 전교과 평가요약표
- 교육계획서용 출력
- 공개용 출력
- 향후 HWPX / Excel / NEIS Export Adapter

## PDF 원칙

- 최종 생성에 AI를 사용하지 않는다.
- 우선 POC는 HTML/CSS + Headless Chromium 계열을 검토한다.
- 긴 표의 반복 헤더와 페이지 분할을 명시적으로 처리한다.
- 일반 행/채점블록은 가능한 한 페이지 중간에서 분리하지 않는다.
- 한 페이지보다 큰 블록은 별도 fallback 정책을 사용한다.
- Section별 세로/가로 및 새 페이지 시작 정책을 지원한다.
- Browser Preview와 PDF가 같은 Document View Model을 사용하도록 한다.

상세 설계는 `docs/15_DOCUMENT_RENDERING.md`를 따른다.
