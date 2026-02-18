import { defineConfig, devices } from '@playwright/test'

// Ensure Chromium can find extracted system libraries (installed without root)
const userLibPath =
  '/home/node/.local/lib/aarch64-linux-gnu:/home/node/.local/usr/lib/aarch64-linux-gnu'
process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
  ? `${userLibPath}:${process.env.LD_LIBRARY_PATH}`
  : userLibPath

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
          executablePath:
            '/home/node/.cache/ms-playwright/chromium-1208/chrome-linux/chrome',
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
