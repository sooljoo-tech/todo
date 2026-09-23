# 처음 설정 가이드

한 번만 하면 되는 작업입니다. 순서대로 진행하세요. 예상 소요 시간 약 20분.

> **비밀번호·시크릿 키는 누구에게도(AI 포함) 알려주지 마세요.** 아래에서 "복사해서 붙여넣기"라고 된 값 중
> `anon key`, `VAPID 공개키`, `프로젝트 URL`은 공개되어도 되는 값이고,
> `service_role key`, `VAPID 개인키`, `Google 클라이언트 시크릿`은 **비공개** 값입니다. 비공개 값은 GitHub Secrets 와 Supabase 화면에만 직접 붙여넣습니다.

---

## 1. Supabase 프로젝트 만들기

1. https://supabase.com 로그인 (회사 Google 계정)
2. **New project**
   - Organization: 기본값 (없으면 새로 생성, 이름은 회사명)
   - Name: `todo`
   - Database Password: 자동 생성된 값 그대로 두고 **비밀번호 관리자에 저장** (직접 쓸 일 거의 없음)
   - Region: **Northeast Asia (Seoul)**
   - Plan: Free
3. 생성 완료까지 1~2분 대기

### 1-1. 스키마 적용
1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 이 저장소의 `supabase/schema.sql` 파일 내용을 전부 붙여넣고 **Run**
3. 아래에 `Success. No rows returned` 가 나오면 성공
4. (허용 도메인을 바꾸려면 파일 맨 위 `allowed_email_domains()` 의 배열을 수정해 다시 Run)

### 1-2. 접속 정보 복사
왼쪽 메뉴 **Project Settings → API**
- **Project URL** (예: `https://abcdefgh.supabase.co`) → 나중에 `VITE_SUPABASE_URL`
- **Project API keys → anon public** → 나중에 `VITE_SUPABASE_ANON_KEY` (공개 가능)
- **Project API keys → service_role** → 나중에 GitHub Secret `SUPABASE_SERVICE_ROLE_KEY` (**비공개!**)

### 1-3. 퇴사·계정 삭제 대비 (권장)
**Organization Settings → Team → Invite** 로 동료 1명 이상을 **Owner** 로 추가.
회사 Google 계정이 삭제되어도 다른 Owner 가 프로젝트를 유지할 수 있습니다.

---

## 2. Google 로그인 연결

### 2-1. Google Cloud 에서 OAuth 클라이언트 만들기
1. https://console.cloud.google.com → 회사 계정으로 로그인
2. 상단 프로젝트 선택 → **새 프로젝트** → 이름 `todo-login` → 만들기
3. 왼쪽 메뉴 **API 및 서비스 → OAuth 동의 화면**
   - User Type: **내부** (회사 Workspace 사용자만 로그인 가능) → 만들기
   - 앱 이름 `할 일`, 사용자 지원 이메일·개발자 연락처: 본인 이메일 → 저장
4. **API 및 서비스 → 사용자 인증 정보 → + 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 유형: **웹 애플리케이션**, 이름 `todo-web`
   - **승인된 자바스크립트 원본**: `https://<GitHub계정>.github.io`
   - **승인된 리디렉션 URI**: `https://<Supabase프로젝트ID>.supabase.co/auth/v1/callback`
     (Supabase 대시보드 **Authentication → Providers → Google** 화면에 표시되는 Callback URL 을 그대로 복사)
   - 만들기 → **클라이언트 ID** 와 **클라이언트 보안 비밀** 표시됨 (창을 닫지 말고 다음 단계로)

### 2-2. Supabase 에 등록
1. Supabase **Authentication → Providers → Google** → Enable
2. Client ID, Client Secret 붙여넣기 → Save
3. **Authentication → URL Configuration**
   - Site URL: `https://<GitHub계정>.github.io/todo/`
   - Redirect URLs 에 추가: `https://<GitHub계정>.github.io/todo/**` 와 `http://localhost:5173/**`

---

## 3. GitHub 저장소 변수·시크릿 등록

저장소 → **Settings → Secrets and variables → Actions**

**Variables 탭** (공개 가능한 값)

| 이름 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | 1-2 의 Project URL |
| `VITE_SUPABASE_ANON_KEY` | 1-2 의 anon public key |
| `VITE_VAPID_PUBLIC_KEY` | (이미 등록됨 — 알림용 공개키) |
| `VITE_ALLOWED_DOMAINS` | `joomidang.com` (여러 개면 쉼표 구분) |

**Secrets 탭** (비공개 값)

| 이름 | 값 |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | 1-2 의 service_role key |
| `VAPID_PRIVATE_KEY` | (이미 등록됨 — 알림용 개인키) |

등록 후 **Actions 탭 → "웹앱 배포" → Run workflow** 로 재배포하면 로그인 모드로 전환됩니다.

---

## 4. 각 기기 설치

### PC (Windows)
- 저장소 **Releases** 에서 `할 일 Setup x.y.z.exe` 다운로드 → 실행. (또는 `할일-portable.exe` 는 설치 없이 실행)
- 첫 실행 시 오른쪽 아래에 작은 창이 뜨고, 설정 탭에서 **항상 위 / 자동 실행 / 투명도** 조절.
- × 를 누르면 트레이로 숨김. 트레이 아이콘 클릭으로 다시 표시. 완전 종료는 트레이 우클릭 → 종료.

### 핸드폰 (아이폰·안드로이드 공통)
1. 브라우저에서 `https://<GitHub계정>.github.io/todo/` 열기
2. **아이폰**: Safari 공유 버튼 → **홈 화면에 추가**. **안드로이드**: Chrome 메뉴 → **홈 화면에 추가 / 앱 설치**
3. 홈 화면 아이콘으로 열어 Google 로그인
4. **설정 탭 → 아침 알림** 켜기, 시각 선택 (기기마다 따로)

### 아이폰 홈 화면 위젯
1. App Store 에서 **Scriptable** (무료) 설치
2. 웹앱 설정 탭 → **위젯 설정값 복사**
3. Scriptable → + → `widgets/ios-scriptable/Todo.js` 내용 붙여넣기 → 이름 `Todo` → 실행(▶) → 설정값 붙여넣기
4. 홈 화면 길게 누르기 → + → Scriptable → 중간 크기 → 추가 → 위젯 길게 눌러 편집 → Script: `Todo`
- 할 일 줄을 탭하면 완료 처리. 제목 탭하면 앱 열림.

### 안드로이드 홈 화면 위젯
1. 저장소 **Releases** 에서 `todo-widget.apk` 다운로드 → 설치 (출처를 알 수 없는 앱 허용 필요)
2. 앱 열기 → 웹앱 설정 탭에서 복사한 **위젯 설정값** 붙여넣기 → 저장
3. 홈 화면 길게 누르기 → 위젯 → **할 일** 추가
- 할 일 줄을 탭하면 완료 처리. ↻ 탭하면 새로 고침. 30분마다 자동 갱신.

---

## 5. 팀원 초대

별도 초대 절차 없음. 회사 Google 계정(`@joomidang.com`)이면 웹앱 주소를 열어 로그인만 하면 됩니다.
- 각자 **개인 프로젝트**를 만들어 쓰고, 함께 볼 프로젝트는 만들 때 **팀 공유**를 체크하거나 ⋯ 메뉴 → **팀에 공유**.
- 공유 프로젝트는 누가 어떤 할 일을 완료했는지 기록 탭에 이름이 표시됩니다.

---

## 운영 참고

- **무료 플랜 일시중지**: 7일간 요청이 없으면 Supabase 가 프로젝트를 멈춥니다. 아침 알림 워크플로가 매시 DB를 읽으므로 자연히 방지됩니다. 멈췄다면 대시보드에서 **Restore** 한 번.
- **백업**: 매주 월요일 새벽 `backups` 버킷과 Actions 아티팩트에 JSON 저장. 개인 백업은 설정 탭 → JSON 내보내기.
- **앱 새 버전 배포**: `git tag v0.2.0 && git push --tags` → Actions 가 Windows 설치파일 + APK 를 Release 에 첨부.
- **허용 도메인 변경**: `supabase/schema.sql` 의 `allowed_email_domains()` 수정 후 SQL Editor 에서 Run + GitHub 변수 `VITE_ALLOWED_DOMAINS` 수정.
