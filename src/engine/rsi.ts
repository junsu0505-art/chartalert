/**
 * src/engine/rsi.ts — RSI 임계 cross 평가 엔진
 *
 * UP-15: pure function, race X.
 * UP-16: secrets = 0.
 * Tier 2: technicalindicators 는 반드시 wrapper 경유.
 */

import type { Candle } from '../data/types'
import type { RsiAlert, EvaluateResult } from '../types'
import { calcRSI } from '../lib/indicators'

/**
 * RSI alert 를 평가한다.
 *
 * @param alert  - 평가할 RsiAlert (kind='rsi')
 * @param candles - 최신 순서의 OHLCV 봉 배열 (오래된 봉 → 최신 봉).
 *                  최소 period+1 개 이상이어야 계산 가능.
 * @returns EvaluateResult
 */
export function evaluateRsiAlert(
  alert: RsiAlert,
  candles: Candle[],
): EvaluateResult {
  // 1. paused 상태 — 즉시 반환
  if (alert.status !== 'armed') {
    return { triggered: false, reason: 'paused' }
  }

  // 2. 봉 부족 — RSI 계산에 period+1 봉 필요 (prev + curr)
  if (candles.length < alert.period + 1) {
    return { triggered: false, reason: 'insufficient_data' }
  }

  // 3. RSI 계산
  const closes = candles.map(c => c.close)
  const rsi = calcRSI({ closes, period: alert.period }).values

  // technicalindicators 는 period 이후부터 값을 생성 — 최소 2개 필요
  if (rsi.length < 2) {
    return { triggered: false, reason: 'insufficient_data' }
  }

  const prevRsi = rsi[rsi.length - 2]!
  const currRsi = rsi[rsi.length - 1]!

  // 4. cross 판정
  if (
    alert.direction === 'cross_above' &&
    prevRsi < alert.threshold &&
    currRsi >= alert.threshold
  ) {
    return { triggered: true, reason: 'cross_above', indicatorValue: currRsi }
  }

  if (
    alert.direction === 'cross_below' &&
    prevRsi > alert.threshold &&
    currRsi <= alert.threshold
  ) {
    return { triggered: true, reason: 'cross_below', indicatorValue: currRsi }
  }

  return { triggered: false, reason: 'no_change', indicatorValue: currRsi }
}
