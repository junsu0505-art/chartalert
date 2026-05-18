/**
 * tests/engine/ema.test.ts
 *
 * evaluateEmaAlert 유닛 테스트 — 7 case
 */

import { describe, it, expect } from 'vitest'
import { evaluateEmaAlert } from '../../src/engine/ema'
import type { Candle } from '../../src/data/types'
import type { EmaAlert } from '../../src/types'

// ──────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────

function makeCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: 1_700_000_000 + i * 60,
    open: close - 1,
    high: close + 1,
    low: close - 1,
    close,
    volume: 500,
  }))
}

function makeEmaAlert(overrides: Partial<EmaAlert> = {}): EmaAlert {
  return {
    id: 'test-ema-1',
    symbol: 'ETHUSDT',
    exchange: 'binance',
    tfLabel: '15m',
    kind: 'ema',
    direction: 'cross_above',
    status: 'armed',
    fastPeriod: 5,
    slowPeriod: 10,
    createdAt: 0,
    triggeredAt: null,
    ...overrides,
  }
}

// EMA(5) 와 EMA(10) 골든 크로스 시나리오:
// 처음 15봉: 낮은 값 (fast EMA ≤ slow EMA), 마지막 1봉: 급등 (fast EMA > slow EMA)
// slowPeriod=10 → 최소 11봉 필요. 여기서 16봉 사용.
const GOLDEN_CROSS_CLOSES = [
  100, 100, 100, 100, 100,
  100, 100, 100, 100, 100,
  100,                      // 11봉: EMA 안정화
  90, 90, 90, 90,           // 하락 → fast < slow
  300,                      // 급등 → fast EMA > slow EMA (골든 크로스)
]
const GOLDEN_CROSS_CANDLES = makeCandles(GOLDEN_CROSS_CLOSES)

// 데드 크로스 시나리오:
// 처음 15봉: 높은 값 (fast EMA ≥ slow EMA), 마지막 1봉: 급락
const DEAD_CROSS_CLOSES = [
  200, 200, 200, 200, 200,
  200, 200, 200, 200, 200,
  200,                      // 11봉
  220, 220, 220, 220,       // 상승 → fast ≥ slow
  50,                       // 급락 → fast < slow (데드 크로스)
]
const DEAD_CROSS_CANDLES = makeCandles(DEAD_CROSS_CLOSES)

// 충분한 봉, 교차 없음 (단조 상승)
const NO_CROSS_CLOSES = Array.from({ length: 20 }, (_, i) => 100 + i)
const NO_CROSS_CANDLES = makeCandles(NO_CROSS_CLOSES)

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('evaluateEmaAlert', () => {
  // case 1: paused
  it('paused alert 는 즉시 paused 반환', () => {
    const alert = makeEmaAlert({ status: 'paused' })
    const result = evaluateEmaAlert(alert, GOLDEN_CROSS_CANDLES)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('paused')
  })

  // case 2: triggered status
  it('triggered 상태 alert 는 paused 반환', () => {
    const alert = makeEmaAlert({ status: 'triggered' })
    const result = evaluateEmaAlert(alert, GOLDEN_CROSS_CANDLES)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('paused')
  })

  // case 3: 봉 부족
  it('봉 수 < slowPeriod+1 이면 insufficient_data', () => {
    const alert = makeEmaAlert({ slowPeriod: 10 })
    // slowPeriod=10 → 최소 11봉, 여기서 5봉
    const candles = makeCandles([100, 100, 100, 100, 100])
    const result = evaluateEmaAlert(alert, candles)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('insufficient_data')
  })

  // case 4: cross_above 미발화 (단조 상승 — 교차 없음)
  it('cross_above — 교차 없으면 no_change', () => {
    const alert = makeEmaAlert({ direction: 'cross_above' })
    // 단조 상승 → fast 가 항상 위에 있어서 새 cross 없음
    const result = evaluateEmaAlert(alert, NO_CROSS_CANDLES)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
  })

  // case 5: 골든 크로스 성공
  it('cross_above — 골든 크로스 발생 시 triggered', () => {
    const alert = makeEmaAlert({ direction: 'cross_above' })
    const result = evaluateEmaAlert(alert, GOLDEN_CROSS_CANDLES)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_above')
    expect(result.indicatorValue).toBeTypeOf('number')
  })

  // case 6: 데드 크로스 성공
  it('cross_below — 데드 크로스 발생 시 triggered', () => {
    const alert = makeEmaAlert({ direction: 'cross_below' })
    const result = evaluateEmaAlert(alert, DEAD_CROSS_CANDLES)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_below')
    expect(result.indicatorValue).toBeTypeOf('number')
  })

  // case 7: boundary — prevFast === prevSlow (정확히 같은 값, 교차 X)
  // cross_above 조건: prevFast <= prevSlow AND currFast > currSlow
  // prevFast === prevSlow 면 첫 조건은 만족하지만 currFast > currSlow 가 필요
  it('cross_above — boundary: prevFast === prevSlow 이면 curr 에 달림', () => {
    const alert = makeEmaAlert({ direction: 'cross_above' })
    // flat → EMA fast = EMA slow → prevFast === prevSlow
    // 마지막 봉 급등 없으면 no_change
    const flat = makeCandles(Array(12).fill(100) as number[])
    const result = evaluateEmaAlert(alert, flat)
    // flat 에서 EMA fast = slow, no cross → no_change
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
  })
})
