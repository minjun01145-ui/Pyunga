# ScoringModel 확장 가이드

새로운 수행평가 세부기준 유형이 발견되었을 때 기존 교과별 예외문을 추가하지 않는다.

## 예시

새 유형 `range_band`가 필요하다고 가정한다.

## 변경 순서

1. `domain/scoring-model.ts`
   - 새 모델 타입 정의
   - `ScoringModel` union에 추가

2. `domain/scoring-model-registry.ts`
   - 사용자에게 표시할 이름과 자동검증 지원 여부 등록

3. `domain/scoring-model-factory.ts`
   - 새 모델의 기본 구조 생성 함수 추가

4. `domain/scoring-model-validation.ts`
   - 새 모델의 순수 검증 규칙 추가
   - 관련 테스트 추가

5. `ui/editors/`
   - 해당 유형 전용 Editor 컴포넌트 생성

6. `ui/ScoringModelEditor.tsx`
   - 새 Editor 연결

## 금지

```ts
if (subject === "체육") { ... }
if (schoolId === "some-school") { ... }
```

평가방식은 교과나 학교가 아니라 데이터 구조로 표현한다.

## 왜 switch가 남아 있는가

현재 `ScoringModel`은 TypeScript discriminated union이다.
모든 모델을 한 곳에서 명시적으로 연결하면 컴파일러가 누락된 유형을 찾기 쉽고 코드 탐색도 쉽다.

플러그인 런타임 로더처럼 완전히 동적인 구조는 현재 규모에서는 과도한 추상화로 판단하였다.
따라서 **유형별 구현은 독립 모듈**, **연결 지점은 소수의 명시적 registry/switch** 방식으로 유지한다.

이 원칙은 확장성과 가독성 사이의 타협이다.
