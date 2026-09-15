# EvalFlow

중학교 교과별(학년별) 교수·학습 및 평가계획의 작성, 검증, 취합을 지원하는 웹 애플리케이션입니다.

교사는 문서 서식보다 평가 내용 입력에 집중하고, 평가관리자는 작성 현황과 오류를 한 곳에서 확인할 수 있도록 하는 것을 목표로 합니다.

## 현재 구현 범위

- 일반 교사 / 평가관리자 / 학교관리자 화면 구분
- 수행평가 기본정보 입력
- 영역별 평가와 전체 단일기준 평가
- 수준별 배점, 횟수·기록별 배점, 조건 충족 개수별 배점, 세부항목 합산
- 수행평가 점수 구조 검증
- Domain 규칙 자동 테스트

Firebase Authentication, Firestore 저장, 문서 출력 기능은 이후 단계에서 연결합니다.

## 기술 구성

- Next.js
- React
- TypeScript
- Firebase App Hosting
- Firebase Authentication
- Cloud Firestore
- Firebase Admin SDK
- Zod
- Vitest

## 실행

```bash
npm install
npm run dev
```

개발 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## 품질 확인

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

## 프로젝트 구조

```text
src/
├─ app/                      # 라우팅과 화면 조립
├─ modules/
│  ├─ auth/
│  ├─ school/
│  ├─ academic-calendar/
│  ├─ evaluation-plan/
│  ├─ performance-assessment/
│  ├─ achievement-standard/
│  ├─ template/
│  ├─ document-export/
│  └─ ai-review/
└─ shared/                   # 기술 공통 요소
```

업무 규칙은 `src/modules/*/domain`에 두고 React나 Firebase 구현과 분리합니다.

## 개발 문서

- `CONTRIBUTING.md`
- `docs/01_PRODUCT.md`
- `docs/02_DOMAIN.md`
- `docs/03_ARCHITECTURE.md`
- `docs/04_SECURITY.md`
- `docs/05_UI_GUIDELINES.md`
- `docs/06_ROADMAP.md`
- `docs/07_DECISIONS.md`
