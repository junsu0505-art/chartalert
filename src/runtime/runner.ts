/**
 * runner.ts — 가격 tick → 5종 cross 판정 → 알림 발송 오케스트레이터 (V2)
 *
 * v1 (alertapp/src/runtime/runner.ts, 181 LoC) 패턴 V2 이식.
 * V2 변경:
 *  - BinanceWsClient + OkxWsClient 둘 다 지원 (alert.exchange 별 분기)
 *  - Candle 캐시: getCandles 주입으로 인디케이터 alert 지원
 *  - Notifier 2종: telegram + discord, 둘 다 설정 시 둘 다 발송
 *  - evaluateAlert → evaluator.ts dispatcher (5종)
 *
 * UP-14: 5종 evaluator dispatch — evaluateAlert() 경유.
 * UP-15 race:
 *  - triggered 후 _handleTrigger: updateAlert → unsubscribe 순서 보장 (updateAlert await 후 unsubscribe).
 *  - JS single-thread. subscribe/unsubscribe 동시 호출 없음.
 *  - triggered 후 추가 tick 도달 시 alert.status !== 'armed' → evaluateAlert no-op.
 * UP-16 secret: config 는 인자/storage 경유만. console.log 최소화 (info only, no secrets).
 * resource: stop() 시 binanceWs.close() + okxWs.close() + Map clear.
 */

import type { Alert, TickEvent } from '../types'
import type { BinanceWsClient } from '../data/binance-ws'
import type { TickHandler as BinanceTickHandler } from '../data/binance-ws'
import type { OkxWsClient } from '../data/okx-ws'
import type { TickHandler as OkxTickHandler } from '../data/okx-ws'
import type { Candle } from '../data/types'
import { evaluateAlert } from './evaluator'
import { sendTelegramMessage } from '../notify/telegram'
import { sendDiscordMessage } from '../notify/discord'
import { updateAlert, getTelegramConfig, getDiscordConfig } from '../storage/local'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AlertRunnerOpts {
  binanceWs: BinanceWsClient
  okxWs: OkxWsClient
  /** page 레벨 useKlines result 주입 — alert 별 candle 배열 반환 */
  getCandles: (alert: Alert) => Candle[]
  /** triggered 후 호출 (AlertList 갱신 목적) */
  onTrigger?: (alert: Alert, tick: TickEvent) => void
}

// ---------------------------------------------------------------------------
// AlertRunner
// ---------------------------------------------------------------------------

export class AlertRunner {
  private readonly _binanceWs: BinanceWsClient
  private readonly _okxWs: OkxWsClient
  private readonly _getCandles: (alert: Alert) => Candle[]
  private readonly _onTrigger?: (alert: Alert, tick: TickEvent) => void

  /** symbol(upper) → 마지막 TickEvent (exchange 불문 심볼 기준) */
  private readonly _prevTick = new Map<string, TickEvent>()
  /** alert.id → { handler, exchange } (unsubscribe 시 동일 참조 필요) */
  private readonly _handlers = new Map<string, { handler: BinanceTickHandler | OkxTickHandler; exchange: Alert['exchange'] }>()
  /** symbol(upper) → tick count (throttle 용) */
  private readonly _tickCount = new Map<string, number>()

  constructor(opts: AlertRunnerOpts) {
    this._binanceWs = opts.binanceWs
    this._okxWs = opts.okxWs
    this._getCandles = opts.getCandles
    this._onTrigger = opts.onTrigger
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * armed alert 배열을 받아 전부 subscribe.
   * 중복 subscribe 방지: 이미 _handlers 에 있는 id 는 건너뜀.
   */
  start(alerts: Alert[]): void {
    for (const alert of alerts) {
      if (alert.status === 'armed') {
        this.subscribe(alert)
      }
    }
  }

  /**
   * alert 를 exchange 별 ws 에 subscribe. 이미 등록된 id 이면 noop.
   */
  subscribe(alert: Alert): void {
    if (this._handlers.has(alert.id)) return

    const handler = (tick: TickEvent) => {
      this._onTick(alert, tick)
    }

    this._handlers.set(alert.id, { handler, exchange: alert.exchange })

    if (alert.exchange === 'binance') {
      this._binanceWs.subscribe(alert.symbol, handler as BinanceTickHandler)
    } else {
      // OKX: symbol BTCUSDT → instId BTC-USDT
      const instId = symbolToOkxInstId(alert.symbol)
      this._okxWs.subscribe(instId, handler as OkxTickHandler)
    }
  }

  /**
   * alert 를 ws 에서 unsubscribe. handler 참조 제거.
   */
  unsubscribe(alert: Alert): void {
    const entry = this._handlers.get(alert.id)
    if (!entry) return

    this._handlers.delete(alert.id)

    if (entry.exchange === 'binance') {
      this._binanceWs.unsubscribe(alert.symbol, entry.handler as BinanceTickHandler)
    } else {
      const instId = symbolToOkxInstId(alert.symbol)
      this._okxWs.unsubscribe(instId, entry.handler as OkxTickHandler)
    }
  }

  /**
   * 모든 subscription 해제 + ws.close() + 내부 상태 초기화.
   */
  stop(): void {
    // 개별 unsubscribe 대신 ws.close() 가 일괄 처리
    this._handlers.clear()
    this._prevTick.clear()
    this._tickCount.clear()
    this._binanceWs.close()
    this._okxWs.close()
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private _onTick(alert: Alert, currTick: TickEvent): void {
    // throttle 집계
    const cnt = (this._tickCount.get(currTick.symbol) ?? 0) + 1
    this._tickCount.set(currTick.symbol, cnt)

    const prevTick = this._prevTick.get(currTick.symbol) ?? null

    // candle 주입 (인디케이터 alert 용)
    const candles = this._getCandles(alert)

    const result = evaluateAlert(alert, prevTick, currTick, candles)

    // prevTick 업데이트 (판정 결과와 무관)
    this._prevTick.set(currTick.symbol, currTick)

    if (!result.triggered) return

    // triggered 처리 (fire-and-forget)
    this._handleTrigger(alert, currTick).catch(() => {
      // network error 무시 — 재시도 v1.5+
    })
  }

  private async _handleTrigger(alert: Alert, tick: TickEvent): Promise<void> {
    const now = Date.now()

    // UP-15: updateAlert 완료 후 unsubscribe (순서 보장)
    // 1. status 업데이트 (storage) — 추가 tick 이 도달해도 armed X
    updateAlert(alert.id, { status: 'triggered', triggeredAt: now })

    // 2. unsubscribe (이미 발화 → 더 이상 구독 불필요)
    this.unsubscribe(alert)

    // 3. 알림 메시지 빌드
    const dirLabel = alert.direction === 'cross_above' ? '위로 돌파' : '아래로 이탈'
    const priceStr = tick.price.toLocaleString()
    const timeStr = new Date(now).toLocaleString('ko-KR')
    const kindLabel = alert.kind
    const msg =
      `[chartalert] ${alert.symbol} ${kindLabel} 알람 발화\n` +
      `방향: ${dirLabel}\n` +
      `발화 가격: ${priceStr}\n` +
      `거래소: ${alert.exchange}\n` +
      `시각: ${timeStr}`

    // 4. Telegram 발송 (config 있을 때만)
    const tgCfg = getTelegramConfig()
    if (tgCfg) {
      await sendTelegramMessage(tgCfg, msg)
    }

    // 5. Discord 발송 (config 있을 때만) — Telegram 과 독립적으로 둘 다 발송
    const dcCfg = getDiscordConfig()
    if (dcCfg) {
      await sendDiscordMessage(dcCfg, msg, { username: 'chartalert' })
    }

    // 6. onTrigger 콜백 (AlertList 갱신 목적)
    const updatedAlert: Alert = { ...alert, status: 'triggered', triggeredAt: now }
    this._onTrigger?.(updatedAlert, tick)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Binance symbol (BTCUSDT) → OKX instId (BTC-USDT)
 * USDT suffix 기준으로 삽입. e.g. BTCUSDT → BTC-USDT
 */
function symbolToOkxInstId(symbol: string): string {
  const upper = symbol.toUpperCase()
  // OKX 표준: USDT pair 는 "-USDT" suffix
  if (upper.endsWith('USDT')) {
    return upper.slice(0, -4) + '-USDT'
  }
  // BTC pair
  if (upper.endsWith('BTC')) {
    return upper.slice(0, -3) + '-BTC'
  }
  // ETH pair
  if (upper.endsWith('ETH')) {
    return upper.slice(0, -3) + '-ETH'
  }
  // fallback: 그대로 반환 (OKX 가 처리)
  return upper
}
