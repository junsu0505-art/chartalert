/**
 * src/engine/macd.ts — MACD line vs signal line cross 평가 엔진
 *
 * direction=cross_above: MACD line 이 signal line 위로 ↑
 * direction=cross_below: MACD line 이 signal line 아래로 ↓
 *
 * UP-15: pure function, race X.
 * UP-16: secrets = 0.
 * Tier 2: technicalindicators 는 반드시 wrapper 경유.
 */

import type { Candle } from '../data/types'
import type { MacdAlert, EvaluateResult } from '../types'
import { calcMACD } from '../lib/indicators'

/**
 * MACD signal line cross alert 를 평가한다.
 *
 * @param alert   - 평가할 MacdAlert (kind='macd')
 * @param candles - 최신 순서의 OHLCV 봉 배열 (오래된 봉 → 최신 봉).
 *                  MACD 계산에는 slowPeriod + signalPeriod - 1 + 1 봉 필요.
 * @returns EvaluateResult
 */
export function evaluateMacdAlert(
  alert: MacdAlert,
  candles: Candle[],
): EvaluateResult {
  // 1. paused 상태
  if (alert.status !== 'armed') {
    return { triggered: false, reason: 'paused' }
  }

  // 2. 봉 최소 요건 — slowPeriod + signalPeriod (MACD 가 signal 을 따라잡는 데 필요)
  const minCandles = alert.slowPeriod + alert.signalPeriod
  if (candles.length < minCandles) {
    return { triggered: false, reason: 'insufficient_data' }
  }

  // 3. MACD 계산
  const closes = candles.map(c => c.close)
  const { bars } = calcMACD({
    closes,
    fastPeriod: alert.fastPeriod,
    slowPeriod: alert.slowPeriod,
    signalPeriod: alert.signalPeriod,
  })

  // technicalindicators MACD output 의 앞부분은 undefined 포함 가능
  // cross 판정에는 MACD 와 signal 이 모두 정의된 마지막 2개 bars 필요
  const defined = bars.filter(
    (b): b is { MACD: number; signal: number; histogram?: number } =>
      b.MACD !== undefined && b.signal !== undefined,
  )

  if (defined.length < 2) {
    return { triggered: false, reason: 'insufficient_data' }
  }

  const prev = defined[defined.length - 2]!
  const curr = defined[defined.length - 1]!

  const prevMacd = prev.MACD
  const currMacd = curr.MACD
  const prevSignal = prev.signal
  const currSignal = curr.signal

  // 4. cross 판정
  // MACD 가 signal 위로: 이전 MACD ≤ signal, 현재 MACD > signal
  if (
    alert.direction === 'cross_above' &&
    prevMacd <= prevSignal &&
    currMacd > currSignal
  ) {
    return { triggered: true, reason: 'cross_above', indicatorValue: currMacd }
  }

  // MACD 가 signal 아래로: 이전 MACD ≥ signal, 현재 MACD < signal
  if (
    alert.direction === 'cross_below' &&
    prevMacd >= prevSignal &&
    currMacd < currSignal
  ) {
    return { triggered: true, reason: 'cross_below', indicatorValue: currMacd }
  }

  return { triggered: false, reason: 'no_change', indicatorValue: currMacd }
}
