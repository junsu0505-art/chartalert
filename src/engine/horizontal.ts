import type { HorizontalAlert, TickEvent, EvaluateResult } from '../types'

/**
 * 가로 가격선 cross 판정.
 * priceAtTime 불필요 — alert.price 를 직접 linePrice 로 사용.
 *
 * 조기 반환 우선순위:
 *   1. wrong_symbol  — alert.symbol !== curr.symbol
 *   2. paused        — alert.status !== 'armed'
 *   3. no_change     — prev === null (첫 tick)
 *
 * cross 판정 (strict 부등):
 *   cross_above: prev < linePrice && curr >= linePrice
 *   cross_below: prev > linePrice && curr <= linePrice
 *   그 외: no_change
 */
export function evaluateHorizontalAlert(
  alert: HorizontalAlert,
  prev: TickEvent | null,
  curr: TickEvent
): EvaluateResult {
  // 1. symbol 불일치
  if (alert.symbol !== curr.symbol) {
    return { triggered: false, reason: 'wrong_symbol' }
  }

  // 2. 발화 대기 상태가 아님
  if (alert.status !== 'armed') {
    return { triggered: false, reason: 'paused', linePrice: alert.price }
  }

  // 3. 첫 tick — prev 없음
  if (!prev) {
    return { triggered: false, reason: 'no_change', linePrice: alert.price }
  }

  // 4. cross 판정
  const linePrice = alert.price

  if (alert.direction === 'cross_above' && prev.price < linePrice && curr.price >= linePrice) {
    return { triggered: true, reason: 'cross_above', linePrice }
  }

  if (alert.direction === 'cross_below' && prev.price > linePrice && curr.price <= linePrice) {
    return { triggered: true, reason: 'cross_below', linePrice }
  }

  return { triggered: false, reason: 'no_change', linePrice }
}
