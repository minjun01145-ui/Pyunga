# 학사일정 AI 가져오기 — 전체 일정 추출 버전

이 버전에서는 학사일정 문서에 공식적으로 기재된 일정을 중요도와 관계없이 모두 추출합니다.
학급회, 동아리, 예방교육, 영어듣기평가, 검사, 선거, 학부모 행사, 체험학습, 진로활동, 문화예술·체육행사, 봉사활동, 공휴일/휴업일 등도 포함합니다.

## 아직 기존 AI 패치를 적용하지 않은 경우

저장소 루트에서 `pyunga-academic-calendar-ai-all-events.patch`를 적용합니다.

```bash
git apply --check pyunga-academic-calendar-ai-all-events.patch
git apply pyunga-academic-calendar-ai-all-events.patch
npm install
npm run typecheck
npm run lint
npm run test:run
npm run build
```

## 이전 `pyunga-academic-calendar-ai.patch`를 이미 적용한 경우

`pyunga-academic-calendar-ai-all-events-correction.patch`만 적용합니다.

```bash
git apply --check pyunga-academic-calendar-ai-all-events-correction.patch
git apply pyunga-academic-calendar-ai-all-events-correction.patch
npm run typecheck
npm run lint
npm run test:run
npm run build
```
