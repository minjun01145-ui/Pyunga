# EvalFlow / Pyunga

중학교 교과별(학년별) 교수·학습 및 평가계획의 작성, 검증, 취합, 출력을 지원하는 웹 애플리케이션입니다.

과목교사는 평가 내용 입력에 집중하고, 평가계는 학교 공통 설정부터 전 과목 최종 취합까지 한 곳에서 운영합니다.

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

## 주요 업무

- 평가계: 학년도·학기와 학교 정보, 공통 평가 문구, 학사일정, 문서 양식, 담당 교사·학년·교과 설정
- 과목교사: 양식 기반 교수·학습 및 평가계획 작성, 검증, 임시 저장, 제출
- 평가계: 과목별 작성 현황 확인, 제출본 검토·수정 요청·승인, 승인 자료 취합
- 최종본: 학교 양식의 미리보기와 브라우저 인쇄/PDF 저장
- 계정: 교사 계정 발급, 담당 정보 변경, 사용 중지, 비밀번호 초기화

평가계획 입력 양식은 제한된 Schema로 설정합니다. 작년도 PDF 분석은 양식 초안을 제안할 뿐이며, 최종 문서 생성에는 AI를 사용하지 않습니다.

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

개발 환경에서는 `NEXT_PUBLIC_AUTHENTICATION_ENABLED=true`를 설정하지 않은 경우 체험 모드로 실행합니다. 배포 환경에서는 인증이 항상 강제되며, 사용자 프로필이 없는 계정은 업무 데이터에 접근할 수 없습니다.

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
