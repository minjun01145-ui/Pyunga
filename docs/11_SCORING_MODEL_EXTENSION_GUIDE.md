# ScoringModel 확장 가이드

새로운 수행평가 세부기준 유형이 발견되었을 때 교과나 학교별 예외문을 추가하지 않는다.

## 변경 순서

새 유형 `range_band`가 필요하다고 가정한다.

1. `domain/scoring-model.ts`
   - 새 모델 타입 정의
   - `ScoringModel` union에 추가

2. `domain/scoring-model-registry.ts`
   - 사용자에게 표시할 이름 등록
   - 문자열 입력 검증 대상에 새 타입 추가

3. `domain/scoring-model-validation.ts`
   - 순수 검증 규칙 추가
   - 관련 테스트 추가

4. `ui/create-initial-scoring-model.ts`
   - 편집기를 열 때 사용할 최소 초기값 추가
   - 업무상 근거 없는 임의 점수 구간은 만들지 않음

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

## 명시적인 연결을 유지하는 이유

현재 `ScoringModel`은 TypeScript discriminated union이다. 모델 종류와 편집기, 검증 로직을 명시적으로 연결하면 누락을 찾기 쉽고 코드 탐색도 단순하다.

현재 규모에서는 런타임 플러그인 로더처럼 완전히 동적인 구조를 도입하지 않는다. 실제 확장 요구가 생길 때 필요한 타입과 구현만 추가한다.
