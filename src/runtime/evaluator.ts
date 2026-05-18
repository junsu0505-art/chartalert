/**
 * evaluator.ts — 5종 alert dispatcher (V2)
 *
 * UP-14: switch-exhaustive 패턴. 모든 alert.kind 분기 처리.
 * UP-15: pure function, race X.
 * UP-16: secret 0.
 */

import { evaluateTrendlineAlert } from '../engine/trendline'
import { evaluateHorizontalAlert } from '../engine/horizontal'
import { evaluateRsiAlert } from '../engine/rsi'
import { evaluateEmaAlert } from '../engine/ema'
import { evaluateMacdAlert } from '../engine/macd'
import type { Alert, TickEvent, EvaluateResult } from '../types'
import type { Candle } from '../data/types'

/**
 * Alert 종류에 따라 적합한 평가 함수로 dispatch한다.
 *
 * @param alert   - 평가할 alert (5종 discriminated union)
 * @param prev    - 이전 tick (null = 첫 tick)
 * @param curr    - 현재 tick
 * @param candles - 인디케이터 계산용 봉 배열 (trendline/horizontal 은 무시)
 * @returns EvaluateResult
 */
export function evaluateAlert(
  alert: Alert,
  prev: TickEvent | null,
  curr: TickEvent,
  candles: Candle[],
): EvaluateResult {
  switch (alert.kind) {
    case 'trendline':
      return evaluateTrendlineAlert(alert, prev, curr)
    case 'horizontal':
      return evaluateHorizontalAlert(alert, prev, curr)
    case 'rsi':
      return evaluateRsiAlert(alert, candles)
    case 'ema':
      return evaluateEmaAlert(alert, candles)
    case 'macd':
      return evaluateMacdAlert(alert, candles)
  }
}
