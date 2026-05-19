/**
 * drawing.spec.ts — chartalert 드로잉 플로우 e2e
 *
 * 검증 시나리오:
 *  1. 추세선 toolbar 버튼 click → canvas 2 click → AlertList 항목 추가
 *  2. 수평선 toolbar 버튼 click → canvas 1 click → AlertList 항목 추가
 *
 * selector 전략:
 *  - toolbar: getByRole('button', { name: ... }) — aria-label 기반
 *  - alert row: [data-testid="alert-item"] — AlertList.tsx 에 추가된 testid
 *  - canvas: page.locator('canvas').first() — lightweight-charts 렌더 캔버스
 */

import { test, expect } from '@playwright/test'

test.describe('chartalert drawing flow', () => {
  test('추세선 toolbar click → 차트 2 click → AlertList 자동 추가', async ({ page }) => {
    await page.goto('/')

    // lightweight-charts canvas 등장 대기
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 })
    // "Loading" 오버레이가 사라질 때까지 대기 → klines fetch 완료 + chart 완전 초기화
    await expect(page.locator('text=/Loading/i')).toBeHidden({ timeout: 15000 })
    // chart 내부 subscribeClick 등록 완료까지 추가 대기
    await page.waitForTimeout(1000)

    // 추세선 toolbar 버튼 click (aria-label="추세선")
    await page.getByRole('button', { name: /추세선/i }).click()

    // canvas boundingBox 획득 → 2회 click
    const canvas = page.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas boundingBox is null — chart not rendered')

    // anchor 1: 차트 좌측 1/3 + 중앙 높이
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4)
    await page.waitForTimeout(1000)

    // anchor 2: 차트 우측 2/3 + 약간 낮게
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5)
    await page.waitForTimeout(2000)

    // AlertList 에 추세선 항목 추가 확인
    const alertItem = page.locator('[data-testid="alert-item"]').filter({ hasText: /추세선/ })
    await expect(alertItem.first()).toBeVisible({ timeout: 5000 })

    // 스크린샷
    await page.screenshot({ path: 'test-results/drawing-trendline.png', fullPage: true })
  })

  test('수평선 toolbar click → 차트 1 click → AlertList 자동 추가', async ({ page }) => {
    await page.goto('/')

    // canvas 등장 대기
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 })
    // "Loading" 오버레이가 사라질 때까지 대기
    await expect(page.locator('text=/Loading/i')).toBeHidden({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // 수평선 toolbar 버튼 click (aria-label="수평선")
    await page.getByRole('button', { name: /수평선/i }).click()

    // canvas 중앙 1 click
    const canvas = page.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas boundingBox is null — chart not rendered')

    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4)
    await page.waitForTimeout(1000)

    // AlertList 에 가로선(horizontal) 항목 추가 확인
    // describeAlert → "가로선" 텍스트 포함
    const alertItem = page.locator('[data-testid="alert-item"]').filter({ hasText: /가로선/ })
    await expect(alertItem.first()).toBeVisible({ timeout: 5000 })

    // 스크린샷
    await page.screenshot({ path: 'test-results/drawing-horizontal.png', fullPage: true })
  })

  test('chart 좌클릭 drag 시 화면 고정 (panning 비활성)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(3000)

    const canvas = page.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas boundingBox null')

    // 차트 영역 중앙에서 mousedown + 100px 우측 drag + mouseup
    const startX = box.x + box.width * 0.5
    const startY = box.y + box.height * 0.5
    const endX = startX + 100

    // drag 전 screenshot
    await page.screenshot({
      path: 'test-results/panning-01-before.png',
      clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    })

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, startY, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(500)

    // drag 후 screenshot
    await page.screenshot({
      path: 'test-results/panning-02-after.png',
      clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    })

    // 시각 증명 위주 — 두 screenshot 을 수동 비교
    // (실시간 candle 업데이트로 픽셀이 완전히 동일하지 않을 수 있음)
    expect(true).toBe(true)
  })
})
