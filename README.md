# 할 일 (TODO)

진행중 프로젝트 → 지금 바로 할 일 구조의 팀용 투두 앱.
PC에 항상 떠 있는 작은 창, 핸드폰 홈 화면 위젯, 매일 아침 알림, 완료 기록 보관.

| 구성 | 위치 | 설명 |
|---|---|---|
| 웹앱 (PWA) | `web/` | React + Vite + Tailwind. GitHub Pages 배포. 핸드폰은 홈 화면에 추가해 앱처럼 사용 |
| DB / 로그인 | `supabase/schema.sql` | Supabase (PostgreSQL). Google 로그인, 회사 도메인만 허용, RLS 보안 |
| PC 작은 창 | `desktop/` | Electron. 항상 위, 프레임 없음, 트레이, 자동 실행 |
| 아이폰 위젯 | `widgets/ios-scriptable/Todo.js` | Scriptable 앱용 스크립트 |
| 안드로이드 위젯 | `widgets/android/` | Kotlin 위젯 앱. GitHub Actions 가 APK 빌드 |
| 아침 알림 | `scripts/send-daily-push.mjs` | GitHub Actions 가 매시 실행, 사용자별 설정 시각에 Web Push 발송 |
| 주간 백업 | `scripts/backup.mjs` | 매주 월요일 03:00 KST 전체 JSON 덤프 → Supabase Storage + Actions 아티팩트 |

## 데이터 구조

```
프로젝트 (projects)        나만 보기 / 팀 공유, 진행중 / 완료
 └─ 할 일 (tasks)          체크하면 사라지고 completed_at·completed_by 기록
기록 탭                     완료한 할 일을 날짜별·프로젝트별로, 완료한 프로젝트를 따로 표시
```

## 처음 설정

[docs/SETUP.md](docs/SETUP.md) 를 순서대로 따라가면 됩니다. (Supabase 프로젝트 → Google 로그인 → GitHub 변수 → 배포)

## 개발

```bash
cd web && npm install && npm run dev        # 웹앱 http://localhost:5173/todo/
cd desktop && npm install && npm run dev    # 위 개발 서버를 PC 창으로
cd desktop && npm run dist                  # Windows 설치파일 (release/)
```

`web/.env` 에 `.env.example` 내용을 채우면 로컬에서도 Supabase 모드로 동작합니다. 비우면 localStorage 모드.
