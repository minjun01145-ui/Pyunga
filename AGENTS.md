# Local development instructions

작업 전 `CONTRIBUTING.md`, 관련 설계 문서, 기존 코드와 테스트를 먼저 읽는다.

특히 평가계/교사입력/출력 관련 작업은 아래 문서를 우선 확인한다.

- `docs/13_EVALUATION_TEMPLATE_DESIGN.md`
- `docs/14_PERFORMANCE_ASSESSMENT_DESIGN.md`
- `docs/15_DOCUMENT_RENDERING.md`
- `docs/16_REPOSITORY_STABILIZATION.md`

코드를 바로 수정하지 말고 다음을 먼저 확인한다.

1. 요청한 기능의 실제 업무 목적
2. 영향을 받는 모듈과 기존 구현
3. Domain/Data model 변경 필요 여부
4. Template Schema 영향 여부
5. 권한·보안 영향
6. 테스트할 항목

반드시 `CONTRIBUTING.md`의 규칙을 따른다.

추가 규칙:

- 동작만 맞추기 위한 하드코딩을 하지 않는다.
- 현재 요구사항에 없는 추상화나 범용 프레임워크를 만들지 않는다.
- 새 타입/인터페이스/서비스/어댑터/계층을 만들 때 현재 작업에서 실제 consumer가 있어야 한다.
- 향후 사용만을 위한 placeholder 구현을 만들지 않는다.
- 동일한 업무 개념의 생성/검증/계산 로직이 이미 있으면 새 구현을 만들지 말고 기존 책임을 재사용한다.
- 학교명/교과명에 따른 source code `if/else`로 양식을 분기하지 않는다.
- Template은 제한된 Schema로 표현하며 AI가 생성한 임의 React/JS를 실행하지 않는다.
- AI 결과는 초안/제안으로 취급하며 Domain 사실을 무검토 확정하지 않는다.
- 최종 PDF 생성 과정에 LLM을 넣지 않는다.
- 사람이 일반적으로 작성하지 않을 정도로 장황한 주석을 추가하지 않는다.
- 코드 주석, 변수명, 커밋 메시지에 생성 과정이나 도구 사용 흔적을 남기지 않는다.
- 내부 구현 계획을 사용자 화면에 표시하지 않는다.
- 기존 구조가 이상해 보여도 요청 범위 밖의 대규모 리팩터링을 임의로 하지 않는다.
- 새 파일을 만들기 전에 기존 위치에 책임이 있는지 확인한다.
- 새 패키지를 설치하기 전에 현재 의존성으로 해결 가능한지 확인한다.
- 작업 완료 시 typecheck, lint, test, build 결과를 확인한다.
