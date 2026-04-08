/**
 * 設定ページ結合テスト
 *
 * Project Settings ページの各タブコンテンツと
 * 認証ガードの動作を検証する。
 */

import { test, expect } from '@playwright/test';
import { collectErrors } from '../helpers/console-collector.js';
import { authenticateContext, openAuthenticated, openUnauthenticated } from '../helpers/auth.js';

test.describe('Settings - 認証ガード', () => {
  test('未認証ではサインインプロンプトのみ表示', async ({ page }) => {
    const errors = collectErrors(page);
    await openUnauthenticated(page, '/settings');

    await expect(page.getByText('Sign in to manage project settings')).toBeVisible();
    // タブやフォームは表示さ��ない
    await expect(page.getByText('Save Method')).not.toBeVisible();
    await expect(page.getByText('Project Members')).not.toBeVisible();
    expect(errors).toEqual([]);
  });

  test('認証済みでは Project Settings UI が表示', async ({ context, page }) => {
    const errors = collectErrors(page);
    await authenticateContext(context);
    await openAuthenticated(page, '/settings');

    await expect(page.getByText('Project Settings')).toBeVisible();
    // プロジェクトセレクタ
    await expect(page.locator('select')).toBeVisible();
    // Save Settings ボタン
    await expect(page.getByRole('button', { name: 'Save Settings' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Settings - General タブ', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('Save Method の3オプションが表示される', async ({ page }) => {
    const errors = collectErrors(page);
    await openAuthenticated(page, '/settings');

    // プロジェクトを選択
    await page.locator('select').selectOption({ label: 'Test Project' });
    await expect(page.getByText('Save Method')).toBeVisible();

    // 3つの保存方法
    await expect(page.getByText('Local')).toBeVisible();
    await expect(page.getByText('Cloud')).toBeVisible();
    await expect(page.getByText('Git')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Save Method ラジオボタンが切り替えられる', async ({ page }) => {
    await openAuthenticated(page, '/settings');
    await page.locator('select').selectOption({ label: 'Test Project' });

    // Cloud を選択
    const cloudLabel = page.locator('label', { hasText: 'Cloud' });
    await cloudLabel.click();
    const cloudRadio = cloudLabel.locator('input[type="radio"]');
    await expect(cloudRadio).toBeChecked();

    // Git を選択
    const gitLabel = page.locator('label', { hasText: 'Git' });
    await gitLabel.click();
    const gitRadio = gitLabel.locator('input[type="radio"]');
    await expect(gitRadio).toBeChecked();

    // Cloud は非選択に
    await expect(cloudRadio).not.toBeChecked();
  });
});

test.describe('Settings - Members タブ', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('メンバー追加フォームが表示される', async ({ page }) => {
    const errors = collectErrors(page);
    await openAuthenticated(page, '/settings');
    await page.locator('select').selectOption({ label: 'Test Project' });

    await page.getByRole('button', { name: 'Members' }).click();
    await expect(page.getByText('Project Members')).toBeVisible();

    // 追加フォーム
    await expect(page.getByPlaceholder('GitHub username...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('メンバーを追加・削除できる', async ({ page }) => {
    await openAuthenticated(page, '/settings');
    await page.locator('select').selectOption({ label: 'Test Project' });
    await page.getByRole('button', { name: 'Members' }).click();

    // メンバー��加
    await page.getByPlaceholder('GitHub username...').fill('new-member');
    await page.getByRole('button', { name: 'Add' }).click();

    // 追加されたメンバーが表示
    await expect(page.getByText('new-member')).toBeVisible();

    // メンバー削除
    const removeButton = page.locator('button', { hasText: 'x' });
    await removeButton.click();
    await expect(page.getByText('new-member')).not.toBeVisible();
  });
});

test.describe('Settings - Google Drive タブ', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('Google Drive 設定フォームが表示される', async ({ page }) => {
    const errors = collectErrors(page);
    await openAuthenticated(page, '/settings');
    await page.locator('select').selectOption({ label: 'Test Project' });

    await page.getByRole('button', { name: 'Google Drive' }).click();
    await expect(page.getByText('Google Drive Integration')).toBeVisible();

    // Enable トグル
    await expect(page.getByText('Enable Google Drive')).toBeVisible();
    // 入力フィールド
    await expect(page.getByText('Folder ID')).toBeVisible();
    await expect(page.getByText('Folder Name')).toBeVisible();
    await expect(page.getByText('Auto-sync resources')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Settings - Resource Depot タブ', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('Resource Depot 設定フォー��が表示される', async ({ page }) => {
    const errors = collectErrors(page);
    await openAuthenticated(page, '/settings');
    await page.locator('select').selectOption({ label: 'Test Project' });

    await page.getByRole('button', { name: 'Resource Depot' }).click();
    await expect(page.getByText('Resource Depot Connection')).toBeVisible();

    // Enable トグル
    await expect(page.getByText('Enable Resource Depot')).toBeVisible();
    // 入力フィールド
    await expect(page.getByText('Depot URL')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
