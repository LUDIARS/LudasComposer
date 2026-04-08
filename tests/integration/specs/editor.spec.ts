/**
 * エディタページ結合テスト
 *
 * エディタページの主要コンポーネントが正しく描画されることを確認する。
 * ツールバー、キャンバス、パネルの表示を検証する。
 */

import { test, expect } from '@playwright/test';
import { collectErrors } from '../helpers/console-collector.js';
import { openUnauthenticated } from '../helpers/auth.js';

test.describe('Editor ページ', () => {
  test('ツールバーが表示される', async ({ page }) => {
    const errors = collectErrors(page);
    await openUnauthenticated(page, '/');

    // Toolbar コンポーネントの存在確認
    // Toolbar は EditorPage の最初の子要素
    const toolbar = page.locator('[data-help-target="nodeCanvas"]').locator('..');
    await expect(toolbar).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('ノードキャンバスが表示される', async ({ page }) => {
    const errors = collectErrors(page);
    await openUnauthenticated(page, '/');

    // NodeCanvas または DomainDiagramCanvas のいずれかが表示
    const canvas = page.locator('[data-help-target="nodeCanvas"]');
    await expect(canvas).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('シーンマネージャパネルが表示される', async ({ page }) => {
    const errors = collectErrors(page);
    await openUnauthenticated(page, '/');

    // SceneList パネル（デフォルトで表示）
    const scenePanel = page.locator('[data-help-target="sceneList"]');
    await expect(scenePanel).toBeVisible();

    // "New Component" ボタンが存在
    await expect(page.getByText('+ New Component')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('レイアウト全体が画面いっぱいに表示される', async ({ page }) => {
    const errors = collectErrors(page);
    await openUnauthenticated(page, '/');

    // メインコンテナが画面サイズ
    const main = page.locator('.flex.flex-col.h-screen.w-screen');
    await expect(main).toBeVisible();

    // ナビゲーションバーが上部に存在
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    expect(navBox!.y).toBeLessThan(50);

    expect(errors).toEqual([]);
  });
});
