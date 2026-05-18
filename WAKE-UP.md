# Tom 일어났을 때 — chartalert V2 시연 5분 가이드

밤사이 CTO 완성. 코드 100% 완성, 배포까지 완료.

---

## 1. 현 상태 (밤사이 완료)

| 항목 | 결과 |
|---|---|
| GitHub repo | https://github.com/junsu0505-art/chartalert (public, 수강생 fork 가능) |
| Vercel 배포 | https://chartalert-nine.vercel.app (LIVE, HTTP 200 확인) |
| 로컬 dev server | localhost:3002 (`npm run dev` 실행 시) |
| 마지막 commit | `627e3ae` — README + 수강생 self-deploy 가이드 |

---

## 2. 시연 step-by-step (5분)

### Step A — Telegram bot 발급 (1분)

1. Telegram 앱 → 검색창에 `@BotFather` 입력 → 대화 시작
2. `/newbot` 입력 → 봇 이름 입력 (예: `MyChartAlert`) → username 입력 (예: `mychartbot`)
3. **bot token 복사** — 형식: `7123456789:AABBccDDee...`
4. 방금 만든 봇과 대화 시작 → 아무 메시지 1번 전송 (chat_id 활성화용)
5. 브라우저에서 `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` 접속
6. JSON 응답의 `result[0].message.chat.id` 값 복사 (숫자)

### Step B — Discord webhook 발급 (1분) — 선택

1. 본인 Discord 서버 → 알람 받을 채널 선택
2. 채널 설정(톱니바퀴) → Integrations → Webhooks → New Webhook
3. **Webhook URL 복사** — 형식: `https://discord.com/api/webhooks/...`

### Step C — 환경변수 입력 (1분)

#### 로컬 시연 (가장 빠름)

`C:\chartalert\.env.local` 파일 새로 생성:

```
TELEGRAM_BOT_TOKEN=<Step A의 token>
TELEGRAM_CHAT_ID=<Step A의 chat.id 숫자>
DISCORD_WEBHOOK_URL=<Step B의 URL, 선택>
NEXT_PUBLIC_DEFAULT_SYMBOL=BTCUSDT
NEXT_PUBLIC_DEFAULT_EXCHANGE=binance
```

저장 후 `npm run dev` 재시작.

#### Vercel 배포본 (수강생용)

1. https://vercel.com → chartalert 프로젝트 → Settings → Environment Variables
2. 4개 변수 입력: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DISCORD_WEBHOOK_URL`, `NEXT_PUBLIC_DEFAULT_SYMBOL`
3. Deployments → 최신 → Redeploy

### Step D — 시연 (2분)

1. `npm run dev` 실행 → http://localhost:3002 접속
   (또는 https://chartalert-nine.vercel.app 직접 접속)
2. 좌측 toolbar → **추세선** 버튼 클릭
3. 차트 캔들 영역에서 **클릭 → 드래그 → 클릭** 으로 추세선 그리기
4. 우측 AlertList에 추세선 알람이 자동 추가됨 → cross_above / cross_below 선택
5. 가격이 추세선을 크로스하면 Telegram 메시지 자동 도착
6. (선택) RSI/EMA/MACD → 우측 IndicatorPanel에서 체크박스 활성화 → AlertList에서 알람 추가

---

## 3. 수강생 배포 (Tom 영역)

`docs/STUDENT-DEPLOY.md` 그대로 공유. Path A (GitHub fork + Vercel 1-click Import) 권장.

수강생 배포 흐름:
1. https://github.com/junsu0505-art/chartalert → Fork
2. Vercel dashboard → Add New Project → GitHub Import → chartalert 선택
3. 환경변수 4개 입력 → Deploy

---

## 4. 알려진 한계 (v1.5 백로그)

- 브라우저 탭이 열려 있어야 알람 작동 (백그라운드 service worker = v1.5)
- 알람 5종 각각 개별 설정, 조합 조건 없음 (v1.5)
- 한국 주식 / 미국 주식 미지원 (v1.5 — 크립토 only)

---

## 5. 문제 발생 시

| 증상 | 조치 |
|---|---|
| 알람이 안 옴 | 브라우저 Console → 에러 확인, `.env.local` 값 재확인 |
| 차트가 안 로딩 | Binance WS 연결 확인, CORS 없음 (자체 연결) |
| 빌드 실패 | `npm run build` → 에러 메시지 확인 |
| 테스트 회귀 | `npm run test` (vitest 164 케이스) |
| 설치 가이드 | `docs/INSTALL.md` |

---

## 6. CTO 박제 위치

- HQ 보고서: `C:\master\hq\outputs\plans\chartalert-v2-20260519-ultraplan-local\R-Deploy-report.md`
- HQ HANDOFF: `C:\master\hq\outputs\plans\chartalert-v2-20260519-ultraplan-local\HANDOFF.md`
- GitHub: https://github.com/junsu0505-art/chartalert
- Vercel: https://chartalert-nine.vercel.app
