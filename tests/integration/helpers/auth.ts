/**
 * 認証バイパスヘルパー
 *
 * Playwright テストで認証状態を注入するためのユーティリティ。
 *
 * 認証バイパス方式:
 * 1. ars_session Cookie をブラウザコンテキストに注入
 *    → バックエンドが Mock Cernere に転送 → モックユーザーが返る
 * 2. localStorage に accessToken/refreshToken を注入
 *    → フロントエンドの fetchJson が Bearer トークンとして送信
 */

import type { BrowserContext, Page } from '@playwright/test';
import { TEST_SESSION_TOKEN } from '../mock-cernere/data.js';

const BASE_URL = 'http://localhost:15173';

/**
 * 認証済み状態の Cookie + localStorage をセットアップ
 */
export async function authenticateContext(context: BrowserContext): Promise<void> {
  // ars_session Cookie を注入
  await context.addCookies([
    {
      name: 'ars_session',
      value: TEST_SESSION_TOKEN,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * ページに localStorage トークンを注入
 * (ページが既に navigate 済みの状態で呼ぶ)
 */
export async function injectTokens(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'mock-access');
    localStorage.setItem('refreshToken', 'mock-refresh');
  });
}

/**
 * 認証済み状態でページを開く
 */
export async function openAuthenticated(
  page: Page,
  path: string = '/',
): Promise<void> {
  // まず Cookie を設定するために一度アクセス
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  // localStorage にトークンを注入
  await injectTokens(page);
  // リロードして認証状態を反映
  await page.reload({ waitUntil: 'networkidle' });
}

/**
 * 未認証状態でページを開く (Cookie なし)
 */
export async function openUnauthenticated(
  page: Page,
  path: string = '/',
): Promise<void> {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
}
