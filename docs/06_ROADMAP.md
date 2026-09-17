# Phase Roadmap

## 현재 개발 원칙

기능을 끝까지 넓게 만들기 전에 가장 불확실한 Domain/Template 구조를 실제 입력과 출력 POC로 검증한다.

정식 렌더 엔진은 교사/평가계 화면의 주요 입력 흐름 뒤에 구현할 수 있지만, 데이터 모델이 굳기 전에 Render POC를 한 번 수행한다.

## Phase 0 — Repository Stabilization

- 명백한 중복/죽은 코드 제거
- 이미 적용된 patch/적용 안내 제거
- 추적 중인 빌드 캐시 제거
- 문서와 실제 개발 방향 일치
- 오늘 확정한 Template / 수행평가 / Rendering 설계 문서화

완료 후 전체 재작성 없이 기존 저장소에서 계속 개발한다.

## Phase 1 — 골격 / 수행평가 Domain Prototype

현재까지의 핵심:

- Next.js/TypeScript 프로젝트
- Modular Monolith 경계
- 역할 Domain
- 학사일정 PDF/AI 가져오기 기초
- 수행평가 ScoringModel 확장 구조
- 4개 구조화 ScoringModel 입력 프로토타입
- Domain validation 및 테스트

수행평가 prototype은 실제 제품 입력기로 대체되기 전까지 Domain 검증 도구로 유지한다.

## Phase 2 — Evaluation Admin: 평가계 공통 세팅

- 학사일정 설정/검토
- 학년도/학기 공통정보
- 문서 Section 목록/순서 설정
- 작년도 PDF → AI Template 초안(선택)
- 수동 Template 작성/수정
- 교수·학습표 Column Schema 설정
- 학교 공통 평가/결시 처리 정책 설정

Template은 이 시점부터 핵심 기능이며 후순위 확장기능으로 미루지 않는다.

## Phase 3 — Teacher: 평가계획 입력

- 담당 학년/교과 선택
- Template 기반 동적 입력 화면
- 교수·학습표 주차 자동 생성 및 입력
- 지필/수행 평가 개요
- 수행평가 세부계획
- 성취기준 연결
- Domain 검증 메시지
- 임시 상태에서 전체 입력 흐름 검증

인증/DB가 완성되지 않아도 메모리/fixture 기반으로 사용자 흐름을 먼저 검증할 수 있다.

## Render POC Gate

Phase 2~3의 핵심 Schema가 동작하면 정식 문서엔진 전에 반드시 POC를 수행한다.

- 긴 교수·학습표
- 복잡한 수행평가 루브릭
- 반복 헤더
- 페이지 분할
- portrait/landscape
- 긴 행 fallback

POC에서 데이터 구조 문제가 발견되면 Phase 2~3 모델을 먼저 보완한다.

## Phase 4 — 저장/계정/권한/업무흐름

- Firebase 저장구조 확정
- 로그인
- SCHOOL_ADMIN 계정/권한 관리
- SubjectAssignment
- 서버 중심 업무 write
- 평가계획 임시저장/제출/반려/승인
- 작성현황

UI 프로토타입에서 검증된 Domain을 저장 구조에 반영한다.

## Phase 5 — 정식 Document Engine

- Domain Data → Document View Model
- Template Resolver
- Layout Engine
- Print HTML/CSS
- Chromium PDF
- Preview
- 페이지 분할 정책
- 전교과 출력/공개용 출력 확장 기반

PDF 최종 생성에는 AI를 사용하지 않는다.

## Phase 6 — 사용성/학교 운영 기능 보강

- 학교관리자 UX
- 계정 관리
- 평가관리자 대시보드
- 오류/누락 탐색
- 입력 복사/재사용
- 전년도 자료 재사용
- 접근성/모바일 최소 대응

## Phase 7 — AI 보조 고도화

- 작년도 평가계획 PDF Template 분석
- 입력 내용 검토
- 누락/불일치 후보 제안
- AI 호출 비용/메트릭 관리

AI 결과는 항상 사용자 검토 가능한 제안으로 취급한다.

## Phase 8 — 확장

- 학교별 다양한 Template
- 전교과 평가요약표
- 교육계획서용 출력
- 학부모 공개용 출력
- HWPX/Excel 가능성 검토
- NEIS Export Adapter
- 수행평가 일정 집중도 분석
