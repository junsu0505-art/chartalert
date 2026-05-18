/**
 * src/lib/indicators/index.ts — technicalindicators Tier 2 wrapper
 *
 * 이 파일만 technicalindicators 를 import 한다.
 * src/engine/* 는 반드시 이 wrapper 를 경유해야 한다 (Tier 2 doctrine).
 *
 * UP-15: pure functions, no side effects.
 * UP-16: secrets = 0.
 */

import { RSI, EMA, MACD } from 'technicalindicators'

// ──────────────────────────────────────────────
// RSI
// ──────────────────────────────────────────────

export interface RsiInput {
  closes: number[]
  period: number
}

export interface RsiOutput {
  values: number[]
}

export function calcRSI(input: RsiInput): RsiOutput {
  const values = RSI.calculate({ values: input.closes, period: input.period })
  return { values }
}

// ──────────────────────────────────────────────
// EMA
// ──────────────────────────────────────────────

export interface EmaInput {
  closes: number[]
  period: number
}

export interface EmaOutput {
  values: number[]
}

export function calcEMA(input: EmaInput): EmaOutput {
  const values = EMA.calculate({ values: input.closes, period: input.period })
  return { values }
}

// ──────────────────────────────────────────────
// MACD
// ──────────────────────────────────────────────

export interface MacdInput {
  closes: number[]
  fastPeriod: number
  slowPeriod: number
  signalPeriod: number
}

export interface MacdBar {
  MACD?: number
  signal?: number
  histogram?: number
}

export interface MacdOutput {
  bars: MacdBar[]
}

export function calcMACD(input: MacdInput): MacdOutput {
  const bars = MACD.calculate({
    values: input.closes,
    fastPeriod: input.fastPeriod,
    slowPeriod: input.slowPeriod,
    signalPeriod: input.signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  })
  return { bars }
}
