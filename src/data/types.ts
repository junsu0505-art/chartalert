/**
 * src/data/types.ts — data 계층 전용 타입 (R2b 추가)
 *
 * 이 파일은 src/data/ 스코프 내부 전용.
 * R2c (indicators) 에서 Candle 을 import 한다.
 *
 * UP-1 scope: src/data/ only.
 */

export interface Candle {
  time: number   // unix seconds (봉 시작 시각)
  open: number
  high: number
  low: number
  close: number
  volume: number
}
