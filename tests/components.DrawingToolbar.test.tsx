/**
 * tests/components.DrawingToolbar.test.tsx
 *
 * DrawingToolbar 유닛 테스트 — 8 case
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DrawingToolbar } from '../src/components/DrawingToolbar'
import type { DrawingTool } from '../src/components/DrawingToolbar'

// @testing-library cleanup is automatic via vitest jsdom environment

describe('DrawingToolbar', () => {
  // case 1: 도구 5개 렌더 (커서, 추세선, 수평선, 삭제, 전체삭제)
  it('5개 버튼이 렌더된다', () => {
    const onToolChange = vi.fn()
    const onClearAll = vi.fn()

    render(
      <DrawingToolbar
        currentTool="cursor"
        onToolChange={onToolChange}
        onClearAll={onClearAll}
      />,
    )

    expect(screen.getByRole('button', { name: '커서' })).toBeDefined()
    expect(screen.getByRole('button', { name: '추세선' })).toBeDefined()
    expect(screen.getByRole('button', { name: '수평선' })).toBeDefined()
    expect(screen.getByRole('button', { name: '삭제' })).toBeDefined()
    expect(screen.getByRole('button', { name: '전체 삭제' })).toBeDefined()
  })

  // case 2: toolbar role 존재
  it('role=toolbar 요소가 렌더된다', () => {
    render(
      <DrawingToolbar
        currentTool="cursor"
        onToolChange={vi.fn()}
        onClearAll={vi.fn()}
      />,
    )
    expect(screen.getByRole('toolbar')).toBeDefined()
  })

  // case 3: 활성 도구 aria-pressed=true
  it('currentTool 버튼의 aria-pressed 가 true', () => {
    render(
      <DrawingToolbar
        currentTool="trendline"
        onToolChange={vi.fn()}
        onClearAll={vi.fn()}
      />,
    )
    const trendlineBtn = screen.getByRole('button', { name: '추세선' })
    expect(trendlineBtn.getAttribute('aria-pressed')).toBe('true')
  })

  // case 4: 비활성 도구 aria-pressed=false
  it('비활성 버튼의 aria-pressed 가 false', () => {
    render(
      <DrawingToolbar
        currentTool="cursor"
        onToolChange={vi.fn()}
        onClearAll={vi.fn()}
      />,
    )
    const horizontalBtn = screen.getByRole('button', { name: '수평선' })
    expect(horizontalBtn.getAttribute('aria-pressed')).toBe('false')
  })

  // case 5: 도구 버튼 클릭 → onToolChange 호출
  it('추세선 버튼 클릭 시 onToolChange("trendline") 호출', () => {
    const onToolChange = vi.fn()
    render(
      <DrawingToolbar
        currentTool="cursor"
        onToolChange={onToolChange}
        onClearAll={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '추세선' }))
    expect(onToolChange).toHaveBeenCalledWith('trendline')
    expect(onToolChange).toHaveBeenCalledTimes(1)
  })

  // case 6: 수평선 버튼 클릭 → onToolChange("horizontal")
  it('수평선 버튼 클릭 시 onToolChange("horizontal") 호출', () => {
    const onToolChange = vi.fn()
    render(
      <DrawingToolbar
        currentTool="cursor"
        onToolChange={onToolChange}
        onClearAll={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '수평선' }))
    expect(onToolChange).toHaveBeenCalledWith('horizontal')
  })

  // case 7: 삭제 버튼 클릭 → onToolChange("delete")
  it('삭제 버튼 클릭 시 onToolChange("delete") 호출', () => {
    const onToolChange = vi.fn()
    render(
      <DrawingToolbar
        currentTool="cursor"
        onToolChange={onToolChange}
        onClearAll={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(onToolChange).toHaveBeenCalledWith('delete')
  })

  // case 8: 전체 삭제 버튼 클릭 → onClearAll 호출
  it('전체 삭제 버튼 클릭 시 onClearAll 호출', () => {
    const onClearAll = vi.fn()
    render(
      <DrawingToolbar
        currentTool="cursor"
        onToolChange={vi.fn()}
        onClearAll={onClearAll}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '전체 삭제' }))
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })
})
