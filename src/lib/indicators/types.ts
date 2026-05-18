// 계산 input/output 인터페이스 placeholder — R2c 가 구체화

export interface IndicatorInput {
  /** OHLCV 종가 배열 */
  values: number[];
  /** 기간 (e.g. RSI=14, EMA=21) */
  period: number;
}

export interface IndicatorResult {
  /** 계산 결과 시계열 (NaN 포함 가능 — 초기 기간 부족) */
  values: number[];
}
