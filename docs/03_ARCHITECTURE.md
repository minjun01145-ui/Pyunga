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
│     └─ school/
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

모든 모듈에 빈 폴더를 억지로 만들지는 않는다.
실제 책임이 생길 때 추가한다.

## Domain

Domain은 프레임워크 독립적이다.

금지:
- React import
- Next.js import
- Firebase import

## Application

사용자가 수행하는 업무를 표현한다.

예:
- createEvaluationPlan
- submitEvaluationPlan
- reviewEvaluationPlan
- provisionSchoolUser

## Infrastructure

외부 시스템 구현을 캡슐화한다.

예:
- FirestoreEvaluationPlanRepository
- FirebaseUserAccountProvisioner
- AiReviewClient

인증 방식이 나중에 바뀌더라도 Application/Domain을 최대한 유지할 수 있어야 한다.

## UI

업무 규칙을 직접 계산하지 않는다.
Domain/Application의 결과를 표시하고 사용자 입력을 전달한다.

## 인증

학교관리자가 계정을 발급하는 제품 흐름은 확정하되,
Firebase에서 `로그인 ID`를 어떤 방식으로 매핑할지는 아직 확정하지 않는다.

따라서 계정 생성 기능은 `UserAccountProvisioner` 인터페이스 뒤에 둔다.

가짜 이메일 생성 등 임시 편법을 기본 구현으로 채택하지 않는다.

## Firebase 접근 정책

Phase 1에서는 브라우저가 Firestore 업무 데이터를 직접 변경하지 않는 서버 중심 구조를 기본안으로 둔다.

```text
Browser
 -> Next.js server/application
 -> authorization
 -> Firebase Admin SDK
 -> Firestore/Auth
```

장점:
- 권한 로직이 한 곳에 모임
- 브라우저별 Firestore write 패턴이 난립하지 않음

단점:
- Next.js 서버 코드와 권한검사가 중요해짐
- Firebase 실시간 클라이언트 기능을 바로 쓰기 어려움

필요 시 읽기 전용 realtime 요구가 생길 때 별도로 재검토한다.

## 출력

```text
Domain Data
 -> Document View Model
 -> Template
 -> PDF / 향후 HWPX / Excel
```

화면 캡처를 핵심 PDF 방식으로 사용하지 않는다.

## Template

학교별 차이를 소스코드 조건문으로 처리하지 않는다.

```text
Evaluation Data
 -> Template Schema A
 -> Template Schema B
```

Template 엔진은 이후 모듈로 추가한다.
