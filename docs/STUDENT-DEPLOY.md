# 수강생 배포 가이드 — chartalert

예상 소요: 5분.

---

## Path A — GitHub fork + Vercel 1-click (권장)

### 1단계: repo Fork

1. https://github.com/<강사-계정>/chartalert 접속
2. 우측 상단 **Fork** 클릭
3. 본인 계정으로 fork 완료

### 2단계: Vercel 가입

1. https://vercel.com 접속
2. **Sign Up** → **Continue with GitHub** 선택
3. GitHub 계정 권한 허용

### 3단계: 프로젝트 Import

1. Vercel 대시보드 → **Add New Project**
2. 목록에서 fork 한 `chartalert` repo 선택 → **Import**
3. Framework Preset: **Next.js** (자동 감지)

### 4단계: 환경변수 입력

**Environment Variables** 섹션에 아래 4개 입력:

| 변수명 | 값 예시 | 발급 방법 |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `7654321098:AAF...` | Telegram `@BotFather` → `/newbot` |
| `TELEGRAM_CHAT_ID` | `123456789` | 아래 발급 방법 참조 |
| `DISCORD_WEBHOOK_URL` | `https://discord.com/api/webhooks/...` | 아래 발급 방법 참조 |
| `NEXT_PUBLIC_DEFAULT_SYMBOL` | `BTCUSDT` | 원하는 심볼로 변경 가능 |

**TELEGRAM_BOT_TOKEN 발급:**
1. Telegram 앱 → `@BotFather` 검색
2. `/newbot` 입력 → 봇 이름 / username 설정
3. 발급된 token (`숫자:AAF...`) 복사

**TELEGRAM_CHAT_ID 발급:**
1. 방금 만든 봇에게 Telegram에서 아무 메시지 전송
2. 브라우저에서: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. 응답 JSON에서 `result[0].message.chat.id` 값 복사

**DISCORD_WEBHOOK_URL 발급:**
1. Discord 서버 → 알람 받을 채널 → 채널 설정 (톱니바퀴)
2. **Integrations** → **Webhooks** → **New Webhook**
3. Webhook URL 복사

### 5단계: Deploy

1. **Deploy** 버튼 클릭
2. 약 2분 후 빌드 완료
3. 발급된 URL 예: `https://chartalert-<username>.vercel.app`
4. 해당 URL 브라우저에서 열기

### 6단계: 사용

1. 차트에서 심볼 선택 (기본: BTCUSDT)
2. 추세선 도구로 차트 위에 라인 그리기
3. 알람 패널에서 조건 설정 (추세선 cross / RSI 70 cross 등)
4. 조건 충족 시 Telegram / Discord 자동 발송

---

## Path B — Zip 다운로드 + 수동 배포 (대안)

GitHub 계정이 없거나 로컬에서 먼저 확인하고 싶은 경우.

### 1단계: ZIP 다운로드

1. https://github.com/<강사-계정>/chartalert 접속
2. **Code** → **Download ZIP**
3. 압축 해제 후 터미널에서 해당 폴더 진입

```bash
cd chartalert-main
```

### 2단계: 의존성 설치

```bash
npm install --ignore-scripts
```

### 3단계: 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 텍스트 에디터로 열어 아래 값 입력:

```
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_CHAT_ID=YOUR_CHAT_ID
DISCORD_WEBHOOK_URL=YOUR_DISCORD_WEBHOOK_URL
NEXT_PUBLIC_DEFAULT_SYMBOL=BTCUSDT
```

> 주의: `YOUR_BOT_TOKEN` 등 placeholder 를 실제 값으로 교체. 따옴표 제거.

### 4단계: 로컬 실행 또는 Vercel CLI 배포

**로컬 실행:**
```bash
npm run dev
# http://localhost:3000 에서 확인
```

**Vercel CLI 배포:**
```bash
npm install -g vercel
vercel
# 안내에 따라 계정 로그인 + 프로젝트 설정
```

---

## 문제 발생 시

`docs/INSTALL.md` 트러블슈팅 가이드 참조.
