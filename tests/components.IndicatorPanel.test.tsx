/**
 * tests/components.IndicatorPanel.test.tsx
 *
 * IndicatorPanel 유닛 테스트 — 8 case
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  IndicatorPanel,
  DEFAULT_INDICATOR_CONFIG,
} from '../src/components/IndicatorPanel'
import type { IndicatorConfig } from '../src/components/IndicatorPanel'

function makeConfig(overrides: Partial<IndicatorConfig> = {}): IndicatorConfig {
  return {
    ...DEFAULT_INDICATOR_CONFIG,
    ...overrides,
  }
}

describe('IndicatorPanel', () => {
  // case 1: 3개 체크박스가 렌더된다
  it('RSI / EMA / MACD 체크박스가 렌더된다', () => {
    render(<IndicatorPanel config={makeConfig()} onChange={vi.fn()} />)

    expect(screen.getByLabelText('RSI 활성화')).toBeDefined()
    expect(screen.getByLabelText('EMA 활성화')).toBeDefined()
    expect(screen.getByLabelText('MACD 활성화')).toBeDefined()
  })

  // case 2: aside role + 레이블 존재
  it('role=complementary(aside) 렌더', () => {
    const { container } = render(
      <IndicatorPanel config={makeConfig()} onChange={vi.fn()} />,
    )
    const aside = container.querySelector('aside')
    expect(aside).not.toBeNull()
  })

  // case 3: RSI 비활성 상태에서 period 입력 미노출
  it('RSI disabled 시 기간 입력 미노출', () => {
    render(
      <IndicatorPanel
        config={makeConfig({ rsi: { enabled: false, period: 14 } })}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText('기간')).toBeNull()
  })

  // case 4: RSI 활성화 시 period 입력 노출
  it('RSI enabled 시 기간 입력 노출', () => {
    render(
      <IndicatorPanel
        config={makeConfig({ rsi: { enabled: true, period: 14 } })}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('기간')).toBeDefined()
  })

  // case 5: RSI 체크박스 토글 → onChange 호출, enabled 반전
  it('RSI 체크박스 클릭 시 onChange 에서 rsi.enabled 반전', () => {
    const onChange = vi.fn()
    const config = makeConfig({ rsi: { enabled: false, period: 14 } })
    render(<IndicatorPanel config={config} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('RSI 활성화'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0] as IndicatorConfig
    expect(next.rsi.enabled).toBe(true)
    // 다른 필드 보존
    expect(next.rsi.period).toBe(14)
  })

  // case 6: EMA 체크박스 토글 → onChange 호출, enabled 반전
  it('EMA 체크박스 클릭 시 onChange 에서 ema.enabled 반전', () => {
    const onChange = vi.fn()
    const config = makeConfig({ ema: { enabled: false, fast: 12, slow: 26 } })
    render(<IndicatorPanel config={config} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('EMA 활성화'))

    const next = onChange.mock.calls[0]?.[0] as IndicatorConfig
    expect(next.ema.enabled).toBe(true)
    expect(next.ema.fast).toBe(12)
    expect(next.ema.slow).toBe(26)
  })

  // case 7: RSI period 입력 변경 → onChange 에서 period 업데이트
  it('RSI period 입력 변경 시 onChange 에서 rsi.period 업데이트', () => {
    const onChange = vi.fn()
    const config = makeConfig({ rsi: { enabled: true, period: 14 } })
    render(<IndicatorPanel config={config} onChange={onChange} />)

    const periodInput = screen.getByLabelText('기간')
    fireEvent.change(periodInput, { target: { value: '21' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0] as IndicatorConfig
    expect(next.rsi.period).toBe(21)
    expect(next.rsi.enabled).toBe(true)
  })

  // case 8: MACD 전체 파라미터 렌더 + onChange
  it('MACD enabled 시 fast/slow/signal 3개 입력 노출, signal 변경 → onChange', () => {
    const onChange = vi.fn()
    const config = makeConfig({
      macd: { enabled: true, fast: 12, slow: 26, signal: 9 },
    })
    render(<IndicatorPanel config={config} onChange={onChange} />)

    // 3개 입력 노출 확인 — id 기반
    const fastInput = document.getElementById('macd-fast')
    const slowInput = document.getElementById('macd-slow')
    const signalInput = document.getElementById('macd-signal')

    expect(fastInput).not.toBeNull()
    expect(slowInput).not.toBeNull()
    expect(signalInput).not.toBeNull()

    // signal 변경
    fireEvent.change(signalInput!, { target: { value: '5' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0] as IndicatorConfig
    expect(next.macd.signal).toBe(5)
    expect(next.macd.fast).toBe(12)
    expect(next.macd.slow).toBe(26)
  })
})
