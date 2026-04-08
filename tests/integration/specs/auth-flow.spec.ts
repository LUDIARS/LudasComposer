/**
 * 認証フロー結合テスト
 *
 * OAuth ログイン・ログアウトのフロー全体を検証する。
 * Mock Cernere を介して GitHub OAuth をバイパスし、
 * Cookie/Token の設定・クリアが正しく行われることを確認する。
 *
 * フロー:
 *   未認証 → Sign In クリック → OAuth popup → Mock Cernere → callback → 認証済��
 *   認証済み → Logout クリック → 未認証
 */

import { test, expect } from '@playwright/test';
import { collectErrors } from '../helpers/console-collector.js';
import { authenticateContext, openAuthenticated, openUnauthenticated } from '../helpers/auth.js';

test.describe('認証フロー', () => {
  test('未認証状態で Sign In ボタンが表示される', async ({ page }) => {
    await openUnauthenticated(page, '/');

    // サインインボタンが表示される
    const signInButton = page.getByText(/Sign in/i);
    await expect(signInButton).toBeVisible();

    // ユーザー名は表示されない
    await expect(page.getByText('Test User')).not.toBeVisible();
  });

  test('認証済み状態でユーザー情報とログアウトボタンが表示される', async ({ context, page }) => {
    await authenticateContext(context);
    await openAuthenticated(page, '/');

    // ユーザー名が表示
    await expect(page.getByText('Test User')).toBeVisible();
    // ログアウトボタンが表示
    await expect(page.getByText(/Logout|ログアウト/i)).toBeVisible();
    // サインインボタンは非���示
    await expect(page.getByText(/Sign in with GitHub/i)).not.toBeVisible();
  });

  test('ログアウトで未認証状態に戻る', async ({ context, page }) => {
    const errors = collectErrors(page);
    await authenticateContext(context);
    await openAuthenticated(page, '/');

    // 認証済み確認
    await expect(page.getByText('Test User')).toBeVisible();

    // ログアウト
    const logoutButton = page.getByText(/Logout|ログアウト/i);
    await logoutButton.click();

    // ログアウト後、サインインボタンが表示される
    await expect(page.getByText(/Sign in/i)).toBeVisible({ timeout: 5000 });
    // ユーザー名は消える
    await expect(page.getByText('Test User')).not.toBeVisible();

    expect(errors).toEqual([]);
  });

  test('未認証で /settings アクセス → サインインプロンプト → 認証後に設定表示', async ({ context, page }) => {
    // 未認証でアクセス
    await openUnauthenticated(page, '/settings');
    await expect(page.getByText('Sign in to manage project settings')).toBeVisible();

    // 認証状態を注入してリロード
    await authenticateContext(context);
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'mock-access');
      localStorage.setItem('refreshToken', 'mock-refresh');
    });
    await page.reload({ waitUntil: 'networkidle' });

    // 認証後は Project Settings が表��
    await expect(page.getByText('Project Settings')).toBeVisible();
  });
});

test.describe('認証状態の永続性', () => {
  test('ページ遷移後も認証状態が維持される', async ({ context, page }) => {
    await authenticateContext(context);
    await openAuthenticated(page, '/');
    await expect(page.getByText('Test User')).toBeVisible();

    // /settings に遷移
    await page.locator('nav a', { hasText: 'Settings' }).click();
    await expect(page.getByText('Test User')).toBeVisible();

    // / に戻る
    await page.locator('nav a', { hasText: 'Editor' }).click();
    await expect(page.getByText('Test User')).toBeVisible();
  });

  test('リロード後も認証状態が維持される', async ({ context, page }) => {
    await authenticateContext(context);
    await openAuthenticated(page, '/');
    await expect(page.getByText('Test User')).toBeVisible();

    // リロー��
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('Test User')).toBeVisible();
  });
});
