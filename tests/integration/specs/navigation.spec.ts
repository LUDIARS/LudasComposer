/**
 * ナビゲーション結合テスト
 *
 * SPA の全遷移パターンを辿り、各ページが正しく描画されることを確認する。
 *
 * 遷移マップ:
 *   / (Editor) ←→ /settings (Settings)
 *   / (Editor)  → /auth/callback → / (redirect)
 *   /settings   → / (Editor)
 *   /settings tabs: General ↔ Members ↔ Google Drive ↔ Resource Depot
 */

import { test, expect } from '@playwright/test';
import { collectErrors } from '../helpers/console-collector.js';
import { authenticateContext, openAuthenticated, openUnauthenticated } from '../helpers/auth.js';

test.describe('ナビゲーション - 未認証', () => {
  test('/ → /settings → / の往復遷移', async ({ page }) => {
    const errors = collectErrors(page);
    await openUnauthenticated(page, '/');

    // Editor ページ確認
    await expect(page.locator('nav >> text=ARS')).toBeVisible();
    const editorLink = page.locator('nav a', { hasText: 'Editor' });
    const settingsLink = page.locator('nav a', { hasText: 'Settings' });

    // / → /settings
    await settingsLink.click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText('Sign in to manage project settings')).toBeVisible();

    // /settings → /
    await editorLink.click();
    await expect(page).toHaveURL(/\/$/);
    // Editor コンテンツが再描画される
    await expect(page.locator('[data-help-target="nodeCanvas"], .flex.flex-col.h-full')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('ナビゲーションリンクのアクティブ状態が正しく切り替わる', async ({ page }) => {
    await openUnauthenticated(page, '/');

    const editorLink = page.locator('nav a', { hasText: 'Editor' });
    const settingsLink = page.locator('nav a', { hasText: 'Settings' });

    // / ではEditorがアクティブ
    await expect(editorLink).toHaveClass(/bg-zinc-800/);
    await expect(settingsLink).not.toHaveClass(/bg-zinc-800/);

    // /settings に遷移
    await settingsLink.click();
    await expect(page).toHaveURL(/\/settings/);

    // Settings がアクティブ
    await expect(settingsLink).toHaveClass(/bg-zinc-800/);
    await expect(editorLink).not.toHaveClass(/bg-zinc-800/);
  });
});

test.describe('ナビゲーション - 認証済み', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('/ → /settings → / の往復 (認証済み)', async ({ page }) => {
    const errors = collectErrors(page);
    await openAuthenticated(page, '/');

    // 認証済みユーザーが表示
    await expect(page.getByText('Test User')).toBeVisible();

    // /settings に遷移
    await page.locator('nav a', { hasText: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings/);
    // 認証済みなので Project Settings が表示
    await expect(page.getByText('Project Settings')).toBeVisible();

    // / に戻る
    await page.locator('nav a', { hasText: 'Editor' }).click();
    await expect(page).toHaveURL(/\/$/);
    // Editor が再描画
    await expect(page.locator('[data-help-target="nodeCanvas"], .flex.flex-col.h-full')).toBeVisible();
    // 認証状態が維持されている
    await expect(page.getByText('Test User')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('Settings タブ間遷移: General → Members → Google Drive → Resource Depot', async ({ page }) => {
    const errors = collectErrors(page);
    await openAuthenticated(page, '/settings');

    // プロジェクトを選択（モックの Test Project）
    const selector = page.locator('select');
    await selector.selectOption({ label: 'Test Project' });

    // General タブ (デフォルト)
    await expect(page.getByText('Save Method')).toBeVisible();

    // Members タブ
    await page.getByRole('button', { name: 'Members' }).click();
    await expect(page.getByText('Project Members')).toBeVisible();

    // Google Drive タブ
    await page.getByRole('button', { name: 'Google Drive' }).click();
    await expect(page.getByText('Google Drive Integration')).toBeVisible();

    // Resource Depot タブ
    await page.getByRole('button', { name: 'Resource Depot' }).click();
    await expect(page.getByText('Resource Depot Connection')).toBeVisible();

    // General に戻る
    await page.getByRole('button', { name: 'General' }).click();
    await expect(page.getByText('Save Method')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('高速な連続遷移でも安定する', async ({ page }) => {
    const errors = collectErrors(page);
    await openAuthenticated(page, '/');

    const editorLink = page.locator('nav a', { hasText: 'Editor' });
    const settingsLink = page.locator('nav a', { hasText: 'Settings' });

    // 素早く5回往復
    for (let i = 0; i < 5; i++) {
      await settingsLink.click();
      await editorLink.click();
    }

    // 最終的に Editor ページにいる
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('nav >> text=ARS')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('ナビゲーション - ブラウザ履歴', () => {
  test('ブラウザの戻る・進むが SPA 遷移と整合する', async ({ page }) => {
    await openUnauthenticated(page, '/');

    // / → /settings
    await page.locator('nav a', { hasText: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings/);

    // ブラウザの「戻る」
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);

    // ブラウザの「進む」
    await page.goForward();
    await expect(page).toHaveURL(/\/settings/);
  });
});
