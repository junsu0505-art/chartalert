/**
 * hooks.useWsTicks.test.ts — useWsTicks hook 단위 테스트
 *
 * jsdom 환경, mock WebSocket 사용
 * 검증: tick 수신 시 lastTick 업데이트 + cleanup 시 ws.close 호출
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { TickEvent } from '../src/types'

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

interface MockWsInstance {
  readyState: number
  onopen: (() => void) | null
  onmessage: ((ev: { data: string }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  simulateOpen: () => void
  simulateMessage: (data: string) => void
}

let _lastInstance: MockWsInstance | null = null

class MockWebSocket {
  readyState = 0 // CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = 3 // CLOSED
    // onclose null check — BinanceWsClient.close() sets onclose=null before calling ws.close()
  })

  constructor(_url: string) {
    _lastInstance = this as unknown as MockWsInstance
  }

  simulateOpen() {
    this.readyState = 1 // OPEN
    this.onopen?.()
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data })
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  _lastInstance = null
  vi.stubGlobal('WebSocket', MockWebSocket)
  // Add OPEN constant
  ;(MockWebSocket as unknown as Record<string, number>)['OPEN'] = 1
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useWsTicks (binance)', () => {
  it('returns null lastTick initially', async () => {
    const { useWsTicks } = await import('../src/components/hooks/useWsTicks.js')
    const { result } = renderHook(() => useWsTicks('BTCUSDT', 'binance'))
    expect(result.current.lastTick).toBeNull()
  })

  it('updates lastTick on valid binance trade tick', async () => {
    const { useWsTicks } = await import('../src/components/hooks/useWsTicks.js')
    const { result } = renderHook(() => useWsTicks('BTCUSDT', 'binance'))

    // WebSocket 연결 완료 시뮬레이션
    act(() => {
      _lastInstance?.simulateOpen()
    })

    // Binance combined stream 메시지 시뮬레이션
    const msg = JSON.stringify({
      stream: 'btcusdt@trade',
      data: { p: '67500.50', T: 1700000000000 },
    })

    act(() => {
      _lastInstance?.simulateMessage(msg)
    })

    await waitFor(() => {
      expect(result.current.lastTick).not.toBeNull()
    })

    const tick = result.current.lastTick as TickEvent
    expect(tick.symbol).toBe('BTCUSDT')
    expect(tick.price).toBeCloseTo(67500.5)
    expect(tick.exchange).toBe('binance')
  })

  it('ignores malformed messages', async () => {
    const { useWsTicks } = await import('../src/components/hooks/useWsTicks.js')
    const { result } = renderHook(() => useWsTicks('BTCUSDT', 'binance'))

    act(() => {
      _lastInstance?.simulateOpen()
      _lastInstance?.simulateMessage('not json')
      _lastInstance?.simulateMessage(JSON.stringify({ invalid: true }))
    })

    expect(result.current.lastTick).toBeNull()
  })

  it('calls close on unmount (UP-15 cleanup)', async () => {
    const { useWsTicks } = await import('../src/components/hooks/useWsTicks.js')
    const { unmount } = renderHook(() => useWsTicks('BTCUSDT', 'binance'))

    act(() => {
      _lastInstance?.simulateOpen()
    })

    const instance = _lastInstance
    unmount()

    expect(instance?.close).toHaveBeenCalled()
  })
})

describe('useWsTicks (okx)', () => {
  it('updates lastTick on valid OKX ticker message', async () => {
    const { useWsTicks } = await import('../src/components/hooks/useWsTicks.js')
    const { result } = renderHook(() => useWsTicks('BTCUSDT', 'okx'))

    act(() => {
      _lastInstance?.simulateOpen()
    })

    // OKX tickers push message
    const msg = JSON.stringify({
      arg: { channel: 'tickers', instId: 'BTC-USDT' },
      data: [{ instId: 'BTC-USDT', last: '67800.00', ts: '1700000001000' }],
    })

    act(() => {
      _lastInstance?.simulateMessage(msg)
    })

    await waitFor(() => {
      expect(result.current.lastTick).not.toBeNull()
    })

    const tick = result.current.lastTick as TickEvent
    expect(tick.symbol).toBe('BTCUSDT')
    expect(tick.price).toBeCloseTo(67800)
    expect(tick.exchange).toBe('okx')
  })
})
