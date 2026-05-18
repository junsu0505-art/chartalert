/**
 * data.test.ts — BinanceWsClient + OkxWsClient + klines 단위 테스트
 *
 * R2b 검증 요건:
 *  - BinanceWsClient + OkxWsClient: subscribe/unsubscribe + close + reconnect ≥ 8 case
 *  - klines.ts: fetch mock + cache 검증 ≥ 4 case
 *
 * jsdom 환경 (vitest.config 의 environment: 'jsdom').
 */

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { BinanceWsClient, createBinanceWsClient } from './binance-ws.js'
import type { TickHandler as BinanceTickHandler } from './binance-ws.js'
import { OkxWsClient, createOkxWsClient } from './okx-ws.js'
import type { TickHandler as OkxTickHandler } from './okx-ws.js'
import { fetchKlines, clearKlinesCache } from './klines.js'

// ===========================================================================
// Mock WebSocket (공유)
// ===========================================================================

type WsEventName = 'open' | 'message' | 'close' | 'error'

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState: number = MockWebSocket.CONNECTING
  url: string
  sentMessages: string[] = []

  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null

  static lastInstance: MockWebSocket | null = null
  static instances: MockWebSocket[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.lastInstance = this
    MockWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sentMessages.push(data)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  simulateMessage(data: string): void {
    this.onmessage?.(new MessageEvent('message', { data }))
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close'))
  }

  simulateError(): void {
    this.onerror?.(new Event('error'))
    this.simulateClose()
  }
}

// ===========================================================================
// Setup / Teardown
// ===========================================================================

beforeEach(() => {
  MockWebSocket.lastInstance = null
  MockWebSocket.instances = []
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', MockWebSocket)
  clearKlinesCache()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ===========================================================================
// Helpers
// ===========================================================================

function parseSent(ws: MockWebSocket, idx = 0): Record<string, unknown> {
  return JSON.parse(ws.sentMessages[idx] ?? '{}') as Record<string, unknown>
}

function makeBinanceTradeMsg(symbol: string, price: string, timeMs: number): string {
  return JSON.stringify({
    stream: `${symbol.toLowerCase()}@trade`,
    data: { p: price, T: timeMs, e: 'trade', s: symbol.toUpperCase() },
  })
}

function makeOkxTickerMsg(instId: string, last: string, ts: string): string {
  return JSON.stringify({
    arg: { channel: 'tickers', instId: instId.toUpperCase() },
    data: [{ instId: instId.toUpperCase(), last, ts, [Symbol.iterator as unknown as string]: undefined }],
  })
}

// ===========================================================================
// BinanceWsClient tests (Cases 1–8)
// ===========================================================================

describe('BinanceWsClient', () => {
  // Case 1: subscribe → WebSocket 생성 + SUBSCRIBE 전송
  it('Case 1: subscribe 호출 시 WebSocket 생성 + SUBSCRIBE 메시지 전송', () => {
    const client = createBinanceWsClient({ url: 'wss://mock.binance' })
    const handler: BinanceTickHandler = vi.fn()

    client.subscribe('BTCUSDT', handler)
    const ws = MockWebSocket.lastInstance!
    expect(ws).toBeTruthy()
    expect(ws.url).toBe('wss://mock.binance')

    ws.simulateOpen()

    expect(ws.sentMessages).toHaveLength(1)
    const msg = parseSent(ws)
    expect(msg['method']).toBe('SUBSCRIBE')
    expect(msg['params']).toEqual(['btcusdt@trade'])
    expect(typeof msg['id']).toBe('number')

    client.close()
  })

  // Case 2: trade 메시지 → handler 호출 + TickEvent 파싱 + exchange='binance'
  it('Case 2: trade 메시지 → TickEvent(exchange=binance) 파싱 검증', () => {
    const client = createBinanceWsClient({ url: 'wss://mock.binance' })
    const handler: BinanceTickHandler = vi.fn()

    client.subscribe('BTCUSDT', handler)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    ws.simulateMessage(makeBinanceTradeMsg('BTCUSDT', '62000.50', 1_716_000_000_000))

    expect(handler).toHaveBeenCalledTimes(1)
    const tick = (handler as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(tick?.exchange).toBe('binance')
    expect(tick?.symbol).toBe('BTCUSDT')
    expect(tick?.price).toBeCloseTo(62000.5, 2)
    expect(tick?.ts).toBe(1_716_000_000)

    client.close()
  })

  // Case 3: 같은 symbol 두 번째 subscribe → 추가 WebSocket 생성 없음
  it('Case 3: 같은 symbol 두 번째 subscribe → WebSocket 추가 생성 없음, 두 handler 모두 tick 수신', () => {
    const client = createBinanceWsClient({ url: 'wss://mock.binance' })
    const h1: BinanceTickHandler = vi.fn()
    const h2: BinanceTickHandler = vi.fn()

    client.subscribe('BTCUSDT', h1)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    const instancesBefore = MockWebSocket.instances.length
    client.subscribe('BTCUSDT', h2)
    expect(MockWebSocket.instances.length).toBe(instancesBefore)

    ws.simulateMessage(makeBinanceTradeMsg('BTCUSDT', '63000.00', 1_716_000_001_000))
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)

    client.close()
  })

  // Case 4: unsubscribe → handler 제거, 마지막 시 UNSUBSCRIBE 전송
  it('Case 4: unsubscribe → 마지막 handler 제거 시 UNSUBSCRIBE 전송', () => {
    const client = createBinanceWsClient({ url: 'wss://mock.binance' })
    const h1: BinanceTickHandler = vi.fn()
    const h2: BinanceTickHandler = vi.fn()

    client.subscribe('ETHUSDT', h1)
    client.subscribe('ETHUSDT', h2)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    const sentBefore = ws.sentMessages.length

    client.unsubscribe('ETHUSDT', h1)
    expect(ws.sentMessages.length).toBe(sentBefore) // UNSUBSCRIBE X

    client.unsubscribe('ETHUSDT', h2)
    expect(ws.sentMessages.length).toBe(sentBefore + 1)
    const msg = parseSent(ws, sentBefore)
    expect(msg['method']).toBe('UNSUBSCRIBE')
    expect(msg['params']).toEqual(['ethusdt@trade'])

    client.close()
  })

  // Case 5: ws.close 이벤트 → reconnect 후 subscriptions 재구독
  it('Case 5: ws.close → reconnect 후 SUBSCRIBE 재전송 + tick 수신', () => {
    const client = createBinanceWsClient({ url: 'wss://mock.binance', maxBackoffMs: 30_000 })
    const handler: BinanceTickHandler = vi.fn()

    client.subscribe('BTCUSDT', handler)
    const ws1 = MockWebSocket.lastInstance!
    ws1.simulateOpen()
    ws1.simulateClose()

    vi.advanceTimersByTime(1_000) // backoff 1s

    const ws2 = MockWebSocket.lastInstance!
    expect(ws2).not.toBe(ws1)
    ws2.simulateOpen()

    const resubMsg = parseSent(ws2, 0)
    expect(resubMsg['method']).toBe('SUBSCRIBE')
    expect(resubMsg['params']).toEqual(['btcusdt@trade'])

    ws2.simulateMessage(makeBinanceTradeMsg('BTCUSDT', '64000.00', 1_716_000_003_000))
    expect(handler).toHaveBeenCalledTimes(1)

    client.close()
  })

  // Case 6: close() → reconnect timer clear, ws.close 호출
  it('Case 6: close() → reconnect 중단, 추가 인스턴스 생성 없음', () => {
    const client = createBinanceWsClient({ url: 'wss://mock.binance' })
    const handler: BinanceTickHandler = vi.fn()

    client.subscribe('BTCUSDT', handler)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()
    ws.simulateClose()

    client.close()
    vi.advanceTimersByTime(5_000)

    expect(MockWebSocket.instances.length).toBe(1)
    expect(client.isConnected).toBe(false)
  })

  // Case 7: 잘못된 JSON → throw 없이 무시
  it('Case 7: 잘못된 JSON 메시지 → throw 없이 무시', () => {
    const client = createBinanceWsClient({ url: 'wss://mock.binance' })
    const handler: BinanceTickHandler = vi.fn()

    client.subscribe('BTCUSDT', handler)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    expect(() => ws.simulateMessage('{ broken json :::')).not.toThrow()
    expect(handler).not.toHaveBeenCalled()

    client.close()
  })

  // Case 8: 연속 실패 → backoff 1s → 2s → 4s 지수 증가
  it('Case 8: 연속 실패 시 backoff 1s → 2s → 4s 지수 증가', () => {
    const client = createBinanceWsClient({ url: 'wss://mock.binance', maxBackoffMs: 30_000 })
    const handler: BinanceTickHandler = vi.fn()

    client.subscribe('BTCUSDT', handler)

    // ws1: open 없이 바로 close → attempt=0, backoff=1s
    MockWebSocket.lastInstance!.simulateClose()
    expect(MockWebSocket.instances.length).toBe(1)
    vi.advanceTimersByTime(999)
    expect(MockWebSocket.instances.length).toBe(1)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances.length).toBe(2) // ws2

    // ws2: close → attempt=1, backoff=2s
    MockWebSocket.lastInstance!.simulateClose()
    vi.advanceTimersByTime(1_999)
    expect(MockWebSocket.instances.length).toBe(2)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances.length).toBe(3) // ws3

    // ws3: close → attempt=2, backoff=4s
    MockWebSocket.lastInstance!.simulateClose()
    vi.advanceTimersByTime(3_999)
    expect(MockWebSocket.instances.length).toBe(3)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances.length).toBe(4) // ws4

    client.close()
  })
})

// ===========================================================================
// OkxWsClient tests (Cases 9–16)
// ===========================================================================

describe('OkxWsClient', () => {
  // Case 9: subscribe → WebSocket 생성 + subscribe op 전송
  it('Case 9: subscribe 호출 시 WebSocket 생성 + subscribe op 전송', () => {
    const client = createOkxWsClient({ url: 'wss://mock.okx' })
    const handler: OkxTickHandler = vi.fn()

    client.subscribe('BTC-USDT', handler)
    const ws = MockWebSocket.lastInstance!
    expect(ws).toBeTruthy()
    expect(ws.url).toBe('wss://mock.okx')

    ws.simulateOpen()

    expect(ws.sentMessages).toHaveLength(1)
    const msg = parseSent(ws)
    expect(msg['op']).toBe('subscribe')
    const args = msg['args'] as Array<{ channel: string; instId: string }>
    expect(args[0]?.channel).toBe('tickers')
    expect(args[0]?.instId).toBe('BTC-USDT')

    client.close()
  })

  // Case 10: ticker 메시지 → handler 호출 + exchange='okx' + symbol='BTCUSDT'
  it('Case 10: ticker 메시지 → TickEvent(exchange=okx, symbol=BTCUSDT) 파싱 검증', () => {
    const client = createOkxWsClient({ url: 'wss://mock.okx' })
    const handler: OkxTickHandler = vi.fn()

    client.subscribe('BTC-USDT', handler)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    ws.simulateMessage(makeOkxTickerMsg('BTC-USDT', '65000.00', '1716000000000'))

    expect(handler).toHaveBeenCalledTimes(1)
    const tick = (handler as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(tick?.exchange).toBe('okx')
    expect(tick?.symbol).toBe('BTCUSDT')
    expect(tick?.price).toBeCloseTo(65000.0, 2)
    expect(tick?.ts).toBe(1_716_000_000)

    client.close()
  })

  // Case 11: unsubscribe → 마지막 handler 제거 시 unsubscribe op 전송
  it('Case 11: unsubscribe → 마지막 handler 제거 시 unsubscribe op 전송', () => {
    const client = createOkxWsClient({ url: 'wss://mock.okx' })
    const h1: OkxTickHandler = vi.fn()

    client.subscribe('ETH-USDT', h1)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    const sentBefore = ws.sentMessages.length
    client.unsubscribe('ETH-USDT', h1)
    expect(ws.sentMessages.length).toBe(sentBefore + 1)
    const msg = parseSent(ws, sentBefore)
    expect(msg['op']).toBe('unsubscribe')
    const args = msg['args'] as Array<{ channel: string; instId: string }>
    expect(args[0]?.instId).toBe('ETH-USDT')

    client.close()
  })

  // Case 12: close() → reconnect 중단
  it('Case 12: close() → reconnect 중단, 추가 인스턴스 없음', () => {
    const client = createOkxWsClient({ url: 'wss://mock.okx' })
    const handler: OkxTickHandler = vi.fn()

    client.subscribe('BTC-USDT', handler)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()
    ws.simulateClose()

    client.close()
    vi.advanceTimersByTime(5_000)

    expect(MockWebSocket.instances.length).toBe(1)
    expect(client.isConnected).toBe(false)
  })

  // Case 13: ws.close → reconnect 후 subscribe 재전송
  it('Case 13: ws.close → reconnect 후 subscribe op 재전송', () => {
    const client = createOkxWsClient({ url: 'wss://mock.okx', maxBackoffMs: 30_000 })
    const handler: OkxTickHandler = vi.fn()

    client.subscribe('BTC-USDT', handler)
    const ws1 = MockWebSocket.lastInstance!
    ws1.simulateOpen()
    ws1.simulateClose()

    vi.advanceTimersByTime(1_000)

    const ws2 = MockWebSocket.lastInstance!
    expect(ws2).not.toBe(ws1)
    ws2.simulateOpen()

    const resubMsg = parseSent(ws2, 0)
    expect(resubMsg['op']).toBe('subscribe')

    client.close()
  })

  // Case 14: 잘못된 JSON → throw 없이 무시
  it('Case 14: 잘못된 JSON → throw 없이 무시', () => {
    const client = createOkxWsClient({ url: 'wss://mock.okx' })
    const handler: OkxTickHandler = vi.fn()

    client.subscribe('BTC-USDT', handler)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    expect(() => ws.simulateMessage('bad json !!!')).not.toThrow()
    expect(handler).not.toHaveBeenCalled()

    client.close()
  })

  // Case 15: unsubscribe all (handler 생략) → handlers.clear 후 unsubscribe
  it('Case 15: unsubscribe(instId) 호출 시 모든 handler 제거 + unsubscribe op 전송', () => {
    const client = createOkxWsClient({ url: 'wss://mock.okx' })
    const h1: OkxTickHandler = vi.fn()
    const h2: OkxTickHandler = vi.fn()

    client.subscribe('SOL-USDT', h1)
    client.subscribe('SOL-USDT', h2)
    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    const sentBefore = ws.sentMessages.length
    client.unsubscribe('SOL-USDT') // handler 생략 → clear all
    expect(ws.sentMessages.length).toBe(sentBefore + 1)
    expect(parseSent(ws, sentBefore)['op']).toBe('unsubscribe')

    client.close()
  })

  // Case 16: OKX backoff 1s → 2s 검증
  it('Case 16: 연속 실패 시 backoff 1s → 2s 지수 증가', () => {
    const client = createOkxWsClient({ url: 'wss://mock.okx', maxBackoffMs: 30_000 })
    const handler: OkxTickHandler = vi.fn()

    client.subscribe('BTC-USDT', handler)

    MockWebSocket.lastInstance!.simulateClose() // attempt=0, 1s
    vi.advanceTimersByTime(999)
    expect(MockWebSocket.instances.length).toBe(1)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances.length).toBe(2) // ws2

    MockWebSocket.lastInstance!.simulateClose() // attempt=1, 2s
    vi.advanceTimersByTime(1_999)
    expect(MockWebSocket.instances.length).toBe(2)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances.length).toBe(3) // ws3

    client.close()
  })
})

// ===========================================================================
// klines.ts tests (Cases 17–20)
// ===========================================================================

describe('klines — fetchKlines', () => {
  // ---------------------------------------------------------------------------
  // Binance mock response builder
  // ---------------------------------------------------------------------------
  function makeBinanceKlinesResponse(count: number): unknown[] {
    return Array.from({ length: count }, (_, i) => [
      (1_716_000_000_000 + i * 60_000), // openTime ms
      `${30000 + i}.00`, // open
      `${30100 + i}.00`, // high
      `${29900 + i}.00`, // low
      `${30050 + i}.00`, // close
      `${10 + i}.5`,     // volume
    ])
  }

  // OKX mock response builder (최신 우선 → reversed input)
  function makeOkxKlinesResponse(count: number): { code: string; data: string[][] } {
    // OKX 는 최신 우선이므로 내림차순
    const data = Array.from({ length: count }, (_, i) => {
      const idx = count - 1 - i // 내림차순
      return [
        String(1_716_000_000_000 + idx * 60_000),
        String(30000 + idx),
        String(30100 + idx),
        String(29900 + idx),
        String(30050 + idx),
        String(10 + idx),
      ]
    })
    return { code: '0', data }
  }

  // Case 17: Binance fetch → Candle[] 반환 (time seconds, OHLCV float)
  it('Case 17: Binance fetchKlines → Candle[] 정상 파싱', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => makeBinanceKlinesResponse(3),
    })

    const candles = await fetchKlines('binance', 'BTCUSDT', '1m', 3, mockFetch as typeof fetch)

    expect(candles).toHaveLength(3)
    expect(candles[0]?.time).toBe(1_716_000_000) // ms → seconds
    expect(candles[0]?.open).toBeCloseTo(30000, 0)
    expect(candles[0]?.high).toBeCloseTo(30100, 0)
    expect(candles[0]?.close).toBeCloseTo(30050, 0)
    expect(candles[0]?.volume).toBeCloseTo(10.5, 1)

    // URL 검증
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('api.binance.com/api/v3/klines')
    expect(calledUrl).toContain('symbol=BTCUSDT')
    expect(calledUrl).toContain('interval=1m')
  })

  // Case 18: OKX fetch → Candle[] 반환 (내림차순 data → 오름차순 반전)
  it('Case 18: OKX fetchKlines → data 역순 정렬 + Candle[] 반환', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => makeOkxKlinesResponse(3),
    })

    const candles = await fetchKlines('okx', 'BTC-USDT', '1m', 3, mockFetch as typeof fetch)

    expect(candles).toHaveLength(3)
    // 오름차순: candles[0].time < candles[1].time
    expect(candles[0]!.time).toBeLessThan(candles[1]!.time)

    const calledUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('okx.com/api/v5/market/candles')
    expect(calledUrl).toContain('instId=BTC-USDT')
  })

  // Case 19: 캐시 — 두 번째 호출 시 fetch 재호출 없음
  it('Case 19: 60초 TTL 캐시 — 두 번째 호출은 fetch 없이 캐시 반환', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeBinanceKlinesResponse(2),
    })

    const c1 = await fetchKlines('binance', 'BTCUSDT', '5m', 2, mockFetch as typeof fetch)
    const c2 = await fetchKlines('binance', 'BTCUSDT', '5m', 2, mockFetch as typeof fetch)

    expect(mockFetch).toHaveBeenCalledTimes(1) // 두 번째는 캐시 사용
    expect(c1).toBe(c2) // 동일 참조
  })

  // Case 20: HTTP 에러 → throw
  it('Case 20: Binance HTTP 404 → throw Error', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    await expect(
      fetchKlines('binance', 'INVALIDPAIR', '1m', 10, mockFetch as typeof fetch),
    ).rejects.toThrow('Binance klines fetch failed: 404')
  })
})
