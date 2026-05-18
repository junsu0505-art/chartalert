/**
 * AlertList 컴포넌트 테스트
 * R5b — 5 kind 렌더 + onRemove/onPause/onResume 콜백 6 case 이상
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AlertList } from '../src/components/AlertList'
import type { Alert, TrendlineAlert, HorizontalAlert, RsiAlert, EmaAlert, MacdAlert } from '../src/types'

// ─── fixture helpers ───────────────────────────────────────────────────────

function base(overrides: Partial<Alert> = {}): Omit<Alert, 'kind'> {
  return {
    id: 'test-id',
    symbol: 'BTCUSDT',
    exchange: 'binance',
    tfLabel: '1h',
    direction: 'cross_above',
    status: 'armed',
    createdAt: 0,
    triggeredAt: null,
    ...overrides,
  }
}

const trendlineAlert: TrendlineAlert = {
  ...(base() as Omit<TrendlineAlert, 'kind' | 'p1' | 'p2'>),
  kind: 'trendline',
  id: 'a1',
  p1: { time: 1000, price: 76300 },
  p2: { time: 2000, price: 76500 },
}

const horizontalAlert: HorizontalAlert = {
  ...(base() as Omit<HorizontalAlert, 'kind' | 'price'>),
  kind: 'horizontal',
  id: 'a2',
  price: 80000,
}

const rsiAlert: RsiAlert = {
  ...(base() as Omit<RsiAlert, 'kind' | 'period' | 'threshold'>),
  kind: 'rsi',
  id: 'a3',
  period: 14,
  threshold: 70,
}

const emaAlert: EmaAlert = {
  ...(base() as Omit<EmaAlert, 'kind' | 'fastPeriod' | 'slowPeriod'>),
  kind: 'ema',
  id: 'a4',
  fastPeriod: 12,
  slowPeriod: 26,
}

const macdAlert: MacdAlert = {
  ...(base() as Omit<MacdAlert, 'kind' | 'fastPeriod' | 'slowPeriod' | 'signalPeriod'>),
  kind: 'macd',
  id: 'a5',
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
}

const ALL_ALERTS: Alert[] = [trendlineAlert, horizontalAlert, rsiAlert, emaAlert, macdAlert]

// ─── default no-op handlers ────────────────────────────────────────────────

const noop = { onUpdate: vi.fn(), onRemove: vi.fn(), onPause: vi.fn(), onResume: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── tests ─────────────────────────────────────────────────────────────────

describe('AlertList', () => {
  // case 1: 빈 목록 표시
  it('빈 목록 메시지를 표시한다', () => {
    render(<AlertList alerts={[]} {...noop} />)
    expect(screen.getByText(/등록된 알람이 없습니다/)).toBeTruthy()
  })

  // case 2: trendline kind 렌더
  it('trendline 알람을 렌더한다', () => {
    render(<AlertList alerts={[trendlineAlert]} {...noop} />)
    expect(screen.getByText(/추세선/)).toBeTruthy()
    expect(screen.getByText(/BTCUSDT/)).toBeTruthy()
  })

  // case 3: horizontal kind 렌더
  it('horizontal 알람을 렌더한다', () => {
    render(<AlertList alerts={[horizontalAlert]} {...noop} />)
    expect(screen.getByText(/가로선/)).toBeTruthy()
  })

  // case 4: rsi kind 렌더
  it('rsi 알람을 렌더한다', () => {
    render(<AlertList alerts={[rsiAlert]} {...noop} />)
    expect(screen.getByText(/RSI 14 임계 70/)).toBeTruthy()
  })

  // case 5: ema kind 렌더
  it('ema 알람을 렌더한다', () => {
    render(<AlertList alerts={[emaAlert]} {...noop} />)
    expect(screen.getByText(/EMA 12\/26/)).toBeTruthy()
  })

  // case 6: macd kind 렌더
  it('macd 알람을 렌더한다', () => {
    render(<AlertList alerts={[macdAlert]} {...noop} />)
    expect(screen.getByText(/MACD/)).toBeTruthy()
  })

  // case 7: 5종 모두 동시 렌더
  it('5종 알람을 모두 동시에 렌더한다', () => {
    render(<AlertList alerts={ALL_ALERTS} {...noop} />)
    const list = screen.getByRole('list', { name: /알람 목록/ })
    const items = list.querySelectorAll('li')
    expect(items).toHaveLength(5)
  })

  // case 8: onRemove 콜백 — 삭제 버튼
  it('삭제 버튼 클릭 시 onRemove(id)를 호출한다', () => {
    const onRemove = vi.fn()
    render(<AlertList alerts={[trendlineAlert]} {...noop} onRemove={onRemove} />)
    const deleteBtn = screen.getByRole('button', { name: /알람 삭제/ })
    fireEvent.click(deleteBtn)
    expect(onRemove).toHaveBeenCalledWith('a1')
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  // case 9: onPause 콜백 — 일시중지 버튼 (armed 상태)
  it('일시중지 버튼 클릭 시 onPause(id)를 호출한다', () => {
    const onPause = vi.fn()
    render(<AlertList alerts={[trendlineAlert]} {...noop} onPause={onPause} />)
    const pauseBtn = screen.getByRole('button', { name: /알람 일시중지/ })
    fireEvent.click(pauseBtn)
    expect(onPause).toHaveBeenCalledWith('a1')
    expect(onPause).toHaveBeenCalledTimes(1)
  })

  // case 10: onResume 콜백 — 재개 버튼 (paused 상태)
  it('재개 버튼 클릭 시 onResume(id)를 호출한다', () => {
    const pausedAlert: TrendlineAlert = { ...trendlineAlert, status: 'paused' }
    const onResume = vi.fn()
    render(<AlertList alerts={[pausedAlert]} {...noop} onResume={onResume} />)
    const resumeBtn = screen.getByRole('button', { name: /알람 재개/ })
    fireEvent.click(resumeBtn)
    expect(onResume).toHaveBeenCalledWith('a1')
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  // case 11: paused 상태에 일시중지 버튼 없음
  it('paused 상태에서는 일시중지 버튼이 없다', () => {
    const pausedAlert: TrendlineAlert = { ...trendlineAlert, status: 'paused' }
    render(<AlertList alerts={[pausedAlert]} {...noop} />)
    expect(screen.queryByRole('button', { name: /알람 일시중지/ })).toBeNull()
  })

  // case 12: status badge 표시
  it('status badge를 표시한다 — armed=대기중', () => {
    render(<AlertList alerts={[trendlineAlert]} {...noop} />)
    expect(screen.getByText('대기중')).toBeTruthy()
  })

  it('status badge를 표시한다 — paused=일시중지', () => {
    const pausedAlert: TrendlineAlert = { ...trendlineAlert, status: 'paused' }
    render(<AlertList alerts={[pausedAlert]} {...noop} />)
    expect(screen.getByText('일시중지')).toBeTruthy()
  })
})
