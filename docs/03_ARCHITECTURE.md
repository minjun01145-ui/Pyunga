# Architecture

## 선택: Modular Monolith

하나의 Next.js 앱을 사용하되 업무 모듈의 경계를 강하게 유지한다.

마이크로서비스를 도입하지 않는다.
1인/소규모 개발 단계에서 배포와 디버깅 복잡도만 늘어나기 때문이다.

## 구조

```text
src/
├─ app/                          # URL/페이지 조립
│  ├─ teacher/
│  └─ admin/
│     ├─ evaluation/
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
└─ shared/
   ├─ firebase/
   ├─ ui/
   └─ validation/
```

## 복잡한 모듈 내부

```text
module/
├─ domain/          # 순수 업무 개념/규칙
├─ application/     # use case
├─ infrastructure/  # Firebase/API 등 구현
├─ ui/              # React UI
└─ index.ts          # 외부 공개 API
```

모든 모듈에 빈 폴더를 억지로 만들지 않는다.
실제 책임이 생길 때 추가한다.

## Domain

Domain은 프레임워크 독립적이다.

금지:

- React import
- Next.js import
- Firebase import
- PDF/HTML 전용 필드

## Application

사용자가 수행하는 업무를 표현한다.

예:

- createEvaluationPlan
- submitEvaluationPlan
- reviewEvaluationPlan
- provisionSchoolUser
- createEvaluationTemplate
- generateTeachingLearningWeeks

실제 use case가 없는데 interface/service 이름만 미리 만들지 않는다.

## Infrastructure

외부 시스템 구현을 캡슐화한다.

예:

- FirestoreEvaluationPlanRepository
- FirebaseUserAccountProvisioner
- AiReviewClient
- ChromiumPdfRenderer

인증/저장/렌더 기술이 바뀌더라도 Application/Domain을 최대한 유지할 수 있어야 한다.

## UI

업무 규칙을 직접 계산하지 않는다.
Domain/Application의 결과를 표시하고 사용자 입력을 전달한다.

입력 중 빈 문자열/미완성 숫자 등은 Form Draft가 처리하고, 제출/검증 시 Domain Model로 변환할 수 있다.

## Template

Template은 학교별 문서 구조와 교사 입력 Schema를 연결한다.

```text
Academic Calendar
      ↓
Evaluation Template
  ├─ Section Schema
  ├─ TeachingLearning Column Schema
  └─ Layout Policy
      ↓
Teacher Input UI
      ↓
EvaluationPlan Domain Data
```

학교별 차이를 source code 조건문으로 처리하지 않는다.

AI는 작년도 PDF에서 Template 초안을 만들 수 있지만 제한된 Template Schema만 생성한다. AI가 만든 임의 UI 코드를 실행하지 않는다.

## 문서 출력

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

향후 HWPX/Excel 출력이 추가되더라도 Domain Data를 다시 정의하지 않는다.

최종 문서 생성 시 LLM을 호출하지 않는다.

### Pagination

- 표 헤더 반복
- 일반 행 `break-inside` 최소화
- 수행평가 채점 블록 keep-together 우선
- Section별 page break/orientation
- 한 페이지보다 큰 블록의 명시적 fallback

화면 캡처를 핵심 PDF 방식으로 사용하지 않는다.

## Render POC

정식 PDF 엔진은 주요 입력 UI 뒤에 완성할 수 있으나, Domain/Template Schema가 굳기 전에 긴 교수·학습표와 복잡한 수행평가로 POC를 수행한다.

POC는 기술 데모가 아니라 데이터 모델 검증 gate다.

## AI 경계

AI 사용:

- 학사일정 문서 구조화 초안
- 작년도 평가계획 Template 분석 초안
- 내용 검토/누락 후보 제안

AI 비사용:

- 평가 사실의 무검토 확정
- 최종 PDF 레이아웃 생성
- 페이지 분할 결정
- 실행 가능한 임의 React/JS 생성

## 인증

교사 계정은 평가계 담당자가 이름·교과·수업 학년을 입력해 발급하고, 담당 변경·사용 중지·비밀번호 초기화도 평가계 영역에서 처리한다.
서버가 `user0001` 형태의 로그인 ID를 자동 생성하고, 이 값을 Firebase Authentication UID로 그대로 사용한다.
따라서 사람용 로그인 ID를 가짜 이메일로 변환하거나 별도 ID 매핑 테이블을 두지 않는다.

초기 비밀번호와 변경 비밀번호는 서버에서 해시로만 저장한다.
로그인 시 서버가 ID/비밀번호를 검증한 뒤 Firebase custom token을 발급하고,
브라우저는 `signInWithCustomToken`으로 기존 ID-token 기반 API 인증 흐름을 그대로 사용한다.
계정 생성과 변경·비밀번호 초기화는 `UserAccountProvisioner` 경계 뒤에서 수행한다.

## Firebase 접근 정책

초기 업무 데이터 쓰기는 서버 중심 구조를 기본안으로 둔다.

```text
Browser
 -> Next.js server/application
 -> authorization
 -> Firebase Admin SDK
 -> Firestore/Auth
```

권한 로직이 브라우저 곳곳에 분산되지 않도록 한다.
