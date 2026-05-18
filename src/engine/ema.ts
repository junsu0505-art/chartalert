/**
 * src/engine/ema.ts — EMA fast/slow cross 평가 엔진
 *
 * direction=cross_above: fast EMA 가 slow EMA 위로 ↑ (골든 크로스)
 * direction=cross_below: fast EMA 가 slow EMA 아래로 ↓ (데드 크로스)
 *
 * UP-15: pure function, race X.
 * UP-16: secrets = 0.
 * Tier 2: technicalindicators 는 반드시 wrapper 경유.
 */

import type { Candle } from '../data/types'
import type { EmaAlert, EvaluateResult } from '../types'
import { calcEMA } from '../lib/indicators'

/**
 * EMA fast/slow cross alert 를 평가한다.
 *
 * @param alert   - 평가할 EmaAlert (kind='ema')
 * @param candles - 최신 순서의 OHLCV 봉 배열 (오래된 봉 → 최신 봉).
 *                  최소 slowPeriod+1 개 이상이어야 cross 판정 가능.
 * @returns EvaluateResult
 */
export function evaluateEmaAlert(
  alert: EmaAlert,
  candles: Candle[],
): EvaluateResult {
  // 1. paused 상태
  if (alert.status !== 'armed') {
    return { triggered: false, reason: 'paused' }
  }

  // 2. 봉 부족 — slow EMA 계산에 slowPeriod+1 봉 필요 (prev + curr)
  if (candles.length < alert.slowPeriod + 1) {
    return { triggered: false, reason: 'insufficient_data' }
  }

  // 3. fast / slow EMA 계산
  const closes = candles.map(c => c.close)
  const fastEma = calcEMA({ closes, period: alert.fastPeriod }).values
  const slowEma = calcEMA({ closes, period: alert.slowPeriod }).values

  // 두 EMA 모두 최소 2개 값 필요
  if (fastEma.length < 2 || slowEma.length < 2) {
    return { triggered: false, reason: 'insufficient_data' }
  }

  // fast 와 slow EMA 의 길이가 다를 수 있다 (fast period 가 짧으면 더 많은 값 생성).
  // cross 판정은 마지막 2봉 기준 — 인덱스를 각 배열 끝에서 맞춘다.
  const prevFast = fastEma[fastEma.length - 2]!
  const currFast = fastEma[fastEma.length - 1]!
  const prevSlow = slowEma[slowEma.length - 2]!
  const currSlow = slowEma[slowEma.length - 1]!

  // 4. cross 판정
  // 골든 크로스: 이전에는 fast ≤ slow, 현재 fast > slow
  if (
    alert.direction === 'cross_above' &&
    prevFast <= prevSlow &&
    currFast > currSlow
  ) {
    return { triggered: true, reason: 'cross_above', indicatorValue: currFast }
  }

  // 데드 크로스: 이전에는 fast ≥ slow, 현재 fast < slow
  if (
    alert.direction === 'cross_below' &&
    prevFast >= prevSlow &&
    currFast < currSlow
  ) {
    return { triggered: true, reason: 'cross_below', indicatorValue: currFast }
  }

  return { triggered: false, reason: 'no_change', indicatorValue: currFast }
}
