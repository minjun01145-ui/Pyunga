# Repository Stabilization 기준

## 결론

현재 저장소는 재작성하지 않는다.

핵심 Domain과 모듈 경계는 유지할 가치가 있으며, 지금 필요한 작업은 대규모 재설계가 아니라 중복/placeholder를 제거하는 보수적 가지치기다.

## 유지하는 핵심 구조

- Next.js 기반 Modular Monolith
- `app / modules / shared` 경계
- Domain / Application / Infrastructure / UI 책임 분리 원칙
- `EvaluationPlan`
- `PerformanceAssessment`
- `EvaluationSection`
- `ScoringModel`
- 학사일정 모듈
- Template 모듈
- Document Export 모듈
- AI가 Domain 사실을 확정하지 않는 원칙

## 이번 정리에서 제거할 명백한 항목

다음은 현재 `main` 기준으로 제거 대상이다.

- 이미 적용이 끝난 학사일정 patch 파일 2개
- patch 적용용으로 남은 `APPLY_INSTRUCTIONS.md`
- 과거 코드정리 적용용 `APPLY_INSTRUCTIONS.txt`
- Git에 추적된 `tsconfig.tsbuildinfo`
- 내용 없는 계층을 유지하기 위한 `.gitkeep`
- UI 전용 초기화 방식으로 대체된 사용처 없는 `domain/scoring-model-factory.ts`

삭제 목록은 ZIP의 `DELETE_MANIFEST.txt`를 단일 기준으로 한다.

## 이번 정리에서 제거하지 않는 항목

다음은 당장 사용처가 작아 보여도 삭제하지 않는다.

- `template` 모듈: 오늘 확정된 학교별 Template 설계의 핵심 경계
- `document-export` 모듈: 결정론적 출력 파이프라인의 핵심 경계
- `achievement-standard`: 교수·학습 및 평가계획에서 실제 필요
- `ai-review`: 학사일정 import 및 향후 Template 초안에 실제 역할이 있음
- `.agents/skills`: 외부 개발도구용 리소스일 수 있으므로 이번 보수적 정리에서 제외
- prototype UI: 현재 수행평가 Domain 검증에 실제 사용 중이므로 제품 UI로 대체되기 전까지 유지

## 앞으로의 추상화 생성 규칙

새 타입/인터페이스/서비스/어댑터/계층을 만들 때 현재 작업에서 실제 소비하는 코드가 있어야 한다.

금지:

- 향후 사용만을 위한 placeholder 구현
- consumer가 없는 범용 abstraction
- 한 번만 쓰이는 단순 로직을 위한 별도 framework
- 학교명/교과명 기준 source code 분기
- 같은 업무 개념의 생성/검증 로직을 UI와 Domain에 중복 구현

허용:

- 여러 실제 학교/교과 사례의 차이를 설명하는 추상화
- 같은 업무 규칙을 여러 화면/출력에서 재사용하기 위한 Domain/Application 추출
- Template처럼 실제 학교별 차이를 데이터로 표현하기 위한 Schema

## 중복 발견 시 우선순위

동일한 업무 의미를 가진 로직이 둘 이상 존재하면 다음 순서로 판단한다.

1. Domain 규칙인가?
2. 입력 중 UI draft를 만들기 위한 UI 전용 초기값인가?
3. 출력용 변환인가?

서로 책임이 다르면 이름과 위치에서 차이가 분명해야 한다. 책임이 같으면 하나로 통합한다.

## 작업 단위

AI에게 큰 시스템 단위로 요청하지 않는다.

좋은 작업 단위:

```text
평가계 담당자가 교수학습표 열을 추가/삭제/순서 변경할 수 있다.
교사 화면은 해당 Template을 읽어 입력필드를 생성한다.
이번 작업에서는 PDF/Firebase/승인흐름은 구현하지 않는다.
```

피해야 할 요청:

```text
관리자 시스템 전체를 만들어라.
평가 플랫폼 아키텍처를 완성해라.
```

업무 흐름 하나를 구현하고 필요한 구조만 확장한다.

## 정리 후 원칙

정기적으로 저장소 전체를 갈아엎는 "대청소"를 반복하지 않는다.

각 기능을 구현할 때 해당 기능 주변의 죽은 코드, 중복, 문서 불일치를 함께 정리한다.
