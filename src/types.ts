// chartalert V2 — 도메인 타입 정의
// R2a 작성. 이 파일이 R2b/R2c/R3a/R3b/R4/R5 의 공통 계약.

// ──────────────────────────────────────────────
// 1. Base types
// ──────────────────────────────────────────────

export type Direction = 'cross_above' | 'cross_below'
export type Status = 'armed' | 'triggered' | 'paused'
export type Exchange = 'binance' | 'okx'
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export interface TrendlinePoint {
  time: number  // unix seconds
  price: number
}

export interface TickEvent {
  symbol: string
  price: number
  ts: number
  exchange: Exchange  // V2 확장 — Binance vs OKX tick 구분
}

// ──────────────────────────────────────────────
// 2. Alert discriminated union 5종
// ──────────────────────────────────────────────

interface BaseAlert {
  id: string
  symbol: string
  exchange: Exchange
  tfLabel: Timeframe
  direction: Direction
  status: Status
  createdAt: number
  triggeredAt: number | null
}

// 1. 추세선 (v1 이식)
export interface TrendlineAlert extends BaseAlert {
  kind: 'trendline'
  p1: TrendlinePoint
  p2: TrendlinePoint
}

// 2. 가로 가격선
export interface HorizontalAlert extends BaseAlert {
  kind: 'horizontal'
  price: number
}

// 3. RSI 임계 cross
//    direction=cross_above: RSI가 threshold 위로 ↑ (overbought 진입)
//    direction=cross_below: RSI가 threshold 아래로 ↓ (oversold 진입)
export interface RsiAlert extends BaseAlert {
  kind: 'rsi'
  period: number     // default 14
  threshold: number  // e.g. 70 (overbought) or 30 (oversold)
}

// 4. EMA fast/slow cross
//    direction=cross_above: fast EMA 가 slow EMA 위로 ↑ (골든 크로스)
//    direction=cross_below: fast EMA 가 slow EMA 아래로 ↓ (데드 크로스)
export interface EmaAlert extends BaseAlert {
  kind: 'ema'
  fastPeriod: number  // default 12
  slowPeriod: number  // default 26
}

// 5. MACD signal line cross
//    direction=cross_above: MACD line 이 signal line 위로 ↑
//    direction=cross_below: MACD line 이 signal line 아래로 ↓
export interface MacdAlert extends BaseAlert {
  kind: 'macd'
  fastPeriod: number    // default 12
  slowPeriod: number    // default 26
  signalPeriod: number  // default 9
}

// Union — exhaustive discriminated union (kind 필드로 narrow)
export type Alert =
  | TrendlineAlert
  | HorizontalAlert
  | RsiAlert
  | EmaAlert
  | MacdAlert

// ──────────────────────────────────────────────
// 3. Notifier configs
// ──────────────────────────────────────────────

export interface TelegramConfig {
  botToken: string
  chatId: string
}

export interface DiscordConfig {
  webhookUrl: string
}

// ──────────────────────────────────────────────
// 4. Settings
// ──────────────────────────────────────────────

export interface Settings {
  telegram: TelegramConfig | null
  discord: DiscordConfig | null
  alerts: Alert[]
}

export const EMPTY_SETTINGS: Settings = {
  telegram: null,
  discord: null,
  alerts: [],
}

// ──────────────────────────────────────────────
// 5. 평가 결과 type (engine 회차 의존)
// ──────────────────────────────────────────────

export type EvaluateReason =
  | 'cross_above'
  | 'cross_below'
  | 'no_change'
  | 'paused'
  | 'wrong_symbol'
  | 'wrong_kind'         // V2 신규: alert kind 불일치
  | 'insufficient_data'  // V2 신규: 인디케이터 계산용 봉 부족

export interface EvaluateResult {
  triggered: boolean
  reason: EvaluateReason
  linePrice?: number       // trendline / horizontal
  indicatorValue?: number  // rsi / ema / macd
}
