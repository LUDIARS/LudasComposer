/**
 * バックエンド API エンドポイント結合テスト
 *
 * Playwright の request context を使って API エンドポイントを直接テスト。
 * 認証が必要なエンドポイントは ars_session Cookie を付与して呼び出す。
 */

import { test, expect } from '@playwright/test';
import { TEST_SESSION_TOKEN } from '../mock-cernere/data.js';

const BASE = 'http://localhost:15173';

function authHeaders(): Record<string, string> {
  return {
    Cookie: `ars_session=${TEST_SESSION_TOKEN}`,
  };
}

test.describe('API - ローカルプロジェクト', () => {
  test('GET /api/project/default-path がパスを返す', async ({ request }) => {
    const res = await request.get(`${BASE}/api/project/default-path`);
    expect(res.status()).toBe(200);
    const path = await res.json();
    expect(typeof path).toBe('string');
    expect(path.length).toBeGreaterThan(0);
  });

  test('GET /api/project/list がリストを返す', async ({ request }) => {
    const res = await request.get(`${BASE}/api/project/list`);
    expect(res.status()).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
  });

  test('POST /api/project/save + GET /api/project/load のラウンドトリップ', async ({ request }) => {
    // デフォルトパスを取得
    const pathRes = await request.get(`${BASE}/api/project/default-path`);
    const defaultPath = await pathRes.json();
    const savePath = `${defaultPath}/integration-test-project.json`;

    const project = {
      name: 'Integration Test',
      scenes: {},
      components: {},
      activeSceneId: null,
    };

    // 保存
    const saveRes = await request.post(`${BASE}/api/project/save`, {
      data: { path: savePath, project },
    });
    expect(saveRes.status()).toBe(200);

    // 読み込み
    const loadRes = await request.get(
      `${BASE}/api/project/load?path=${encodeURIComponent(savePath)}`,
    );
    expect(loadRes.status()).toBe(200);
    const loaded = await loadRes.json();
    expect(loaded.name).toBe('Integration Test');
  });
});

test.describe('API - 認証', () => {
  test('GET /auth/me が未認証で 401 を返す', async ({ request }) => {
    const res = await request.get(`${BASE}/auth/me`);
    expect(res.status()).toBe(401);
  });

  test('GET /auth/me が認証済みでユーザー情報を返す', async ({ request }) => {
    const res = await request.get(`${BASE}/auth/me`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const user = await res.json();
    expect(user.login).toBe('test-user');
    expect(user.displayName).toBe('Test User');
  });

  test('GET /auth/github/login がリダイレクトを返す', async ({ request }) => {
    const res = await request.get(`${BASE}/auth/github/login`, {
      maxRedirects: 0,
    });
    // 302 リダイレクト
    expect([301, 302, 307, 308]).toContain(res.status());
  });

  test('POST /auth/logout が成功する', async ({ request }) => {
    const res = await request.post(`${BASE}/auth/logout`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
  });
});

test.describe('API - クラウドプロジェクト (認証必須)', () => {
  test('GET /api/cloud/project/list が未認証で 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/cloud/project/list`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/cloud/project/list が認証済みでリストを返す', async ({ request }) => {
    const res = await request.get(`${BASE}/api/cloud/project/list`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
  });
});

test.describe('API - モジュール管理 (認証必須)', () => {
  test('GET /api/modules が未認証で 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/modules`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/modules が認証済みでリストを返す', async ({ request }) => {
    const res = await request.get(`${BASE}/api/modules`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const modules = await res.json();
    expect(Array.isArray(modules)).toBe(true);
  });
});

test.describe('API - WebSocket', () => {
  test('GET /ws/collab が WebSocket upgrade に応答する', async ({ request }) => {
    // 通常のHTTPリクエストではWebSocketハンドシェイクは完了しないが
    // エンドポイントが存在し 4xx 系でないことを確認
    const res = await request.get(`${BASE}/ws/collab`, {
      headers: {
        Upgrade: 'websocket',
        Connection: 'Upgrade',
      },
    });
    // WebSocket upgrade の場合、通常リクエストでは 400 or UpgradeRequired
    // エンドポイントが存在すること（404 でない）を確認
    expect(res.status()).not.toBe(404);
  });
});
