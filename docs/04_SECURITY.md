# Security Principles

## 시제품이라고 보안을 생략하지 않는다

평가계획 자체는 공개 가능한 자료가 많지만 사용자 계정, 교사 식별정보, 권한정보는 별도 보호 대상이다.

## 개인정보 최소화

- 표시명: `김OO (영어)` 기본
- 실명이 업무에 불필요하면 저장하지 않는다.
- 내부 식별자는 표시명과 분리한다.
- 공개용 출력은 담당 교사명 제외를 기본 옵션으로 둘 수 있다.

## 역할

- SCHOOL_ADMIN
- EVALUATION_ADMIN
- TEACHER

Custom Claims에는 권한 판정에 필요한 최소정보만 둔다.
프로필 표시용 데이터는 claims에 넣지 않는다.

## 관리자 작업

계정 생성, 역할 변경 등 권한 높은 작업은 브라우저 Firebase SDK가 직접 수행하지 않는다.

```text
관리자 브라우저
 -> 서버 endpoint/use case
 -> 현재 사용자 토큰 검증
 -> 역할 재검증
 -> Firebase Admin SDK
```

## Firestore

초기 rules는 deny-by-default다.
서버 Admin SDK는 Firestore Security Rules를 우회하므로 서버의 application layer에서 권한검사를 반드시 수행한다.

## Secret

- AI API Key는 `NEXT_PUBLIC_` 금지
- 서비스 비밀키를 GitHub에 commit 금지
- Firebase App Hosting/Google Secret Manager 사용

## 로그

향후 관리자 작업에는 audit log를 고려한다.

예:
- 누가 계정을 생성했는지
- 누가 역할을 변경했는지
- 누가 평가계획을 승인/반려했는지

MVP 초기부터 모든 로그를 구현할 필요는 없지만 Application 인터페이스가 추후 추가를 막지 않도록 한다.
