import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Ars 結合テスト - Playwright 設定
 *
 * テストは以下のサーバーを起動して実行する:
 * 1. Mock Cernere (port 18080) - 認証バイパス用モックサーバー
 * 2. Ars Web Server (port 15173) - CERNERE_URL をモックに向けて起動
 */

const ext = process.platform === 'win32' ? '.exe' : '';
const serverBin = path.resolve(
  __dirname,
  '../../ars-editor/src-tauri/target/debug',
  `ars-web-server${ext}`,
);
const distDir = path.resolve(__dirname, '../../ars-editor/dist');

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
        ?? `"${serverBin}" "${distDir}" 15173`,
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
