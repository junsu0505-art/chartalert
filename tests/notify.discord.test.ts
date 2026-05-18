import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendDiscordMessage } from '../src/notify/discord'
import type { DiscordConfig } from '../src/types'

const VALID_WEBHOOK = 'https://discord.com/api/webhooks/1234567890/abcdefghijklmnop'

function mockFetch(status: number, body: string = ''): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      text: async () => body,
    })
  )
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('sendDiscordMessage', () => {
  // Case 1: 성공 (204 No Content)
  it('returns ok:true on 204 response', async () => {
    mockFetch(204)
    const cfg: DiscordConfig = { webhookUrl: VALID_WEBHOOK }
    const result = await sendDiscordMessage(cfg, 'Hello Discord!')
    expect(result.ok).toBe(true)
    expect(result.status).toBe(204)
    expect(result.error).toBeUndefined()
  })

  // Case 2: missing_webhook_url — 빈 문자열
  it('returns missing_webhook_url when webhookUrl is empty', async () => {
    const cfg: DiscordConfig = { webhookUrl: '' }
    const result = await sendDiscordMessage(cfg, 'test')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('missing_webhook_url')
    // fetch 호출 없음
    expect(vi.isMockFunction(global.fetch)).toBe(false)
  })

  // Case 3: invalid_webhook_url — 다른 도메인 차단
  it('returns invalid_webhook_url for non-discord domain', async () => {
    const cfg: DiscordConfig = { webhookUrl: 'https://evil.com/webhooks/123/abc' }
    const result = await sendDiscordMessage(cfg, 'test')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('invalid_webhook_url')
  })

  // Case 3b: invalid_webhook_url — 파싱 불가 URL
  it('returns invalid_webhook_url for malformed URL', async () => {
    const cfg: DiscordConfig = { webhookUrl: 'not-a-url' }
    const result = await sendDiscordMessage(cfg, 'test')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('invalid_webhook_url')
  })

  // Case 4: http_429 (rate limit)
  it('returns http_429 on rate limit response', async () => {
    mockFetch(429)
    const cfg: DiscordConfig = { webhookUrl: VALID_WEBHOOK }
    const result = await sendDiscordMessage(cfg, 'test')
    expect(result.ok).toBe(false)
    expect(result.status).toBe(429)
    expect(result.error).toBe('http_429')
  })

  // Case 5: network_error — fetch throws
  it('returns network_error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))
    const cfg: DiscordConfig = { webhookUrl: VALID_WEBHOOK }
    const result = await sendDiscordMessage(cfg, 'test')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/^network_error: connection refused/)
  })

  // Case 6: 2000+ 글자 truncate
  it('truncates text longer than 2000 chars', async () => {
    mockFetch(204)
    const cfg: DiscordConfig = { webhookUrl: VALID_WEBHOOK }
    const longText = 'A'.repeat(2100)
    await sendDiscordMessage(cfg, longText)

    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>)
    const callBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      content: string
    }
    expect(callBody.content.length).toBe(2000)
    expect(callBody.content.endsWith('...')).toBe(true)
  })

  // Case 7: username 옵션 전달 확인
  it('includes username in payload when provided', async () => {
    mockFetch(200)
    const cfg: DiscordConfig = { webhookUrl: VALID_WEBHOOK }
    await sendDiscordMessage(cfg, 'hello', { username: 'chartalert' })

    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>)
    const callBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      username?: string
    }
    expect(callBody.username).toBe('chartalert')
  })

  // Case 8: discordapp.com 도메인도 허용
  it('accepts discordapp.com webhook domain', async () => {
    mockFetch(204)
    const cfg: DiscordConfig = {
      webhookUrl: 'https://discordapp.com/api/webhooks/999/xyz',
    }
    const result = await sendDiscordMessage(cfg, 'test')
    expect(result.ok).toBe(true)
  })
})
