import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  use: {
    baseURL: 'http://localhost:3003',
    headless: true,
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { channel: 'chromium' } },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
})
