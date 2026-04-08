/**
 * コンソールエラー収集ヘルパー
 *
 * ページのコンソールエラーとネットワークエラーを収集し、
 * テスト終了時にエラーがないことを検証する。
 */

import type { Page, ConsoleMessage } from '@playwright/test';

export interface CollectedError {
  type: 'console' | 'network';
  message: string;
}

/**
 * ページのエラーを収集するリスナーを登録
 */
export function collectErrors(page: Page): CollectedError[] {
  const errors: CollectedError[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // ネットワーク系の想定内エラーは除外
      if (isExpectedError(text)) return;
      errors.push({ type: 'console', message: text });
    }
  });

  page.on('pageerror', (err: Error) => {
    errors.push({ type: 'console', message: err.message });
  });

  return errors;
}

/**
 * テストで想定されるエラー（無視してよいもの）
 */
function isExpectedError(message: string): boolean {
  const expectedPatterns = [
    // Mock Cernere が返す 401 (未認証テスト時)
    /Failed to load resource.*401/,
    // Setup API が存在しないため 404
    /api\/setup\/status.*404/,
    /Failed to load resource.*404/,
    // favicon が存在しない場合
    /favicon\.ico/,
    // 開発時のHMR関連
    /\[vite\]/,
  ];
  return expectedPatterns.some((p) => p.test(message));
}
