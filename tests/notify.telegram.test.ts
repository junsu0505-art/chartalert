import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { sendTelegramMessage } from '../src/notify/telegram'
import type { TelegramConfig } from '../src/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CFG: TelegramConfig = {
  botToken: 'test_bot_token_123',
  chatId: '987654321',
}

function makeFetchMock(status: number, body: unknown = { ok: true }): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Test Cases
// ---------------------------------------------------------------------------

describe('sendTelegramMessage', () => {
  // Case 1: 정상 전송 (200) → { ok: true, status: 200 }
  it('Case 1: 200 OK → { ok: true, status: 200 }', async () => {
    vi.stubGlobal('fetch', makeFetchMock(200, { ok: true, result: { message_id: 1 } }))

    const result = await sendTelegramMessage(VALID_CFG, 'Hello Telegram!')

    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.error).toBeUndefined()
  })

  // Case 2: missing_token → { ok: false, error: 'missing_token' } (fetch 미호출)
  it('Case 2: botToken 빈 문자열 → { ok: false, error: "missing_token" }, fetch 미호출', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await sendTelegramMessage({ botToken: '', chatId: '12345' }, 'should not send')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('missing_token')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // Case 3: missing_chat_id → { ok: false, error: 'missing_chat_id' } (fetch 미호출)
  it('Case 3: chatId 빈 문자열 → { ok: false, error: "missing_chat_id" }, fetch 미호출', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await sendTelegramMessage(
      { botToken: 'valid_token', chatId: '' },
      'should not send',
    )

    expect(result.ok).toBe(false)
    expect(result.error).toBe('missing_chat_id')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // Case 4: 401 invalid token → { ok: false, status: 401, error: 'http_401' }
  it('Case 4: 401 Unauthorized → { ok: false, status: 401, error: "http_401" }', async () => {
    vi.stubGlobal('fetch', makeFetchMock(401, { ok: false, description: 'Unauthorized' }))

    const result = await sendTelegramMessage(VALID_CFG, 'test')

    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
    expect(result.error).toBe('http_401')
  })

  // Case 5: 429 rate limit → { ok: false, status: 429, error: 'http_429' }, fetch 1회
  it('Case 5: 429 rate limit → { ok: false, status: 429 }, 자동 재시도 없음', async () => {
    const fetchMock = makeFetchMock(429, {
      ok: false,
      description: 'Too Many Requests: retry after 30',
      parameters: { retry_after: 30 },
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendTelegramMessage(VALID_CFG, 'rate limit test')

    expect(result.ok).toBe(false)
    expect(result.status).toBe(429)
    expect(result.error).toBe('http_429')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // Case 6: network_error (fetch reject) → { ok: false, error: 'network_error: ...' }
  it('Case 6: fetch network reject → { ok: false, error starts with "network_error" }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to connect')))

    const result = await sendTelegramMessage(VALID_CFG, 'network test')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/^network_error:/)
  })

  // Case 7: 4096+ 글자 text → truncate, 마지막 3자 "..."
  it('Case 7: 4096+ 글자 text → 4096자로 truncate (마지막 3자 "...")', async () => {
    const fetchMock = makeFetchMock(200)
    vi.stubGlobal('fetch', fetchMock)

    const longText = 'A'.repeat(5000)

    await sendTelegramMessage(VALID_CFG, longText)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const callArgs = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ]
    const body = JSON.parse(callArgs[1].body as string) as { text: string }

    expect(body.text.length).toBe(4096)
    expect(body.text.endsWith('...')).toBe(true)
    expect(body.text.startsWith('A')).toBe(true)
  })
})
