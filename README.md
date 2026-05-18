# chartalert — TV 독립 라이브 차트 알람

크립토 (Binance + OKX) 라이브 차트 + 추세선/RSI/EMA/MACD 알람 + Telegram/Discord 발송.
**무료. Mac/Windows/Linux. 자체 Vercel 호스팅. TV 종속성 0.**

> "내가 그린 추세선 / RSI 70 cross 같은 거 텔레그램으로 알려줘" — 비용 $0

## 데모

(스크린샷 placeholder — assets/screenshots/)

## 빠른 시작 (수강생 5분)

1. GitHub 가입 → 본 repo Fork
2. Vercel 가입 (https://vercel.com) → Fork 한 repo Import
3. 환경변수 4개 입력 (Telegram bot + Discord webhook) — `docs/STUDENT-DEPLOY.md` 참조
4. Deploy 클릭 → 본인 `*.vercel.app` URL 발급
5. 차트 → 추세선 그리기 → 알람 자동 발화

## 기능

- 자산: Binance Spot + OKX (크립토)
- 알람 5종: 추세선 cross / 수평선 cross / RSI 임계 cross / EMA fast-slow cross / MACD signal cross
- 채널: Telegram + Discord webhook
- 멀티 심볼 / 멀티 타임프레임 (1m ~ 1d)
- localStorage 영속 (서버 X)

## 제약 (v1)

| 제약 | 설명 |
|---|---|
| 브라우저 탭 열려 있어야 함 | 트레이딩 중이면 자연 OK. 백그라운드 서비스 X |
| Binance + OKX 만 | 주식 / FX / 한국주식 X |
| Vercel 무료 tier | 100 GB bandwidth / 월. 수강생 본인 한도 |

## 자체 개발

```bash
git clone https://github.com/<user>/chartalert.git
cd chartalert
npm install
npm run test         # vitest 164+
npm run typecheck    # 0 error
npm run build        # next build
npm run dev          # http://localhost:3000
```

## 안전 / 프라이버시

- Telegram bot token / Discord webhook = **본인 Vercel 환경변수 only**. 코드 X / 서버 X / 외부 전송 X
- Binance WS: 본인 브라우저 → Binance 직접 통신
- localStorage: 알람 정보만 (본인 브라우저)

## 트러블슈팅

`docs/INSTALL.md` 참조.

## License

MIT — `LICENSE` 참조. 외부 OSS attribution — `NOTICE` 참조.
