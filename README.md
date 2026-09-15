# EvalFlow Phase 1 Skeleton

중학교 교과별(학년별) 교수·학습 및 평가계획 작성·검증·취합 시스템의 1단계 프로젝트 골격입니다.

이 저장소는 **기능을 많이 만든 시제품**이 아니라, 이후 기능이 늘어나도 구조가 무너지지 않도록 경계를 먼저 만든 골격입니다.

## 핵심 원칙

- 하나의 Next.js 앱 안에서 역할별 화면을 분리한다.
- 업무 로직은 `src/app`에 넣지 않는다.
- 평가 데이터와 문서 출력 서식을 분리한다.
- 계산 가능한 검증은 순수 TypeScript Domain 코드로 구현한다.
- 학교/교과별 차이를 `if` 하드코딩으로 처리하지 않는다.
- AI는 보조 검토에만 사용하며, AI 결과를 공식 데이터에 자동 반영하지 않는다.
- 시제품 UI는 기본 글꼴·텍스트·표·폼 중심으로 구성한다. 이모지와 장식성 디자인은 사용하지 않는다.

## 현재 기술 결정

- Next.js 16.3.3
- React 19.2
- TypeScript
- Firebase App Hosting
- Firebase Authentication
- Cloud Firestore
- Firebase Storage (향후 문서/첨부 필요 시)
- Firebase Admin SDK (서버 권한 작업)
- Zod (입력/AI 응답 스키마 검증)
- Vitest (Domain 테스트)

## 시작

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## 품질 확인

```bash
npm run check
npm run build
```

AI 코딩 도구에게 작업을 맡기기 전 반드시 `AGENTS.md`를 읽게 하십시오.

## Phase 1에서 일부러 하지 않은 것

- 실제 Firebase 로그인 화면
- 실제 학교관리자 계정 발급
- 평가계획 Firestore 저장
- PDF 생성
- AI API 연결
- NEIS 연계
- 학교별 템플릿 편집기

위 기능은 골격 검증 후 순차적으로 구현합니다.

## 먼저 읽을 문서

1. `docs/01_PRODUCT.md`
2. `docs/02_DOMAIN.md`
3. `docs/03_ARCHITECTURE.md`
4. `AGENTS.md`
5. `docs/04_SECURITY.md`
6. `docs/05_UI_GUIDELINES.md`
7. `docs/06_ROADMAP.md`
8. `docs/07_DECISIONS.md`


## Phase 2 프로토타입

실행 후 `/teacher/performance-prototype`에서 수행평가 세부기준 편집기를 확인할 수 있습니다.

이번 단계는 Firebase 저장 이전에 수행평가 Domain 구조를 검증하기 위한 프로토타입입니다.
상세 확인 항목은 `docs/10_PHASE2_CHECKLIST.md`를 참고하십시오.
