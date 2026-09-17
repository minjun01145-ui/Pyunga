# EvalFlow / Pyunga

중학교 교과별(학년별) 교수·학습 및 평가계획의 작성, 검증, 취합, 출력을 지원하는 웹 애플리케이션입니다.

교사는 문서 서식보다 평가 내용 입력에 집중하고, 평가관리자는 학교의 평가계획 구조와 공통 규칙을 설정한 뒤 작성 현황과 오류를 한 곳에서 확인하는 것을 목표로 합니다.

## 핵심 제품 흐름

```text
평가계 담당자
  학사일정 + 학교 Template 설정
        ↓
교사
  Template 기반 교수·학습/평가 데이터 입력
        ↓
Domain 검증 / 제출 / 검토
        ↓
결정론적 Document Renderer
        ↓
PDF 및 파생 출력
```

작년도 평가계획 PDF를 AI가 분석하여 Template 초안을 제안할 수 있지만, 최종 Template은 사용자가 검토/수정합니다. 최종 PDF 생성에는 AI를 사용하지 않습니다.

## 현재 구현 범위

- 일반 교사 / 평가관리자 / 학교관리자 화면 구분
- 학사일정 PDF/AI 가져오기 기초
- 수행평가 기본정보 입력 프로토타입
- 영역별 평가와 전체 단일기준 평가
- 수준별 배점, 횟수·기록별 배점, 조건 충족 개수별 배점, 세부항목 합산
- 수행평가 점수 구조 검증
- Domain 규칙 자동 테스트

학교 Template 설정, 교사용 전체 평가계획 입력, 정식 문서 출력은 설계 문서 기준으로 단계적으로 연결합니다.

## 기술 구성

- Next.js
- React
- TypeScript
- Firebase App Hosting
- Firebase Authentication / Cloud Firestore / Firebase Admin SDK
- Zod
- Vitest

## 실행

```bash
npm install
npm run dev
```

계정 관리 기능이 완성되기 전까지 로컬과 호스팅 환경 모두에서 로그인과 역할 검사를 생략합니다. 계정 기능을 연결할 때는 공통 인증 모드를 다시 활성화해야 합니다.

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

업무 규칙은 `src/modules/*/domain`에 두고 React/Firebase/문서 렌더링 구현과 분리합니다.

## 핵심 개발 문서

- `CONTRIBUTING.md`
- `docs/01_PRODUCT.md`
- `docs/02_DOMAIN.md`
- `docs/03_ARCHITECTURE.md`
- `docs/06_ROADMAP.md`
- `docs/07_DECISIONS.md`
- `docs/13_EVALUATION_TEMPLATE_DESIGN.md`
- `docs/14_PERFORMANCE_ASSESSMENT_DESIGN.md`
- `docs/15_DOCUMENT_RENDERING.md`
- `docs/16_REPOSITORY_STABILIZATION.md`
- `docs/17_FIREBASE_PERSISTENCE.md`
