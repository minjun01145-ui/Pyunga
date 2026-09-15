# Phase Roadmap

## Phase 1 — 골격

완료 조건:

- Next.js/TypeScript 프로젝트 실행
- 모듈 폴더 구조
- 역할 Domain
- 수행평가 ScoringModel 확장 구조
- 기본 검증 함수/테스트
- Teacher/Admin 역할별 빈 업무 화면
- Firebase 연결 코드의 안전한 위치 마련
- GitHub → Firebase App Hosting 배포 문서

아직 실제 로그인/DB CRUD는 필수 아님.

## Phase 2 — 수행평가 Domain Prototype

- 실제 수행평가 입력 모델 확정
- level_table
- threshold_table
- criterion_count
- additive_rubric
- domain validation
- 테스트 확대

## Phase 3 — 계정/권한

- SCHOOL_ADMIN 계정 흐름
- 계정 발급 방식 확정
- 로그인
- 역할 guard
- 평가관리자 부여

## Phase 4 — Teacher 평가계획 작성

- 담당 교과 배정
- 평가계획 생성/임시저장/수정
- 제출

## Phase 5 — Evaluation Admin

- 작성현황
- 검토/반려/승인
- 학교 공통설정

## Phase 6 — 교수학습 계획/성취기준/학사일정

## Phase 7 — 문서 출력

## Phase 8 — AI Review

## Phase 9 — 확장

- 학교별 template
- 교육계획서용 요약
- NEIS adapter
