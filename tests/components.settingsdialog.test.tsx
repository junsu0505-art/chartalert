/**
 * SettingsDialog 컴포넌트 테스트
 * R5b — tab 전환 + input 변경 + 저장 콜백 + 테스트 발송 6 case 이상
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsDialog } from '../src/components/SettingsDialog'

// ─── mock fetch ────────────────────────────────────────────────────────────

// sendTelegramMessage / sendDiscordMessage 내부에서 fetch 사용 → 전역 mock
const mockFetch = vi.fn()
global.fetch = mockFetch

// ─── shared props ──────────────────────────────────────────────────────────

function defaultProps(overrides: Partial<Parameters<typeof SettingsDialog>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    initialTelegram: null,
    initialDiscord: null,
    onSaveTelegram: vi.fn(),
    onSaveDiscord: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({}),
  })
})

// ─── tests ─────────────────────────────────────────────────────────────────

describe('SettingsDialog', () => {
  // case 1: open=false 시 렌더 안됨
  it('open=false 시 렌더되지 않는다', () => {
    render(<SettingsDialog {...defaultProps({ open: false })} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // case 2: open=true 시 모달 렌더
  it('open=true 시 dialog가 렌더된다', () => {
    render(<SettingsDialog {...defaultProps()} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  // case 3: 기본 탭 = Telegram
  it('기본 탭은 Telegram이다', () => {
    render(<SettingsDialog {...defaultProps()} />)
    expect(screen.getByLabelText('Bot Token')).toBeTruthy()
    expect(screen.getByLabelText('Chat ID')).toBeTruthy()
  })

  // case 4: Discord 탭 전환
  it('Discord 탭 클릭 시 Webhook URL 입력 필드가 표시된다', () => {
    render(<SettingsDialog {...defaultProps()} />)
    const discordTab = screen.getByRole('tab', { name: /Discord/ })
    fireEvent.click(discordTab)
    expect(screen.getByLabelText('Webhook URL')).toBeTruthy()
    // Telegram 입력 필드는 사라짐
    expect(screen.queryByLabelText('Bot Token')).toBeNull()
  })

  // case 5: 닫기 버튼 클릭 시 onClose 호출
  it('닫기 버튼 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn()
    render(<SettingsDialog {...defaultProps({ onClose })} />)
    fireEvent.click(screen.getByRole('button', { name: /닫기/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // case 6: Telegram 저장 콜백
  it('Telegram 저장 시 onSaveTelegram을 올바른 값으로 호출한다', () => {
    const onSaveTelegram = vi.fn()
    render(<SettingsDialog {...defaultProps({ onSaveTelegram })} />)

    fireEvent.change(screen.getByLabelText('Bot Token'), { target: { value: 'my-bot-token' } })
    fireEvent.change(screen.getByLabelText('Chat ID'), { target: { value: '-100123456' } })

    const saveBtn = screen.getByRole('button', { name: /^저장$/ })
    fireEvent.click(saveBtn)

    expect(onSaveTelegram).toHaveBeenCalledWith({ botToken: 'my-bot-token', chatId: '-100123456' })
    expect(onSaveTelegram).toHaveBeenCalledTimes(1)
  })

  // case 7: Discord 저장 콜백
  it('Discord 저장 시 onSaveDiscord를 올바른 값으로 호출한다', () => {
    const onSaveDiscord = vi.fn()
    render(<SettingsDialog {...defaultProps({ onSaveDiscord })} />)

    // Discord 탭으로 전환
    fireEvent.click(screen.getByRole('tab', { name: /Discord/ }))
    fireEvent.change(screen.getByLabelText('Webhook URL'), {
      target: { value: 'https://discord.com/api/webhooks/123/abc' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^저장$/ }))

    expect(onSaveDiscord).toHaveBeenCalledWith({ webhookUrl: 'https://discord.com/api/webhooks/123/abc' })
    expect(onSaveDiscord).toHaveBeenCalledTimes(1)
  })

  // case 8: Telegram 테스트 발송 성공
  it('Telegram 테스트 발송 성공 시 "발송 성공" 텍스트를 표시한다', async () => {
    render(<SettingsDialog {...defaultProps()} />)

    fireEvent.change(screen.getByLabelText('Bot Token'), { target: { value: 'token123' } })
    fireEvent.change(screen.getByLabelText('Chat ID'), { target: { value: '-999' } })

    mockFetch.mockResolvedValueOnce({ status: 200, ok: true })

    fireEvent.click(screen.getByRole('button', { name: /테스트 발송/ }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy()
      expect(screen.getByText('발송 성공')).toBeTruthy()
    })
  })

  // case 9: Telegram 테스트 발송 실패 (fetch 오류)
  it('Telegram 테스트 발송 실패 시 오류 텍스트를 표시한다', async () => {
    render(<SettingsDialog {...defaultProps()} />)

    fireEvent.change(screen.getByLabelText('Bot Token'), { target: { value: 'bad-token' } })
    fireEvent.change(screen.getByLabelText('Chat ID'), { target: { value: '-999' } })

    mockFetch.mockResolvedValueOnce({ status: 401, ok: false })

    fireEvent.click(screen.getByRole('button', { name: /테스트 발송/ }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy()
      expect(screen.getByText(/오류/)).toBeTruthy()
    })
  })

  // case 10: Discord 테스트 발송 성공
  it('Discord 테스트 발송 성공 시 "발송 성공" 텍스트를 표시한다', async () => {
    render(<SettingsDialog {...defaultProps()} />)

    fireEvent.click(screen.getByRole('tab', { name: /Discord/ }))
    fireEvent.change(screen.getByLabelText('Webhook URL'), {
      target: { value: 'https://discord.com/api/webhooks/123/abc' },
    })

    mockFetch.mockResolvedValueOnce({ status: 204, ok: true })

    fireEvent.click(screen.getByRole('button', { name: /테스트 발송/ }))

    await waitFor(() => {
      expect(screen.getByText('발송 성공')).toBeTruthy()
    })
  })

  // case 11: botToken 없으면 저장 버튼 비활성화
  it('botToken이 없으면 Telegram 저장 버튼이 비활성화된다', () => {
    render(<SettingsDialog {...defaultProps()} />)
    // chatId만 입력
    fireEvent.change(screen.getByLabelText('Chat ID'), { target: { value: '-999' } })
    const saveBtn = screen.getByRole('button', { name: /^저장$/ })
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true)
  })

  // case 12: initialTelegram 값 초기화
  it('initialTelegram이 있으면 입력 필드에 초기값이 설정된다', () => {
    render(
      <SettingsDialog
        {...defaultProps({ initialTelegram: { botToken: 'existing-token', chatId: '12345' } })}
      />,
    )
    // password type 이므로 value 속성으로 확인
    const tokenInput = screen.getByLabelText('Bot Token') as HTMLInputElement
    expect(tokenInput.value).toBe('existing-token')
    const chatInput = screen.getByLabelText('Chat ID') as HTMLInputElement
    expect(chatInput.value).toBe('12345')
  })

  // case 13: botToken/webhookUrl 입력 필드는 password type (UP-16)
  it('Bot Token 입력 필드는 password type이다 (UP-16)', () => {
    render(<SettingsDialog {...defaultProps()} />)
    const input = screen.getByLabelText('Bot Token') as HTMLInputElement
    expect(input.type).toBe('password')
  })

  it('Webhook URL 입력 필드는 password type이다 (UP-16)', () => {
    render(<SettingsDialog {...defaultProps()} />)
    fireEvent.click(screen.getByRole('tab', { name: /Discord/ }))
    const input = screen.getByLabelText('Webhook URL') as HTMLInputElement
    expect(input.type).toBe('password')
  })
})
