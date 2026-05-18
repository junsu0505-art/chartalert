# 설치 및 트러블슈팅 가이드 — chartalert

---

## 1. Vercel 빌드 실패

### 증상: `npm install` 단계에서 `ELIFECYCLE` / `postinstall` 오류

`lightweight-charts-line-tools` 패키지의 postinstall 스크립트가 Vercel 환경에서 실패할 수 있다.

**해결:** `vercel.json` 의 `installCommand` 에 `--ignore-scripts` 플래그가 포함돼 있는지 확인:

```json
{
  "installCommand": "npm install --ignore-scripts"
}
```

포함돼 있지 않으면 Vercel 프로젝트 설정 → **Build & Development Settings** → **Install Command** 를 직접 입력:

```
npm install --ignore-scripts
```

### 증상: Node.js 버전 불일치 오류

Vercel 대시보드 → 프로젝트 Settings → **General** → **Node.js Version** → `20.x` 선택.

### 증상: TypeScript 타입 오류로 빌드 실패

```bash
npm run typecheck
```

로컬에서 실행 후 오류 메시지 확인. 오류가 없어야 배포 성공.

---

## 2. Telegram 알람 발송 안 됨

### 증상: 알람 조건은 충족됐는데 Telegram 메시지 미수신

**체크리스트:**

1. **TELEGRAM_BOT_TOKEN 형식 확인**
   - 올바른 형식: `7654321098:AAFxxxxxxxx`
   - 숫자 + 콜론 + 영문/숫자 조합

2. **TELEGRAM_CHAT_ID 확인**
   - `https://api.telegram.org/bot<TOKEN>/getUpdates` 로 실제 chat.id 재확인
   - 그룹 채팅의 경우 음수 (`-1001234567890`)

3. **봇에 먼저 메시지 전송했는지 확인**
   - getUpdates 에 결과가 없으면 봇에게 Telegram 앱에서 `/start` 또는 아무 메시지 전송 후 재시도

4. **봇이 차단됐는지 확인**
   - Telegram → 봇 프로필 → 차단 해제

5. **방화벽 / 국가 제한**
   - 일부 네트워크에서 Telegram API 차단. VPN 사용 또는 다른 네트워크 시도

---

## 3. Discord webhook 4xx 오류

### 증상: Discord 알람 미수신, 브라우저 콘솔에 `4xx` 오류

**체크리스트:**

1. **Webhook URL 형식 확인**
   - 올바른 형식: `https://discord.com/api/webhooks/숫자/영문숫자`
   - `https://discordapp.com/...` 구 형식은 리다이렉트 되지만 환경변수에는 최신 형식 권장

2. **Rate limit (429)**
   - Discord webhook 은 초당 5회 제한. 알람이 동시에 대량 발화되면 일부 누락 가능
   - 알람 조건을 분산 설정 권장

3. **Webhook 삭제됐는지 확인**
   - Discord 채널 설정 → Integrations → Webhooks 에서 해당 webhook 존재 확인
   - 삭제됐으면 재생성 후 Vercel 환경변수 업데이트 → Redeploy

---

## 4. WebSocket 끊김

### 증상: 차트가 실시간으로 갱신되지 않거나 가격이 멈춤

**체크리스트:**

1. **네트워크 연결 확인**
   - 인터넷 연결 상태 점검

2. **Binance / OKX IP rate limit**
   - 동일 IP 에서 너무 많은 WebSocket 연결 시 일시 차단
   - 다른 심볼로 변경하거나 10~30초 대기 후 페이지 새로고침

3. **브라우저 절전 모드**
   - Chrome 탭이 백그라운드로 내려가면 JS 실행이 느려질 수 있음
   - 해당 탭을 포커스 상태로 유지하거나 절전 비활성화

4. **페이지 새로고침**
   - F5 또는 Ctrl+R 로 강제 재연결

---

## 5. localStorage 한계 (알람 100+ 개)

### 증상: 새 알람이 저장되지 않거나 기존 알람이 사라짐

브라우저 localStorage 는 도메인당 약 5MB 제한. 알람 설정이 누적되면 한도 초과 가능.

**해결:**
- 알람 패널에서 불필요한 알람 삭제
- 브라우저 개발자 도구 → Application → Local Storage → chartalert 항목 수동 정리

향후 v1.5 에서 자동 정리 로직 추가 예정.

---

## 6. 로컬 개발 환경 설정

```bash
git clone https://github.com/<user>/chartalert.git
cd chartalert
npm install --ignore-scripts
cp .env.local.example .env.local
# .env.local 에 환경변수 4개 입력
npm run dev
```

브라우저에서 http://localhost:3000 접속.

**개발 전 검증:**
```bash
npm run typecheck   # TypeScript 오류 0 개 확인
npm run test        # vitest 164+ 통과 확인
npm run build       # 프로덕션 빌드 성공 확인
```

---

문제가 해결되지 않으면 GitHub Issues 에 등록해 주세요.
