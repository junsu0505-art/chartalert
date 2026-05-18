/**
 * klines.ts — REST 봉 데이터 fetch (Binance + OKX)
 *
 * 입력: (exchange, symbol, tf, limit)
 * 출력: Candle[]  ({ time, open, high, low, close, volume })
 *
 * cache: memory, TTL 60sec (key = `${exchange}:${symbol}:${tf}:${limit}`)
 *
 * Binance: GET https://api.binance.com/api/v3/klines
 *   params: symbol (e.g. BTCUSDT), interval (e.g. 1m), limit
 *   response: [ [openTime, open, high, low, close, volume, ...], ... ]
 *
 * OKX: GET https://www.okx.com/api/v5/market/candles
 *   params: instId (e.g. BTC-USDT), bar (e.g. 1m), limit
 *   response: { data: [ [ts, open, high, low, close, vol, ...], ... ] }
 *   note: data 는 최신 우선 (내림차순) → 반전 필요
 *
 * UP-16 secret: REST public endpoint, API key 없음.
 * license: 외부 lib 0.
 */

import type { Exchange, Timeframe } from '../types.js'
import type { Candle } from './types.js'

// ---------------------------------------------------------------------------
// Timeframe → exchange interval string 매핑
// ---------------------------------------------------------------------------

const BINANCE_TF: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
}

const OKX_TF: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
}

// ---------------------------------------------------------------------------
// Memory cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  candles: Candle[]
  expiresAt: number // Date.now() ms
}

const _cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000

function _cacheKey(exchange: Exchange, symbol: string, tf: Timeframe, limit: number): string {
  return `${exchange}:${symbol.toUpperCase()}:${tf}:${limit}`
}

function _getCached(key: string): Candle[] | null {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key)
    return null
  }
  return entry.candles
}

function _setCache(key: string, candles: Candle[]): void {
  _cache.set(key, { candles, expiresAt: Date.now() + CACHE_TTL_MS })
}

/** テスト用: cache 전체 삭제 */
export function clearKlinesCache(): void {
  _cache.clear()
}

// ---------------------------------------------------------------------------
// Binance fetch
// ---------------------------------------------------------------------------

const BINANCE_BASE = 'https://api.binance.com'

/** Binance klines raw row type */
type BinanceKlineRow = [
  number,  // 0: openTime (ms)
  string,  // 1: open
  string,  // 2: high
  string,  // 3: low
  string,  // 4: close
  string,  // 5: volume
  ...unknown[]
]

async function fetchBinanceKlines(
  symbol: string,
  tf: Timeframe,
  limit: number,
  fetchFn: typeof fetch,
): Promise<Candle[]> {
  const interval = BINANCE_TF[tf]
  const url = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`

  const res = await fetchFn(url)
  if (!res.ok) {
    throw new Error(`Binance klines fetch failed: ${res.status} ${res.statusText}`)
  }

  const raw = (await res.json()) as unknown[]
  return raw
    .filter((row): row is BinanceKlineRow => Array.isArray(row) && row.length >= 6)
    .map((row) => ({
      time: Math.floor((row[0] as number) / 1000), // ms → seconds
      open: parseFloat(row[1] as string),
      high: parseFloat(row[2] as string),
      low: parseFloat(row[3] as string),
      close: parseFloat(row[4] as string),
      volume: parseFloat(row[5] as string),
    }))
}

// ---------------------------------------------------------------------------
// OKX fetch
// ---------------------------------------------------------------------------

const OKX_BASE = 'https://www.okx.com'

/** OKX candles raw row type */
type OkxCandleRow = [
  string,  // 0: ts (ms as string)
  string,  // 1: open
  string,  // 2: high
  string,  // 3: low
  string,  // 4: close
  string,  // 5: vol
  ...unknown[]
]

/**
 * OKX instId 변환: "BTCUSDT" → "BTC-USDT"
 * 규칙: 마지막 4자(USDT) 앞에 '-' 삽입. 또는 마지막 3자(BTC) 앞에 '-' 삽입.
 * 단순화: 이미 '-' 포함 시 그대로, 없으면 마지막 USDT/BUSD/BTC/ETH 앞 '-' 삽입.
 */
function toOkxInstId(symbol: string): string {
  if (symbol.includes('-')) return symbol.toUpperCase()
  const upper = symbol.toUpperCase()
  // common quote currencies
  for (const quote of ['USDT', 'USDC', 'BTC', 'ETH', 'BNB']) {
    if (upper.endsWith(quote)) {
      const base = upper.slice(0, upper.length - quote.length)
      return `${base}-${quote}`
    }
  }
  return upper
}

interface OkxKlinesResponse {
  code: string
  data: OkxCandleRow[]
}

async function fetchOkxKlines(
  symbol: string,
  tf: Timeframe,
  limit: number,
  fetchFn: typeof fetch,
): Promise<Candle[]> {
  const instId = toOkxInstId(symbol)
  const bar = OKX_TF[tf]
  const url = `${OKX_BASE}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`

  const res = await fetchFn(url)
  if (!res.ok) {
    throw new Error(`OKX candles fetch failed: ${res.status} ${res.statusText}`)
  }

  const body = (await res.json()) as OkxKlinesResponse
  if (body.code !== '0') {
    throw new Error(`OKX candles error code: ${body.code}`)
  }

  // OKX 는 최신 우선 (내림차순) → 오름차순 반전
  return body.data
    .slice()
    .reverse()
    .map((row) => ({
      time: Math.floor(parseInt(row[0], 10) / 1000), // ms string → seconds
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
      volume: parseFloat(row[5]),
    }))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * fetchKlines — 봉 데이터 fetch (캐시 우선).
 *
 * @param exchange  'binance' | 'okx'
 * @param symbol    e.g. 'BTCUSDT' (Binance) 또는 'BTC-USDT' / 'BTCUSDT' (OKX, 자동 변환)
 * @param tf        Timeframe
 * @param limit     봉 개수 (max: Binance 1000, OKX 300)
 * @param fetchFn   fetch 구현 (테스트 주입 용). default: globalThis.fetch
 */
export async function fetchKlines(
  exchange: Exchange,
  symbol: string,
  tf: Timeframe,
  limit: number,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<Candle[]> {
  const key = _cacheKey(exchange, symbol, tf, limit)
  const cached = _getCached(key)
  if (cached !== null) return cached

  let candles: Candle[]
  if (exchange === 'binance') {
    candles = await fetchBinanceKlines(symbol, tf, limit, fetchFn)
  } else {
    candles = await fetchOkxKlines(symbol, tf, limit, fetchFn)
  }

  _setCache(key, candles)
  return candles
}
