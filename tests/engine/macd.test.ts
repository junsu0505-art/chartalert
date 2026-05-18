/**
 * tests/engine/macd.test.ts
 *
 * evaluateMacdAlert 유닛 테스트 — 7 case
 *
 * 픽스처 설계 원칙:
 *   - MACD(12,26,9): signal 이 정의되려면 slowPeriod(26) + signalPeriod(9) = 35봉 이상 필요
 *   - flat 봉은 signal=undefined → defined 필터 후 < 2 → insufficient_data
 *   - 실제 계산값으로 검증 (가정 금지 — §5 검증 의무)
 *   - cross_above: prevMacd <= prevSignal AND currMacd > currSignal
 *   - cross_below: prevMacd >= prevSignal AND currMacd < currSignal
 */

import { describe, it, expect } from 'vitest'
import { evaluateMacdAlert } from '../../src/engine/macd'
import type { Candle } from '../../src/data/types'
import type { MacdAlert } from '../../src/types'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function makeCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: 1_700_000_000 + i * 60,
    open: close - 1,
    high: close + 1,
    low: close - 1,
    close,
    volume: 800,
  }))
}

function makeMacdAlert(overrides: Partial<MacdAlert> = {}): MacdAlert {
  return {
    id: 'test-macd-1',
    symbol: 'SOLUSDT',
    exchange: 'okx',
    tfLabel: '4h',
    kind: 'macd',
    direction: 'cross_above',
    status: 'armed',
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    createdAt: 0,
    triggeredAt: null,
    ...overrides,
  }
}

// ──────────────────────────────────────────────
// Fixtures (실제 계산 검증: node -e "require('technicalindicators').MACD.calculate(...)")
//
// cross_above 설계:
//   40봉 단조 상승(100+i) → 4봉 급락(50,40,30,20) → 1봉 급등(500)
//   마지막 정의 2개 bar: prevMacd=-17.517 < prevSignal=-3.476, currMacd=16.927 > currSignal=0.605
//   → cross_above 발화
//
// cross_below 설계:
//   40봉 단조 하락(200-i) → 4봉 급등(260,270,280,290) → 1봉 급락(10)
//   마지막 정의 2개 bar: prevMacd=19.741 > prevSignal=4.484, currMacd=1.496 < currSignal=3.886
//   → cross_below 발화
//
// no_cross 설계:
//   50봉 단조 상승(100+i*3) → MACD ≈ signal (같은 값, 교차 없음)
// ──────────────────────────────────────────────

// cross_above 픽스처 (45봉)
const MACD_CROSS_ABOVE_CLOSES: number[] = [
  ...Array.from({ length: 40 }, (_, i) => 100 + i),
  50, 40, 30, 20,  // 급락
  500,              // 급등 → MACD crosses above signal
]
const MACD_CROSS_ABOVE_CANDLES = makeCandles(MACD_CROSS_ABOVE_CLOSES)

// cross_below 픽스처 (45봉)
const MACD_CROSS_BELOW_CLOSES: number[] = [
  ...Array.from({ length: 40 }, (_, i) => 200 - i),
  260, 270, 280, 290,  // 급등
  10,                   // 급락 → MACD crosses below signal
]
const MACD_CROSS_BELOW_CANDLES = makeCandles(MACD_CROSS_BELOW_CLOSES)

// no_cross 픽스처 (50봉 단조 상승)
const NO_CROSS_CLOSES: number[] = Array.from({ length: 50 }, (_, i) => 100 + i * 3)
const NO_CROSS_CANDLES = makeCandles(NO_CROSS_CLOSES)

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('evaluateMacdAlert', () => {
  // case 1: paused
  it('paused alert 는 즉시 paused 반환', () => {
    const alert = makeMacdAlert({ status: 'paused' })
    const result = evaluateMacdAlert(alert, MACD_CROSS_ABOVE_CANDLES)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('paused')
  })

  // case 2: triggered status
  it('triggered 상태 alert 는 paused 반환', () => {
    const alert = makeMacdAlert({ status: 'triggered' })
    const result = evaluateMacdAlert(alert, MACD_CROSS_ABOVE_CANDLES)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('paused')
  })

  // case 3: 봉 부족 → insufficient_data (minCandles = 26+9 = 35)
  it('봉 수 < slowPeriod+signalPeriod 이면 insufficient_data', () => {
    const alert = makeMacdAlert()
    const candles = makeCandles(Array(20).fill(100) as number[])
    const result = evaluateMacdAlert(alert, candles)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('insufficient_data')
  })

  // case 4: cross_above 성공 발화
  // prevMacd (-17.517) < prevSignal (-3.476), currMacd (16.927) > currSignal (0.605)
  it('cross_above — MACD 가 signal 위로 돌파 시 triggered', () => {
    const alert = makeMacdAlert({ direction: 'cross_above' })
    const result = evaluateMacdAlert(alert, MACD_CROSS_ABOVE_CANDLES)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_above')
    expect(result.indicatorValue).toBeTypeOf('number')
    // currMacd > currSignal 이면 positive MACD
    expect(result.indicatorValue!).toBeGreaterThan(0)
  })

  // case 5: cross_below 성공 발화
  // prevMacd (19.741) > prevSignal (4.484), currMacd (1.496) < currSignal (3.886)
  it('cross_below — MACD 가 signal 아래로 돌파 시 triggered', () => {
    const alert = makeMacdAlert({ direction: 'cross_below' })
    const result = evaluateMacdAlert(alert, MACD_CROSS_BELOW_CANDLES)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_below')
    expect(result.indicatorValue).toBeTypeOf('number')
  })

  // case 6: cross_above 미발화 — 단조 상승에서 MACD = signal (교차 없음)
  it('cross_above — MACD 교차 없으면 no_change', () => {
    const alert = makeMacdAlert({ direction: 'cross_above' })
    // 단조 상승 → MACD ≈ signal 에 수렴, no_change
    const result = evaluateMacdAlert(alert, NO_CROSS_CANDLES)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
  })

  // case 7: wrong direction 미발화 — cross_above 픽스처에서 cross_below 요청
  it('cross_below 요청 — cross_above 발생 픽스처에서 no_change', () => {
    const alert = makeMacdAlert({ direction: 'cross_below' })
    // cross_above 픽스처 (MACD가 signal 위로) → cross_below 조건 불만족 → no_change
    const result = evaluateMacdAlert(alert, MACD_CROSS_ABOVE_CANDLES)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
  })
})
