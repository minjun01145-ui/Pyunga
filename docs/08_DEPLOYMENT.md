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

## 주의

기존 Firebase Hosting의 `firebase deploy` 흐름과 App Hosting 자동 rollout을 혼용하지 않는다.
이 프로젝트의 웹앱 배포 기준은 App Hosting으로 통일한다.

`firestore.rules` 배포는 웹앱 App Hosting rollout과 별개의 Firebase 설정 작업일 수 있으므로 보안 규칙 변경은 의도적으로 관리한다.
