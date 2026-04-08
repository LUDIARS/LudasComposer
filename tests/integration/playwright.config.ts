import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Ars 結合テスト - Playwright 設定
 *
 * テストは以下のサーバーを起動して実行する:
 * 1. Mock Cernere (port 18080) - 認証バイパス用モックサーバー
 * 2. Ars Web Server (port 15173) - CERNERE_URL をモックに向けて起動
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const startServerScript = path.resolve(__dirname, 'start-server.mjs');

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:15173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'npx tsx mock-cernere/server.ts',
      port: 18080,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: process.env.ARS_SERVER_CMD
        ?? `node ${startServerScript} 15173`,
      port: 15173,
      reuseExistingServer: !process.env.CI,
      env: {
        CERNERE_URL: 'http://localhost:18080',
      },
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60_000,
    },
  ],
});
