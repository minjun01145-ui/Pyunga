# Firebase 저장 구조

## 원칙

- 업무 데이터 쓰기는 브라우저에서 Firestore로 직접 보내지 않는다.
- 브라우저는 Firebase Authentication ID 토큰을 Next.js API에 전달한다.
- 서버는 토큰을 검증한 뒤 `users/{uid}` 프로필에서 학교와 역할을 확인한다.
- Firebase Admin SDK만 명명된 `pyunga` 데이터베이스에 업무 데이터를 기록한다.
- Firestore Security Rules는 브라우저의 모든 읽기와 쓰기를 차단한다.

## Firestore 인스턴스

- 프로젝트: `inaday-74f68`
- 데이터베이스 ID: `pyunga`
- 에디션: Enterprise, Firestore Native mode
- 리전: `us-east4`

## 사용자 프로필

Firebase Authentication 계정만으로는 업무 권한을 부여하지 않는다. 계정 UID와 같은 문서 ID로 다음 프로필이 있어야 한다.

```text
users/{uid}
  schoolId: string
  displayName: string
  subjectLabel?: string
  role: "school_admin" | "evaluation_admin" | "teacher"
  active: boolean
```

프로필 문서는 신뢰된 관리자 작업으로만 생성한다. 사용자가 자신의 역할이나 학교를 직접 만들거나 변경할 수 있는 클라이언트 경로는 제공하지 않는다.

## 현재 저장 경로

```text
schools/{schoolId}/academicYears/{academicYear}/calendarEvents/{eventId}
schools/{schoolId}/evaluationTemplates/current
schools/{schoolId}/users/{uid}/performanceAssessmentDrafts/{assessmentId}
```

학사일정은 동일한 일정의 중복 저장을 줄이기 위해 핵심 필드에서 결정적으로 만든 ID를 사용한다. 평가계획 양식은 학교 단위의 현재 Template을 `evaluationTemplates/current`에 저장하고, 문서 Section의 제목·7단계 계층·순서·상위 항목 관계·`teacherEditableTitle` 정책, 원본 PDF 메타데이터, 검증된 Section별 입력 양식 `config`를 보관한다. `config`에는 교수학습-평가 표의 필드·입력 방식·배치처럼 학교 양식을 재현하는 정보만 저장하며 실제 교과 입력값은 넣지 않는다. `teacherEditableTitle=true`이면 저장된 제목은 교사용 편집기에서 회색 예시 제목으로 사용하고 교과가 실제 제목을 정할 수 있으며, `false`이면 평가계 제목을 고정한다. 수행평가 프로토타입은 전체 `EvaluationPlan`이 아직 구현되지 않았으므로 공식 평가계획 문서가 아니라 사용자 개인 초안으로 저장한다.

## 최초 운영 준비

1. Firebase Authentication에서 이메일/비밀번호 공급자를 활성화한다.
2. Firebase Console의 Authentication 사용자 화면에서 최초 학교관리자 계정을 만든다.
3. 생성된 UID로 `users/{uid}` 프로필을 만들고 `school_admin`, 학교 ID, 표시명, 활성 상태를 지정한다.
4. 이후 계정 발급 기능은 서버에서 Firebase Admin SDK와 동일한 프로필 생성을 함께 수행해야 한다.

로그인 계정의 이메일과 비밀번호는 Firestore 프로필에 복사하지 않는다.
