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
위 의미 데이터를 구조화하고 Template이 출력 레이아웃을 결정한다.

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

## 사용자 역할

```text
SCHOOL_ADMIN
EVALUATION_ADMIN
TEACHER
```

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

## 수행평가

수행평가 개수는 고정하지 않는다.
`performanceAssessments[]` 형태로 모델링한다.

각 수행평가는 0개 이상의 영역(Section)을 가질 수 있다.
영역이 없는 체육 기록형 평가처럼 전체 평가에 하나의 ScoringModel을 적용하는 경우도 허용할 수 있도록 확장성을 남긴다.

### 현재 ScoringModel 후보

- `level_table`: 수준별 배점
- `threshold_table`: 횟수/기록/수량별 배점
- `criterion_count`: 충족 조건 개수별 배점
- `additive_rubric`: 여러 세부항목 합산
- `custom_table`: 구조화가 어려운 예외용

이 목록은 확장 가능한 registry로 관리한다.

## 중요한 불변조건

- 평가 반영비율은 학교 규칙에 맞아야 한다.
- 수행 영역의 배점/점수범위는 상위 평가 구조와 일관되어야 한다.
- 학사일정의 공식 날짜는 중앙 설정을 참조한다.
- 성취기준 존재 여부는 공식 데이터가 판단한다.
- AI는 Domain의 사실을 확정하지 않는다.
