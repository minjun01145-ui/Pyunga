# Architecture Decision Records (summary)

## ADR-001 Modular Monolith
선택: 하나의 Next.js 앱 + 모듈 경계.

이유: 1인 개발에서 마이크로서비스보다 단순하고, 모듈화를 유지할 수 있음.

## ADR-002 Teacher/Admin은 같은 프로젝트

경로는 분리하지만 데이터/Domain/공용 UI는 재사용한다.

## ADR-003 Firebase App Hosting

이미 Blaze 요금제를 사용하고 있고, GitHub live branch push 자동 배포를 사용할 수 있기 때문.

## ADR-004 Server-mediated business writes

초기 업무 데이터 쓰기는 서버를 기본 경계로 둔다.
브라우저 곳곳에서 Firestore write가 난립하는 것을 막는다.

## ADR-005 로그인 ID 구현은 보류

학교관리자가 계정을 발급한다는 업무 흐름만 확정.
Firebase Auth와 임의 ID의 연결 방식은 별도 검토 후 결정.

## ADR-006 개인정보 최소화

시제품 교사 표시명은 `김OO (교과)` 형태.

## ADR-007 UI는 업무용

이모지/장식 최소화. 표/폼/텍스트 우선.

## ADR-008 ScoringModel Registry

수행평가의 다양한 구조를 과목별 하드코딩이 아닌 확장 가능한 scoring model로 처리.
