# Architecture Decision Records (summary)

## ADR-001 Modular Monolith
선택: 하나의 Next.js 앱 + 모듈 경계.

이유: 1인/소규모 개발에서 마이크로서비스보다 단순하고, 모듈화를 유지할 수 있음.

## ADR-002 Teacher/Admin은 같은 프로젝트

경로는 분리하지만 데이터/Domain/공용 UI는 재사용한다.

## ADR-003 Firebase App Hosting

GitHub live branch push 기반 배포 흐름을 사용한다.

## ADR-004 Server-mediated business writes

초기 업무 데이터 쓰기는 서버를 기본 경계로 둔다.
브라우저 곳곳에서 Firestore write가 난립하는 것을 막는다.

## ADR-005 로그인 ID는 Firebase UID로 사용

평가계가 교사 계정을 발급하면 서버가 `user0001` 형태의 로그인 ID를 자동 생성한다.
이 ID를 Firebase Authentication UID로 그대로 사용하고, 가짜 이메일이나 별도 매핑 컬렉션은 만들지 않는다.
비밀번호는 서버에서 해시로 검증하며 로그인 성공 시 Firebase custom token을 발급한다.

## ADR-006 개인정보 최소화

시제품 교사 표시명은 `김OO (교과)` 형태.

## ADR-007 UI는 업무용

이모지/장식 최소화. 표/폼/텍스트 우선.

## ADR-008 ScoringModel Registry

수행평가의 다양한 구조를 과목별 하드코딩이 아닌 확장 가능한 scoring model로 처리.

## ADR-009 학교 Template이 교사 입력을 정의

평가계 담당자가 문서 Section, 교수·학습표 열, 공통 정책을 설정한다.
교사 입력 UI는 이 Template을 읽어 필요한 데이터필드를 제공한다.

Template은 출력 모양만 꾸미는 후처리 기능이 아니라 입력 Schema와 출력 구조를 연결하는 핵심 구성이다.

## ADR-010 작년도 PDF AI 분석은 Template 초안 생성용

AI는 작년도 평가계획 PDF에서 Section/열/레이아웃 후보를 추출할 수 있다.
결과는 담당자가 검토·수정해야 하며 Domain 사실을 자동 확정하지 않는다.
AI가 생성한 임의 React/JavaScript 코드를 실행하지 않는다.

## ADR-011 최종 문서 생성은 결정론적 Renderer

최종 PDF 생성 시 LLM을 호출하지 않는다.

기본 파이프라인:

```text
Domain Data
 -> Document View Model
 -> Template Resolver
 -> Layout Engine
 -> Print HTML/CSS
 -> Headless Chromium
 -> PDF
```

세부 기술 선택은 Render POC 결과로 확정한다.

## ADR-012 Render POC를 데이터 모델 확정 전에 수행

정식 Renderer 구현은 뒤에 하되, 평가계/교사 핵심 입력 흐름이 잡힌 시점에 긴 교수·학습표와 복잡한 수행평가로 출력 POC를 수행한다.

목적은 렌더링 구현 자체보다 Domain/Template Schema가 실제 문서를 감당하는지 조기에 검증하는 것이다.

## ADR-013 수행평가 자유표보다 구조화 모델 우선

기본은 `EvaluationSection + ScoringModel`로 표현한다.
필요한 경우 1단계 Group을 추가할 수 있으나 재귀적 무한 트리는 만들지 않는다.
`custom_table`은 기존 모델로 표현하기 어려운 실제 예외의 fallback으로 둔다.

## ADR-014 사용처 없는 미래 추상화를 만들지 않음

새 abstraction에는 현재 작업의 실제 consumer가 있어야 한다.
미래 가능성만을 위한 placeholder, 빈 계층, 중복 factory를 만들지 않는다.
실제 여러 사례를 설명하는 Domain/Template 추상화는 유지한다.
