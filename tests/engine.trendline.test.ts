import { describe, it, expect } from 'vitest'
import { priceAtTime, evaluateTrendlineAlert } from '../src/engine/trendline'
import type { TrendlineAlert, TrendlinePoint, TickEvent } from '../src/types'

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

function makeAlert(overrides: Partial<TrendlineAlert> = {}): TrendlineAlert {
  const base: TrendlineAlert = {
    id: 'test-id',
    kind: 'trendline',
    symbol: 'BTCUSDT',
    exchange: 'binance',
    tfLabel: '4h',
    p1: { time: 1000, price: 59000 },
    p2: { time: 2000, price: 61000 },
    direction: 'cross_above',
    status: 'armed',
    createdAt: 0,
    triggeredAt: null,
  }
  return { ...base, ...overrides }
}

function makeTick(symbol: string, price: number, ts: number): TickEvent {
  return { symbol, price, ts, exchange: 'binance' }
}

// ─── priceAtTime ────────────────────────────────────────────────────────────

describe('priceAtTime', () => {
  // Case 1: 수평선 → 임의 시간에 항상 동일 가격
  it('Case 1: 수평선은 임의 시간에 항상 동일 가격', () => {
    const p1: TrendlinePoint = { time: 1000, price: 60000 }
    const p2: TrendlinePoint = { time: 2000, price: 60000 }
    expect(priceAtTime(p1, p2, 500)).toBe(60000)
    expect(priceAtTime(p1, p2, 1500)).toBe(60000)
    expect(priceAtTime(p1, p2, 3000)).toBe(60000)
  })

  // Case 2: 우상향 — 중점 시간에 중간 가격
  it('Case 2: 우상향 — 중점 시간에 중간 가격', () => {
    const p1: TrendlinePoint = { time: 1000, price: 59000 }
    const p2: TrendlinePoint = { time: 2000, price: 61000 }
    // slope = 2000/1000 = 2 per sec, midpoint time=1500 → 59000 + 2*500 = 60000
    expect(priceAtTime(p1, p2, 1500)).toBe(60000)
  })

  // Case 3: 우하향 — 중점 시간에 중간 가격
  it('Case 3: 우하향 — 중점 시간에 중간 가격', () => {
    const p1: TrendlinePoint = { time: 1000, price: 61000 }
    const p2: TrendlinePoint = { time: 2000, price: 59000 }
    // slope = -2 per sec, midpoint time=1500 → 61000 + (-2)*500 = 60000
    expect(priceAtTime(p1, p2, 1500)).toBe(60000)
  })

  // Case 4: 미래 시점 외삽 — 직선 연장
  it('Case 4: 미래 시점 외삽 — 직선 연장', () => {
    const p1: TrendlinePoint = { time: 1000, price: 59000 }
    const p2: TrendlinePoint = { time: 2000, price: 61000 }
    // slope = 2, time=3000 → 59000 + 2*(3000-1000) = 63000
    expect(priceAtTime(p1, p2, 3000)).toBe(63000)
  })

  // Case 5: p1.time === p2.time (수직선) → NaN
  it('Case 5: p1.time === p2.time (수직선) → NaN', () => {
    const p1: TrendlinePoint = { time: 1000, price: 59000 }
    const p2: TrendlinePoint = { time: 1000, price: 61000 }
    expect(priceAtTime(p1, p2, 1000)).toBeNaN()
    expect(priceAtTime(p1, p2, 1500)).toBeNaN()
  })
})

// ─── evaluateTrendlineAlert ─────────────────────────────────────────────────
// 우상향 추세선: p1=(1000,59000), p2=(2000,61000) → slope=2/sec
// time=1500 → linePrice=60000

describe('evaluateTrendlineAlert', () => {
  // Case 1: cross_above triggered — prev below, curr above line
  it('Case 1: cross_above triggered — prev below, curr above line', () => {
    const alert = makeAlert({ direction: 'cross_above' })
    const prev = makeTick('BTCUSDT', 59500, 1400)
    const curr = makeTick('BTCUSDT', 60500, 1500)
    const result = evaluateTrendlineAlert(alert, prev, curr)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_above')
    expect(result.linePrice).toBe(60000)
  })

  // Case 2: cross_below triggered — prev above, curr below line
  it('Case 2: cross_below triggered — prev above, curr below line', () => {
    const alert = makeAlert({ direction: 'cross_below' })
    const prev = makeTick('BTCUSDT', 60500, 1400)
    const curr = makeTick('BTCUSDT', 59500, 1500)
    const result = evaluateTrendlineAlert(alert, prev, curr)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_below')
    expect(result.linePrice).toBe(60000)
  })

  // Case 3: boundary — curr 정확히 linePrice → cross_above triggered (curr >= line)
  it('Case 3: boundary curr === linePrice → cross_above triggered', () => {
    const alert = makeAlert({ direction: 'cross_above' })
    const prev = makeTick('BTCUSDT', 59500, 1400)
    const curr = makeTick('BTCUSDT', 60000, 1500) // curr === linePrice
    const result = evaluateTrendlineAlert(alert, prev, curr)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_above')
  })

  // Case 4: boundary — prev === linePrice → cross_above NOT triggered (strict: prev < line)
  it('Case 4: boundary prev === linePrice → cross_above not triggered', () => {
    const alert = makeAlert({ direction: 'cross_above' })
    const prev = makeTick('BTCUSDT', 60000, 1400) // prev 정확히 line 위
    const curr = makeTick('BTCUSDT', 60500, 1500)
    const result = evaluateTrendlineAlert(alert, prev, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
  })

  // Case 5: wrong_symbol
  it('Case 5: symbol mismatch → wrong_symbol', () => {
    const alert = makeAlert({ symbol: 'BTCUSDT' })
    const prev = makeTick('ETHUSDT', 2900, 1400)
    const curr = makeTick('ETHUSDT', 3100, 1500)
    const result = evaluateTrendlineAlert(alert, prev, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('wrong_symbol')
  })

  // Case 6: status paused
  it('Case 6: status paused → triggered false, reason paused', () => {
    const alert = makeAlert({ status: 'paused' })
    const prev = makeTick('BTCUSDT', 59500, 1400)
    const curr = makeTick('BTCUSDT', 60500, 1500)
    const result = evaluateTrendlineAlert(alert, prev, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('paused')
    // linePrice 는 계산되어 set 됨
    expect(result.linePrice).toBe(60000)
  })

  // Case 7: status triggered → 재발화 차단 (paused 와 동일 처리)
  it('Case 7: status triggered → triggered false (재발화 차단)', () => {
    const alert = makeAlert({ status: 'triggered' })
    const prev = makeTick('BTCUSDT', 59500, 1400)
    const curr = makeTick('BTCUSDT', 60500, 1500)
    const result = evaluateTrendlineAlert(alert, prev, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('paused')
  })

  // Case 8: prevTick null (첫 tick) → no_change
  it('Case 8: prevTick null (첫 tick) → no_change', () => {
    const alert = makeAlert()
    const curr = makeTick('BTCUSDT', 60500, 1500)
    const result = evaluateTrendlineAlert(alert, null, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
    expect(result.linePrice).toBe(60000)
  })

  // Case 9: 수직선 (p1.time === p2.time) → linePrice NaN, no_change
  it('Case 9: 수직선 → linePrice NaN, no_change', () => {
    const alert = makeAlert({
      p1: { time: 1000, price: 59000 },
      p2: { time: 1000, price: 61000 }, // 수직선
    })
    const prev = makeTick('BTCUSDT', 59000, 900)
    const curr = makeTick('BTCUSDT', 61000, 1000)
    const result = evaluateTrendlineAlert(alert, prev, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
    expect(result.linePrice).toBeNaN()
  })

  // Case 10: 외삽 영역 — p2 미래 시점에서 cross 판정
  it('Case 10: 외삽 영역 — future ts cross_above triggered', () => {
    const alert = makeAlert({ direction: 'cross_above' })
    // time=3000 → linePrice = 59000 + 2*(3000-1000) = 63000
    const prev = makeTick('BTCUSDT', 62500, 2900)
    const curr = makeTick('BTCUSDT', 63500, 3000)
    const result = evaluateTrendlineAlert(alert, prev, curr)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_above')
    expect(result.linePrice).toBe(63000)
  })
})
