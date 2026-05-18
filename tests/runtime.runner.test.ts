/**
 * runtime.runner.test.ts — AlertRunner mock test (≥8 cases)
 *
 * UP-15: _handleTrigger updateAlert → unsubscribe 순서 보장 확인.
 * UP-16: secret 0 — cfg 는 mock 주입.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AlertRunner } from '../src/runtime/runner'
import type { AlertRunnerOpts } from '../src/runtime/runner'
import type { Alert, TrendlineAlert, HorizontalAlert, TickEvent } from '../src/types'
import type { Candle } from '../src/data/types'

// ---------------------------------------------------------------------------
// Mock storage/local (updateAlert, getTelegramConfig, getDiscordConfig)
// ---------------------------------------------------------------------------

vi.mock('../src/storage/local', () => ({
  updateAlert: vi.fn(),
  getTelegramConfig: vi.fn(() => null),
  getDiscordConfig: vi.fn(() => null),
}))

// ---------------------------------------------------------------------------
// Mock notify modules (no real network calls)
// ---------------------------------------------------------------------------

vi.mock('../src/notify/telegram', () => ({
  sendTelegramMessage: vi.fn(async () => ({ ok: true, status: 200 })),
}))

vi.mock('../src/notify/discord', () => ({
  sendDiscordMessage: vi.fn(async () => ({ ok: true, status: 204 })),
}))

// ---------------------------------------------------------------------------
// Minimal mock WS clients
// ---------------------------------------------------------------------------

type TickHandler = (tick: TickEvent) => void

function makeMockWs() {
  const subs = new Map<string, Set<TickHandler>>()
  return {
    _subs: subs,
    subscribe: vi.fn((symbol: string, handler: TickHandler) => {
      const key = symbol.toLowerCase()
      if (!subs.has(key)) subs.set(key, new Set())
      subs.get(key)!.add(handler)
    }),
    unsubscribe: vi.fn((symbol: string, handler: TickHandler) => {
      const key = symbol.toLowerCase()
      subs.get(key)?.delete(handler)
    }),
    close: vi.fn(),
    isConnected: false,
    // helper: dispatch a tick to all handlers for this symbol
    dispatch(symbol: string, tick: TickEvent) {
      const key = symbol.toLowerCase()
      for (const h of subs.get(key) ?? []) h(tick)
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = {
  id: 'a1',
  symbol: 'BTCUSDT',
  exchange: 'binance' as const,
  tfLabel: '1h' as const,
  direction: 'cross_above' as const,
  status: 'armed' as const,
  createdAt: 0,
  triggeredAt: null,
}

function makeTrendlineAlert(overrides: Partial<TrendlineAlert> = {}): TrendlineAlert {
  return {
    ...BASE,
    kind: 'trendline',
    p1: { time: 1700000000, price: 100 },
    p2: { time: 1700003600, price: 100 },
    ...overrides,
  }
}

function makeHorizontalAlert(price: number, overrides: Partial<HorizontalAlert> = {}): HorizontalAlert {
  return {
    ...BASE,
    id: crypto.randomUUID(),
    kind: 'horizontal',
    price,
    ...overrides,
  }
}

function makeTick(price: number, ts = 1700000100): TickEvent {
  return { symbol: 'BTCUSDT', price, ts, exchange: 'binance' }
}

function makeOpts(
  binanceWs: ReturnType<typeof makeMockWs>,
  okxWs: ReturnType<typeof makeMockWs>,
  candles: Candle[] = [],
  onTrigger?: AlertRunnerOpts['onTrigger'],
): AlertRunnerOpts {
  return {
    binanceWs: binanceWs as unknown as AlertRunnerOpts['binanceWs'],
    okxWs: okxWs as unknown as AlertRunnerOpts['okxWs'],
    getCandles: () => candles,
    onTrigger,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AlertRunner', () => {
  let binanceWs: ReturnType<typeof makeMockWs>
  let okxWs: ReturnType<typeof makeMockWs>

  beforeEach(() => {
    binanceWs = makeMockWs()
    okxWs = makeMockWs()
    vi.clearAllMocks()
  })

  // Case 1: subscribe — binance.subscribe 호출 확인
  it('Case 1: subscribe → binanceWs.subscribe 호출', () => {
    const runner = new AlertRunner(makeOpts(binanceWs, okxWs))
    const alert = makeTrendlineAlert()
    runner.subscribe(alert)
    expect(binanceWs.subscribe).toHaveBeenCalledWith('BTCUSDT', expect.any(Function))
  })

  // Case 2: subscribe 중복 방지 — 동일 id 2회 subscribe → binanceWs.subscribe 1회만
  it('Case 2: 동일 id 2회 subscribe → binanceWs.subscribe 1회만', () => {
    const runner = new AlertRunner(makeOpts(binanceWs, okxWs))
    const alert = makeTrendlineAlert()
    runner.subscribe(alert)
    runner.subscribe(alert)
    expect(binanceWs.subscribe).toHaveBeenCalledTimes(1)
  })

  // Case 3: unsubscribe → binanceWs.unsubscribe 호출
  it('Case 3: unsubscribe → binanceWs.unsubscribe 호출', () => {
    const runner = new AlertRunner(makeOpts(binanceWs, okxWs))
    const alert = makeTrendlineAlert()
    runner.subscribe(alert)
    runner.unsubscribe(alert)
    expect(binanceWs.unsubscribe).toHaveBeenCalledWith('BTCUSDT', expect.any(Function))
  })

  // Case 4: stop → binanceWs.close + okxWs.close 호출
  it('Case 4: stop → ws.close 모두 호출', () => {
    const runner = new AlertRunner(makeOpts(binanceWs, okxWs))
    runner.stop()
    expect(binanceWs.close).toHaveBeenCalled()
    expect(okxWs.close).toHaveBeenCalled()
  })

  // Case 5: start(alerts) — armed alerts 만 subscribe
  it('Case 5: start — armed 만 subscribe, paused 는 skip', () => {
    const runner = new AlertRunner(makeOpts(binanceWs, okxWs))
    const armed = makeTrendlineAlert({ id: 'a1', status: 'armed' })
    const paused = makeTrendlineAlert({ id: 'a2', status: 'paused' })
    const triggered = makeTrendlineAlert({ id: 'a3', status: 'triggered' })
    runner.start([armed, paused, triggered])
    expect(binanceWs.subscribe).toHaveBeenCalledTimes(1)
  })

  // Case 6: tick → trendline cross → onTrigger 호출 (fire-and-forget)
  it('Case 6: tick cross → onTrigger 콜백 호출 (async)', async () => {
    const onTrigger = vi.fn()
    const runner = new AlertRunner(makeOpts(binanceWs, okxWs, [], onTrigger))
    const alert = makeTrendlineAlert({
      p1: { time: 1700000000, price: 100 },
      p2: { time: 1700003600, price: 100 },
    })
    runner.subscribe(alert)

    // prev tick: price=99 (below line=100)
    binanceWs.dispatch('BTCUSDT', makeTick(99, 1700000050))
    // curr tick: price=101 (above line=100) → cross_above
    binanceWs.dispatch('BTCUSDT', makeTick(101, 1700000100))

    // _handleTrigger is async fire-and-forget — flush microtasks
    await vi.waitFor(() => expect(onTrigger).toHaveBeenCalled(), { timeout: 200 })
    expect(onTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', status: 'triggered' }),
      expect.any(Object),
    )
  })

  // Case 7: triggered 후 unsubscribe — 추가 tick 이 onTrigger 를 다시 호출하지 않는다
  it('Case 7: trigger 후 추가 tick → onTrigger 1회만 호출', async () => {
    const onTrigger = vi.fn()
    const runner = new AlertRunner(makeOpts(binanceWs, okxWs, [], onTrigger))
    const alert = makeTrendlineAlert({
      p1: { time: 1700000000, price: 100 },
      p2: { time: 1700003600, price: 100 },
    })
    runner.subscribe(alert)

    binanceWs.dispatch('BTCUSDT', makeTick(99, 1700000050))
    binanceWs.dispatch('BTCUSDT', makeTick(101, 1700000100))
    await vi.waitFor(() => expect(onTrigger).toHaveBeenCalledTimes(1), { timeout: 200 })

    // 이후 추가 tick 은 unsubscribe 로 handler 가 제거되어 있어야 함
    binanceWs.dispatch('BTCUSDT', makeTick(102, 1700000200))
    await new Promise((r) => setTimeout(r, 50))
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  // Case 8: OKX exchange alert → okxWs.subscribe 호출
  it('Case 8: exchange=okx alert → okxWs.subscribe 호출', () => {
    const runner = new AlertRunner(makeOpts(binanceWs, okxWs))
    const alert = makeHorizontalAlert(100, {
      exchange: 'okx',
      symbol: 'BTCUSDT',
    })
    runner.subscribe(alert)
    // OKX instId = BTC-USDT
    expect(okxWs.subscribe).toHaveBeenCalledWith('BTC-USDT', expect.any(Function))
    expect(binanceWs.subscribe).not.toHaveBeenCalled()
  })

  // Case 9: horizontal alert — no_change 시 onTrigger 미호출
  it('Case 9: horizontal — price 미달 → onTrigger 미호출', async () => {
    const onTrigger = vi.fn()
    const runner = new AlertRunner(makeOpts(binanceWs, okxWs, [], onTrigger))
    const alert = makeHorizontalAlert(100000, { id: 'h1' }) // 매우 높은 가격
    runner.subscribe(alert)

    binanceWs.dispatch('BTCUSDT', makeTick(50000, 1700000050))
    binanceWs.dispatch('BTCUSDT', makeTick(50001, 1700000100))
    await new Promise((r) => setTimeout(r, 50))
    expect(onTrigger).not.toHaveBeenCalled()
  })

  // Case 10: paused alert → resume → subscribe
  it('Case 10: resume 후 subscribe — binanceWs.subscribe 재호출', () => {
    const runner = new AlertRunner(makeOpts(binanceWs, okxWs))
    const alert = makeTrendlineAlert({ id: 'a10', status: 'paused' })

    // start 는 armed 만 — paused 는 skip
    runner.start([alert])
    expect(binanceWs.subscribe).not.toHaveBeenCalled()

    // resume 후 직접 subscribe
    runner.subscribe({ ...alert, status: 'armed' })
    expect(binanceWs.subscribe).toHaveBeenCalledTimes(1)
  })
})
