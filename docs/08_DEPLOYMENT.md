# Firebase App Hosting Deployment

## 권장 흐름

```text
Local
 -> git commit
 -> git push
 -> GitHub main
 -> Firebase App Hosting automatic rollout
```

Firebase App Hosting은 Next.js를 기본 지원하며 GitHub 저장소의 지정 live branch push를 자동 배포 트리거로 사용할 수 있다.

## 최초 1회 설정

1. 이 프로젝트를 GitHub 저장소에 push
2. Firebase Console에서 기존 Blaze 프로젝트 선택
3. App Hosting에서 backend 생성
4. GitHub 저장소 연결
5. live branch를 `main`으로 지정
6. automatic rollout 활성화
7. 필요한 공개 Firebase 환경변수 설정
8. 서버 비밀값은 App Hosting secret/Secret Manager에 저장

## Ollama Cloud 설정

이 기능의 API 키는 화면에서 입력하는 값이 아니라 Next.js 서버 환경변수입니다. 브라우저에 노출되는 `NEXT_PUBLIC_` 접두사를 사용하지 않습니다.

로컬 개발에서는 저장소 루트에 Git으로 추적되지 않는 `.env.local`을 만들고 다음 값을 넣습니다.

```dotenv
OLLAMA_BASE_URL=https://ollama.com/api
OLLAMA_MODEL=gpt-oss:120b
OLLAMA_API_KEY=발급받은_API_키
```

배포 환경에서는 Firebase Console의 `App Hosting > 백엔드 선택 > Settings > Environment`에서 아래 세 변수를 설정한 뒤 새 rollout을 실행합니다.

- `OLLAMA_BASE_URL`: `https://ollama.com/api`
- `OLLAMA_MODEL`: 사용할 Ollama Cloud 모델명(예: `gpt-oss:120b`)
- `OLLAMA_API_KEY`: Ollama에서 발급한 API 키. 일반 공개 변수로 저장하지 말고 Secret Manager의 secret으로 연결합니다.

Secret Manager 방식은 Firebase CLI에서도 설정할 수 있습니다.

```bash
firebase apphosting:secrets:set ollamaApiKey
```

그다음 `apphosting.yaml`에서 `OLLAMA_API_KEY`가 `ollamaApiKey` secret을 참조하도록 설정하고, App Hosting 백엔드에 secret 접근 권한을 부여합니다. 비밀값 자체는 `.env.example`, `apphosting.yaml`, GitHub 저장소에 기록하지 않습니다.

환경변수 변경은 현재 실행 중인 버전에 즉시 반영되지 않으므로 반드시 새 rollout을 생성해야 합니다.

## 주의

기존 Firebase Hosting의 `firebase deploy` 흐름과 App Hosting 자동 rollout을 혼용하지 않는다.
이 프로젝트의 웹앱 배포 기준은 App Hosting으로 통일한다.

`firestore.rules` 배포는 웹앱 App Hosting rollout과 별개의 Firebase 설정 작업일 수 있으므로 보안 규칙 변경은 의도적으로 관리한다.

평가계의 현재 학기 승인본 취합은 `firestore.indexes.json`의 복합 인덱스를 사용한다. 처음 배포하거나 인덱스 정의를 바꾼 뒤에는 Firestore index 배포가 완료된 것을 확인하고 업무 흐름을 확인한다.
