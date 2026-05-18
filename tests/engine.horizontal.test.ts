import { describe, it, expect } from 'vitest'
import { evaluateHorizontalAlert } from '../src/engine/horizontal'
import type { HorizontalAlert, TickEvent } from '../src/types'

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

function makeAlert(overrides: Partial<HorizontalAlert> = {}): HorizontalAlert {
  const base: HorizontalAlert = {
    id: 'h-test-id',
    kind: 'horizontal',
    symbol: 'BTCUSDT',
    exchange: 'binance',
    tfLabel: '1h',
    price: 60000,
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

// ─── evaluateHorizontalAlert ────────────────────────────────────────────────

describe('evaluateHorizontalAlert', () => {
  // Case 1: cross_above triggered
  it('Case 1: cross_above triggered — prev below, curr above line', () => {
    const alert = makeAlert({ price: 60000, direction: 'cross_above' })
    const prev = makeTick('BTCUSDT', 59500, 100)
    const curr = makeTick('BTCUSDT', 60500, 200)
    const result = evaluateHorizontalAlert(alert, prev, curr)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_above')
    expect(result.linePrice).toBe(60000)
  })

  // Case 2: cross_below triggered
  it('Case 2: cross_below triggered — prev above, curr below line', () => {
    const alert = makeAlert({ price: 60000, direction: 'cross_below' })
    const prev = makeTick('BTCUSDT', 60500, 100)
    const curr = makeTick('BTCUSDT', 59500, 200)
    const result = evaluateHorizontalAlert(alert, prev, curr)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_below')
    expect(result.linePrice).toBe(60000)
  })

  // Case 3: 정확히 같은 가격 — curr === linePrice → cross_above triggered (curr >= line)
  it('Case 3: curr === linePrice → cross_above triggered (>= 경계)', () => {
    const alert = makeAlert({ price: 60000, direction: 'cross_above' })
    const prev = makeTick('BTCUSDT', 59999, 100)
    const curr = makeTick('BTCUSDT', 60000, 200) // 정확히 line
    const result = evaluateHorizontalAlert(alert, prev, curr)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_above')
  })

  // Case 4: prev === linePrice → cross_above NOT triggered (strict: prev < line)
  it('Case 4: prev === linePrice → cross_above not triggered (strict 부등)', () => {
    const alert = makeAlert({ price: 60000, direction: 'cross_above' })
    const prev = makeTick('BTCUSDT', 60000, 100) // prev 정확히 line
    const curr = makeTick('BTCUSDT', 60500, 200)
    const result = evaluateHorizontalAlert(alert, prev, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
  })

  // Case 5: wrong_symbol
  it('Case 5: symbol mismatch → wrong_symbol', () => {
    const alert = makeAlert({ symbol: 'BTCUSDT' })
    const prev = makeTick('ETHUSDT', 2900, 100)
    const curr = makeTick('ETHUSDT', 3100, 200)
    const result = evaluateHorizontalAlert(alert, prev, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('wrong_symbol')
  })

  // Case 6: status paused
  it('Case 6: status paused → triggered false, linePrice set', () => {
    const alert = makeAlert({ status: 'paused', price: 60000 })
    const prev = makeTick('BTCUSDT', 59500, 100)
    const curr = makeTick('BTCUSDT', 60500, 200)
    const result = evaluateHorizontalAlert(alert, prev, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('paused')
    expect(result.linePrice).toBe(60000)
  })

  // Case 7: triggered 후 추가 tick → 재발화 차단 (status=triggered → paused 처리)
  it('Case 7: status triggered → 재발화 차단', () => {
    const alert = makeAlert({ status: 'triggered', price: 60000 })
    const prev = makeTick('BTCUSDT', 59500, 300)
    const curr = makeTick('BTCUSDT', 60500, 400)
    const result = evaluateHorizontalAlert(alert, prev, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('paused')
  })

  // Case 8: prev null (첫 tick) → no_change
  it('Case 8: prev null (첫 tick) → no_change, linePrice set', () => {
    const alert = makeAlert({ price: 60000 })
    const curr = makeTick('BTCUSDT', 60500, 200)
    const result = evaluateHorizontalAlert(alert, null, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
    expect(result.linePrice).toBe(60000)
  })

  // Case 9: 둘 다 line 아래 → cross_above no_change
  it('Case 9: both below line → cross_above no_change', () => {
    const alert = makeAlert({ price: 60000, direction: 'cross_above' })
    const prev = makeTick('BTCUSDT', 59000, 100)
    const curr = makeTick('BTCUSDT', 59500, 200)
    const result = evaluateHorizontalAlert(alert, prev, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
    expect(result.linePrice).toBe(60000)
  })

  // Case 10: 둘 다 line 위 → cross_below no_change
  it('Case 10: both above line → cross_below no_change', () => {
    const alert = makeAlert({ price: 60000, direction: 'cross_below' })
    const prev = makeTick('BTCUSDT', 61000, 100)
    const curr = makeTick('BTCUSDT', 60500, 200)
    const result = evaluateHorizontalAlert(alert, prev, curr)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
    expect(result.linePrice).toBe(60000)
  })
})
