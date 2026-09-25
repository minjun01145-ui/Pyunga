# Firebase 저장 구조

## 원칙

- 업무 데이터 쓰기는 브라우저에서 Firestore로 직접 보내지 않는다.
- 브라우저는 Firebase Authentication ID 토큰을 Next.js API에 전달한다.
- 서버는 토큰을 검증한 뒤 `users/{uid}` 프로필에서 학교와 역할을 확인한다.
- Firebase Admin SDK만 명명된 `pyunga-seoul` 데이터베이스에 업무 데이터를 기록한다.
- Firestore Security Rules는 브라우저의 모든 읽기와 쓰기를 차단한다.

## Firestore 인스턴스

- 프로젝트: `inaday-74f68`
- 데이터베이스 ID: `pyunga-seoul`
- 에디션: Enterprise, Firestore Native mode
- 리전: `asia-northeast3` (Seoul)

## 사용자 프로필

Firebase Authentication 계정만으로는 업무 권한을 부여하지 않는다. 계정 UID와 같은 문서 ID로 다음 프로필이 있어야 한다.

```text
users/{uid}
  schoolId: string
  displayName: string
  subjectLabel?: string
  teachingGrades: (1 | 2 | 3)[]
  role: "evaluation_admin" | "teacher"
  active: boolean
  mustChangePassword: boolean
  passwordCredential: { salt: string, hash: string }
  failedLoginAttempts: number
  loginLockedUntil: number
```

일반 교사 계정의 `uid`는 평가계가 보는 자동 로그인 ID(`user0001` 등)와 같다.
`passwordCredential`은 서버에서만 읽는 해시 정보이며 비밀번호 원문은 저장하지 않는다.
`failedLoginAttempts`와 `loginLockedUntil`은 4자리 임시 비밀번호 로그인 시 반복 시도를 제한하기 위한 서버 전용 상태다.
프로필 문서는 신뢰된 관리자 작업으로만 생성한다. 사용자가 자신의 역할이나 학교를 직접 만들거나 변경할 수 있는 클라이언트 경로는 제공하지 않는다.
기존 `school_admin` 역할은 인증 경계에서 `evaluation_admin`으로 변환해 읽는다.

## 현재 저장 경로

```text
schools/{schoolId}/academicYears/{academicYear}/calendarEvents/{eventId}
schools/{schoolId}/evaluationTemplates/current
schools/{schoolId}/evaluationPlans/{planId}
schools/{schoolId}/users/{uid}/performanceAssessmentDrafts/{assessmentId}
```

학사일정은 동일한 일정의 중복 저장을 줄이기 위해 핵심 필드에서 결정적으로 만든 ID를 사용한다. 평가계획 양식은 학교 단위의 현재 Template을 `evaluationTemplates/current`에 저장하고, 문서 Section의 제목·7단계 계층·순서·상위 항목 관계·`teacherEditableTitle` 정책, 원본 PDF 메타데이터, 검증된 Section별 입력 양식 `config`를 보관한다. `config`에는 교수학습-평가 표의 필드·입력 방식·배치와 과목 공통 평가 문구처럼 학교 양식을 재현하는 정보만 저장하며 실제 교과 입력값은 넣지 않는다. `teacherEditableTitle=true`이면 저장된 제목은 교사용 편집기에서 회색 예시 제목으로 사용하고 교과가 실제 제목을 정할 수 있으며, `false`이면 평가계 제목을 고정한다.

공식 교과 평가계획은 사용자·학년도·학기·학년·교과 조합에서 결정적으로 만든 `planId`로 저장한다. 문서에는 Form Draft, 상태(`draft/submitted/rejected/approved`), revision, 담당자와 컨텍스트를 보관한다. 제출·승인된 문서의 재현성을 위해 제출 시점의 Template과 적용 학사일정도 함께 snapshot으로 저장하며, revision precondition을 사용해 오래된 화면의 덮어쓰기를 막는다.

교사용 전체 평가계획 입력의 비로그인 데모는 Firestore에 저장하지 않는다. 인증 비활성 데모 모드는 개발 환경에서만 사용할 수 있으며, 교사 작성 화면은 고정 demo context(`2026학년도 2학기 · 3학년 · 영어`)를 사용한다. 데모 Form Draft는 브라우저 로컬 저장소에 보관하며, 학교 Template과 저장된 학사일정만 서버에서 읽는다. 교수·학습표에 표시되는 월·주·기간·주요일정 값은 학사일정에서 매번 계산하는 파생값이므로 교사 Draft에 복제 저장하지 않는다. 배포 환경은 항상 인증이 필요하다.

현재 학기 승인본 취합은 `context.academicYear`, `context.semester`, `status` 복합 인덱스를 사용한다. `firestore.indexes.json`의 인덱스가 배포된 뒤 평가계에서 전 과목 취합을 사용할 수 있다.

## 최초 운영 준비

1. App Hosting Secret Manager에 32바이트 이상의 `PYUNGA_INITIAL_ADMIN_KEY`를 등록한다. 이 값으로 보호된 `/api/auth/initial-evaluation-admin` 경로는 최초 평가계 계정만 한 번 생성하며, 기존 평가계가 있거나 초기화 표식이 기록되면 다시 사용할 수 없다.
2. 최초 계정에는 학교 내부 식별자, 담당자 이름, 로그인 아이디, 12자 이상의 임시 비밀번호를 넣는다. 생성된 계정은 첫 로그인에서 비밀번호 변경을 요구한다.
3. 이후 일반 교사 계정은 평가계 화면의 사용자/과목 관리에서 발급한다.
4. 로컬에서 인증 흐름을 시험할 때 `NEXT_PUBLIC_AUTHENTICATION_ENABLED=true`를 설정한다. 배포 환경은 이 값을 지정하지 않아도 인증을 요구한다.

교사 계정 생성 시 Firebase Auth에는 이메일을 만들지 않는다. 로그인 ID 자체가 Auth UID이며, 비밀번호 검증은 서버가 담당한다.
