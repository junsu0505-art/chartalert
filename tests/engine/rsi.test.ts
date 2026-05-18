/**
 * tests/engine/rsi.test.ts
 *
 * evaluateRsiAlert 유닛 테스트 — 7 case
 *
 * 픽스처 설계 원칙:
 *   - technicalindicators RSI(14) 는 period 개 이후부터 값 생성 (15봉 → 첫 값)
 *   - cross_above: prevRsi < threshold AND currRsi >= threshold
 *   - cross_below: prevRsi > threshold AND currRsi <= threshold
 *   - 실제 계산값으로 검증 (가정 금지 — §5 검증 의무)
 */

import { describe, it, expect } from 'vitest'
import { evaluateRsiAlert } from '../../src/engine/rsi'
import type { Candle } from '../../src/data/types'
import type { RsiAlert } from '../../src/types'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function makeCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: 1_700_000_000 + i * 60,
    open: close - 0.5,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 1000,
  }))
}

function makeRsiAlert(overrides: Partial<RsiAlert> = {}): RsiAlert {
  return {
    id: 'test-rsi-1',
    symbol: 'BTCUSDT',
    exchange: 'binance',
    tfLabel: '1h',
    kind: 'rsi',
    direction: 'cross_above',
    status: 'armed',
    period: 14,
    threshold: 70,
    createdAt: 0,
    triggeredAt: null,
    ...overrides,
  }
}

// ──────────────────────────────────────────────
// Fixtures (실제 계산 검증: node -e "require('technicalindicators').RSI.calculate(...)")
// ──────────────────────────────────────────────

// cross_above 70: prev RSI = 61.11, curr RSI = 87.67
// 처음 15봉: 완만한 상승 (RSI ~61), 16번째 봉: 급등 (RSI ~87)
const CROSS_ABOVE_CLOSES: number[] = [
  100, 102, 101, 103, 102, 103, 104, 102, 103, 104,
  103, 104, 105, 103, 104,  // 15봉: RSI ≈ 61 (이전 봉)
  140,                       // 16봉: RSI ≈ 87 (현재 봉) → cross_above 70
]
const CROSS_ABOVE_CANDLES = makeCandles(CROSS_ABOVE_CLOSES)

// cross_below 30: prev RSI = 38.89, curr RSI = 12.33
// 처음 15봉: 완만한 하락 (RSI ~38), 16번째 봉: 급락 (RSI ~12)
const CROSS_BELOW_CLOSES: number[] = [
  100, 98, 99, 97, 98, 97, 96, 98, 97, 96,
  97, 96, 95, 97, 96,   // 15봉: RSI ≈ 38 (이전 봉)
  60,                    // 16봉: RSI ≈ 12 (현재 봉) → cross_below 30
]
const CROSS_BELOW_CANDLES = makeCandles(CROSS_BELOW_CLOSES)

// 단조 상승 20봉 — RSI 높게 유지, cross_above 70 미발화 (prev 이미 ≥ 70)
const FLAT_HIGH = makeCandles(Array(20).fill(200) as number[])

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('evaluateRsiAlert', () => {
  // case 1: paused → 즉시 반환
  it('paused alert 는 즉시 paused 반환', () => {
    const alert = makeRsiAlert({ status: 'paused' })
    const result = evaluateRsiAlert(alert, CROSS_ABOVE_CANDLES)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('paused')
  })

  // case 2: triggered status 도 paused (armed 아님)
  it('triggered 상태 alert 는 paused 반환', () => {
    const alert = makeRsiAlert({ status: 'triggered' })
    const result = evaluateRsiAlert(alert, CROSS_ABOVE_CANDLES)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('paused')
  })

  // case 3: 봉 부족 → insufficient_data
  it('봉 수 < period+1 이면 insufficient_data', () => {
    const alert = makeRsiAlert({ period: 14 })
    // 14+1=15봉 필요, 10봉만 공급
    const candles = makeCandles(Array(10).fill(100) as number[])
    const result = evaluateRsiAlert(alert, candles)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('insufficient_data')
  })

  // case 4: cross_above — RSI 가 threshold 를 상향 돌파하면 triggered
  // prev RSI (61.11) < 70, curr RSI (87.67) >= 70
  it('cross_above — RSI 가 threshold 상향 돌파 시 triggered', () => {
    const alert = makeRsiAlert({ direction: 'cross_above', threshold: 70 })
    const result = evaluateRsiAlert(alert, CROSS_ABOVE_CANDLES)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_above')
    expect(result.indicatorValue).toBeTypeOf('number')
    expect(result.indicatorValue!).toBeGreaterThanOrEqual(70)
  })

  // case 5: cross_below — RSI 가 threshold 를 하향 돌파하면 triggered
  // prev RSI (38.89) > 30, curr RSI (12.33) <= 30
  it('cross_below — RSI 가 threshold 하향 돌파 시 triggered', () => {
    const alert = makeRsiAlert({ direction: 'cross_below', threshold: 30 })
    const result = evaluateRsiAlert(alert, CROSS_BELOW_CANDLES)
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_below')
    expect(result.indicatorValue).toBeTypeOf('number')
    expect(result.indicatorValue!).toBeLessThanOrEqual(30)
  })

  // case 6: cross_above 미발화 — RSI 가 이미 threshold 위 (prev ≥ threshold → cross X)
  it('cross_above — 이미 threshold 이상이면 no_change (cross X)', () => {
    const alert = makeRsiAlert({ direction: 'cross_above', threshold: 70 })
    // 단조 상승 high closes → RSI 100 유지 → prev >= 70 이므로 cross 조건 불만족
    const result = evaluateRsiAlert(alert, FLAT_HIGH)
    expect(result.triggered).toBe(false)
    expect(result.reason).toBe('no_change')
  })

  // case 7: boundary — threshold 가 정확히 curr RSI 와 같을 때 cross_above 발화
  // cross_above 조건: prevRsi < threshold AND currRsi >= threshold
  // currRsi === threshold → >= 만족 → triggered
  it('cross_above — currRsi === threshold 이면 triggered (boundary 포함)', () => {
    // prev RSI = 61.11, curr RSI = 87.67 → threshold 를 87 로 설정하면 curr >= 87 → triggered
    const alert = makeRsiAlert({ direction: 'cross_above', threshold: 87 })
    const result = evaluateRsiAlert(alert, CROSS_ABOVE_CANDLES)
    // curr RSI ≈ 87.67 >= 87, prev RSI ≈ 61.11 < 87 → triggered
    expect(result.triggered).toBe(true)
    expect(result.reason).toBe('cross_above')
  })
})
