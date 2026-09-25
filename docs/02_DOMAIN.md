# Domain Model

## 문서의 논리적 구성

부산 중학교의 교과별(학년별) 교수·학습 및 평가계획은 학교마다 표 모양은 다르지만 대체로 다음 의미 단위를 공유한다.

1. 기본정보
2. 평가 방향/방침
3. 교수·학습 및 평가 연계계획
4. 평가 총괄
5. 수행평가 세부계획
6. 성취기준/성취수준
7. 기타 평가 처리사항

DB는 문서 페이지/표 모양을 그대로 복제하지 않는다.
의미 데이터를 구조화하고 Template이 입력 필드 구성과 출력 레이아웃을 결정한다.

## 주요 Entity / Value Object

- School
- User
- Role
- AcademicYear
- Semester
- Subject
- SubjectAssignment
- AcademicCalendarEvent
- EvaluationPlan
- WrittenAssessment
- PerformanceAssessment
- EvaluationSection
- ScoringModel
- AchievementStandard
- TeachingLearningPlanItem
- EvaluationTemplate
- DocumentSectionTemplate
- TeachingLearningTableTemplate

Template 관련 타입은 실제 구현 시 별도 template module에 두며 EvaluationPlan Domain에 출력 모양을 섞지 않는다.

## 사용자 역할

```text
EVALUATION_ADMIN
TEACHER
```

`school_admin`으로 저장된 기존 프로필은 호환 경계에서 `evaluation_admin`으로 읽는다. 신규 권한 모델에는 학교관리자 역할을 두지 않는다.

권한은 문자열 곳곳에 흩뿌리지 않고 auth domain에 하나의 타입으로 관리한다.

## EvaluationPlan 상태

```text
draft
  -> submitted
submitted
  -> approved
submitted
  -> rejected
rejected
  -> draft
```

상태 전이는 Domain/Application 규칙으로 관리한다.

## 교수·학습 계획

교수·학습표의 행은 학사일정을 기준으로 주차 후보를 생성할 수 있다.

`TeachingLearningPlanItem`은 주차/기간과 교사가 입력한 실제 수업 데이터를 표현한다.
학교별 열 이름/순서/표 모양은 Domain이 아니라 `TeachingLearningTableTemplate`에서 결정한다.

성취기준처럼 구조화 가능한 값은 문자열 복사보다 공식 `AchievementStandard` 참조를 우선한다.

## 수행평가

수행평가 개수는 고정하지 않는다.
`performanceAssessments[]` 형태로 모델링한다.

각 수행평가는 0개 이상의 영역(Section)을 가질 수 있다.
영역이 없는 기록형 평가처럼 전체 평가에 하나의 ScoringModel을 적용하는 경우도 허용한다.

실제 문서에서 `과정/결과` 같은 상위 묶음이 필요한 사례를 위해 선택적 1단계 Group을 도입할 수 있다. 재귀적 무한 계층은 만들지 않는다.

### ScoringModel

- `level_table`: 수준별 배점
- `threshold_table`: 횟수/기록/수량별 배점
- `criterion_count`: 충족 조건 개수별 배점
- `additive_rubric`: 여러 세부항목 합산
- `custom_table`: 구조화가 어려운 실제 예외용

새 유형은 기존 모델로 자연스럽게 표현할 수 없는 실제 사례가 확인될 때만 추가한다.

## School Evaluation Policy

결시자, 전입생, 미제출, 기본점수 등 학교 공통 규칙은 가능한 한 학교 공통 Policy로 관리하고 각 수행평가에서 필요할 때만 override한다.

## Template

Template은 학교의 문서 차이를 표현한다.

- Section 순서/제목
- 교수·학습표 Column Schema
- 표시명
- 출력 orientation
- page-break 정책
- 반복 헤더 등

Template 설정이 Domain 평가 사실 자체를 변경해서는 안 된다.

## 중요한 불변조건

- 평가 반영비율은 학교/교육청 규칙에 맞아야 한다.
- 수행 영역의 배점/점수범위는 상위 평가 구조와 일관되어야 한다.
- 학사일정의 공식 날짜는 중앙 설정을 참조한다.
- 성취기준 존재 여부는 공식 데이터가 판단한다.
- Template은 Domain 데이터를 변경하지 않는다.
- AI는 Domain의 사실을 확정하지 않는다.
- PDF Renderer는 Domain 계산을 다시 구현하지 않는다.
