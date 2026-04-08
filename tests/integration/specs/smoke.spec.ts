/**
 * スモークテスト
 *
 * 全ページが致命的エラーなしでロードされることを確認する。
 * 認証なし・認証ありの両方の状態でテスト。
 */

import { test, expect } from '@playwright/test';
import { collectErrors } from '../helpers/console-collector.js';
import { authenticateContext, openAuthenticated, openUnauthenticated } from '../helpers/auth.js';

test.describe('Smoke Tests - 未認証', () => {
  test('/ (Editor) がエラーなしでロードされる', async ({ page }) => {
    const errors = collectErrors(page);
    await openUnauthenticated(page, '/');

    // ARS ロゴが表示される
    await expect(page.locator('nav >> text=ARS')).toBeVisible();
    // Editor ページのコンテンツが存在する
    await expect(page.locator('[data-help-target="nodeCanvas"], .flex.flex-col.h-full')).toBeVisible();
    // 致命的エラーなし
    expect(errors).toEqual([]);
  });

  test('/settings がエラーなしでロードされる', async ({ page }) => {
    const errors = collectErrors(page);
    await openUnauthenticated(page, '/settings');

    // ナビゲーションバーが表示
    await expect(page.locator('nav >> text=ARS')).toBeVisible();
    // 未認証時はサインインプロンプト
    await expect(page.getByText('Sign in to manage project settings')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('/auth/callback が直接アクセスで / にリダイレクトされる', async ({ page }) => {
    await page.goto('http://localhost:15173/auth/callback');
    // ポップアップ外からのアクセスは / にリダイレクト
    await page.waitForURL('http://localhost:15173/');
    await expect(page.locator('nav >> text=ARS')).toBeVisible();
  });

  test('存在しないパスが index.html にフォールバックする (SPA)', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('http://localhost:15173/nonexistent-path', { waitUntil: 'networkidle' });

    // SPA フォールバックにより AppLayout がレンダリングされる
    await expect(page.locator('nav >> text=ARS')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Smoke Tests - 認証済み', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('/ (Editor) が認証済みでロードされる', async ({ page }) => {
    const errors = collectErrors(page);
    await openAuthenticated(page, '/');

    await expect(page.locator('nav >> text=ARS')).toBeVisible();
    // ユーザー名が表示される
    await expect(page.getByText('Test User')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('/settings が認証済みで Project Settings を表示する', async ({ page }) => {
    const errors = collectErrors(page);
    await openAuthenticated(page, '/settings');

    await expect(page.locator('nav >> text=ARS')).toBeVisible();
    // Settings ヘッダーが表示
    await expect(page.getByText('Project Settings')).toBeVisible();
    // プロジェクトセレクタが存在
    await expect(page.locator('select')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
