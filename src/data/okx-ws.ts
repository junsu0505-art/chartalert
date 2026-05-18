/**
 * okx-ws.ts — OKX public WebSocket client (tickers channel)
 *
 * endpoint: wss://ws.okx.com:8443/ws/v5/public
 * tick stream: args: [{ channel: "tickers", instId: "BTC-USDT" }]
 *
 * Binance 패턴 따라 구현 (UP-14: simple fork 우선).
 *
 * UP-15 race: _reconnectTimer null check + close() 시 onclose=null 의무.
 * UP-16 secret: URL 만 포함, API key/token 없음. 0 secret.
 * resource: close() 시 timer clear + ws.close().
 * null: ws.send 전 readyState === OPEN 검증. ws null check 포함.
 * license: 외부 lib 0. NOTICE 의무 없음.
 */

import type { TickEvent } from '../types.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TickHandler = (tick: TickEvent) => void

export interface OkxWsClientOptions {
  /** WebSocket endpoint (테스트 주입 용). default: wss://ws.okx.com:8443/ws/v5/public */
  url?: string
  /** reconnect backoff 최대 (ms). default: 30_000 */
  maxBackoffMs?: number
}

// ---------------------------------------------------------------------------
// Internal OKX message shapes
// ---------------------------------------------------------------------------

interface OkxTickerData {
  /** instId e.g. "BTC-USDT" */
  instId: string
  /** last price as string */
  last: string
  /** timestamp as string (ms) */
  ts: string
  [key: string]: unknown
}

interface OkxPushMessage {
  arg: { channel: string; instId: string }
  data: OkxTickerData[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_URL = 'wss://ws.okx.com:8443/ws/v5/public'
const BASE_BACKOFF_MS = 1_000
const DEFAULT_MAX_BACKOFF_MS = 30_000

// ---------------------------------------------------------------------------
// OkxWsClient implementation
// ---------------------------------------------------------------------------

export class OkxWsClient {
  private readonly _url: string
  private readonly _maxBackoffMs: number

  private _ws: WebSocket | null = null
  /** instId (upper, canonical e.g. "BTC-USDT") → Set<TickHandler> */
  private readonly _subscriptions = new Map<string, Set<TickHandler>>()
  private _reconnectAttempts = 0
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _closed = false

  constructor(opts: OkxWsClientOptions = {}) {
    this._url = opts.url ?? DEFAULT_URL
    this._maxBackoffMs = opts.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  get isConnected(): boolean {
    return this._ws?.readyState === WebSocket.OPEN
  }

  /**
   * instId (e.g. "BTC-USDT", 대소문자 무관) 에 대한 ticker tick 을 subscribe.
   * 최초 instId 이면 connection 후 subscribe op 전송.
   */
  subscribe(instId: string, handler: TickHandler): void {
    const key = instId.toUpperCase()

    if (!this._subscriptions.has(key)) {
      this._subscriptions.set(key, new Set())
    }
    this._subscriptions.get(key)!.add(handler)

    if (this._ws === null) {
      // 첫 subscribe → 연결 시작
      this._connect()
    } else if (this._ws.readyState === WebSocket.OPEN) {
      // 이미 연결됨 → 신규 instId subscribe 메시지
      this._sendSubscribe([key])
    }
    // CONNECTING 상태이면 onopen 핸들러에서 일괄 구독
  }

  /**
   * handler 를 제거. handler 생략 시 instId 의 모든 handler 제거.
   * 마지막 handler 제거 시 unsubscribe op 전송.
   */
  unsubscribe(instId: string, handler?: TickHandler): void {
    const key = instId.toUpperCase()
    const handlers = this._subscriptions.get(key)
    if (!handlers) return

    if (handler !== undefined) {
      handlers.delete(handler)
    } else {
      handlers.clear()
    }

    if (handlers.size === 0) {
      this._subscriptions.delete(key)
      this._sendUnsubscribe([key])
    }
  }

  /**
   * 모든 reconnect timer clear 후 ws.close().
   * 이후 reconnect 발동하지 않음.
   */
  close(): void {
    this._closed = true
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    if (this._ws !== null) {
      this._ws.onclose = null // reconnect 콜백 제거 (UP-15)
      this._ws.onerror = null
      this._ws.close()
      this._ws = null
    }
  }

  // -------------------------------------------------------------------------
  // Internal: connection lifecycle
  // -------------------------------------------------------------------------

  private _connect(): void {
    if (this._closed) return

    const ws = new WebSocket(this._url)
    this._ws = ws

    ws.onopen = () => {
      this._reconnectAttempts = 0
      const instIds = Array.from(this._subscriptions.keys())
      if (instIds.length > 0) {
        this._sendSubscribe(instIds)
      }
    }

    ws.onmessage = (ev: MessageEvent) => {
      this._handleMessage(ev.data as string)
    }

    ws.onerror = () => {
      // onerror 는 onclose 와 함께 발동됨. onclose 에서 재연결 처리.
    }

    ws.onclose = () => {
      if (this._closed) return
      this._ws = null
      this._scheduleReconnect()
    }
  }

  private _scheduleReconnect(): void {
    if (this._closed) return

    const backoffMs = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, this._reconnectAttempts),
      this._maxBackoffMs,
    )
    this._reconnectAttempts++

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      if (!this._closed) {
        this._connect()
      }
    }, backoffMs)
  }

  // -------------------------------------------------------------------------
  // Internal: message handling
  // -------------------------------------------------------------------------

  private _handleMessage(raw: string): void {
    let msg: unknown
    try {
      msg = JSON.parse(raw)
    } catch {
      // 잘못된 JSON → 무시
      return
    }

    if (!isPushMessage(msg)) return

    // data 배열의 각 entry 처리
    for (const entry of msg.data) {
      const key = entry.instId.toUpperCase()
      const handlers = this._subscriptions.get(key)
      if (!handlers || handlers.size === 0) continue

      const priceNum = parseFloat(entry.last)
      if (!isFinite(priceNum)) continue

      const tsMs = parseInt(entry.ts, 10)
      const tsSeconds = isFinite(tsMs) ? Math.floor(tsMs / 1000) : Math.floor(Date.now() / 1000)

      // OKX instId "BTC-USDT" → symbol "BTCUSDT" (대시 제거)
      const symbol = key.replace(/-/g, '')

      const tick: TickEvent = {
        exchange: 'okx',
        symbol,
        price: priceNum,
        ts: tsSeconds,
      }

      for (const handler of handlers) {
        handler(tick)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Internal: send helpers
  // -------------------------------------------------------------------------

  /**
   * OKX subscribe op 전송.
   * { op: "subscribe", args: [{ channel: "tickers", instId }] }
   */
  private _sendSubscribe(instIds: string[]): void {
    this._sendJson({
      op: 'subscribe',
      args: instIds.map((instId) => ({ channel: 'tickers', instId })),
    })
  }

  /**
   * OKX unsubscribe op 전송.
   * { op: "unsubscribe", args: [{ channel: "tickers", instId }] }
   */
  private _sendUnsubscribe(instIds: string[]): void {
    this._sendJson({
      op: 'unsubscribe',
      args: instIds.map((instId) => ({ channel: 'tickers', instId })),
    })
  }

  private _sendJson(payload: unknown): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(payload))
    }
  }
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isPushMessage(v: unknown): v is OkxPushMessage {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  // OKX push: { arg, data }. event 메시지 (subscribe 확인 등) 는 arg 없거나 data 없음
  if (typeof o['arg'] !== 'object' || o['arg'] === null) return false
  if (!Array.isArray(o['data']) || o['data'].length === 0) return false
  const arg = o['arg'] as Record<string, unknown>
  if (arg['channel'] !== 'tickers') return false
  const first = o['data'][0] as Record<string, unknown>
  if (typeof first['instId'] !== 'string') return false
  if (typeof first['last'] !== 'string') return false
  return true
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOkxWsClient(opts?: OkxWsClientOptions): OkxWsClient {
  return new OkxWsClient(opts)
}
