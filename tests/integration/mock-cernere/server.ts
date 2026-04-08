/**
 * Mock Cernere サーバー
 *
 * 結合テスト用の認証バイパスサーバー。
 * 実際の Cernere サーバーのAPIを模倣し、テスト用のモックデータを返す。
 *
 * バイパス方式:
 * - OAuth フロー: GitHub連携なしでトークンを直接発行
 * - セッション検証: ars_session Cookie の存在のみ確認
 * - プロジェクトAPI: インメモリストレージ
 */

import express from 'express';
import {
  TEST_SESSION_TOKEN,
  TEST_USER,
  TEST_SESSION,
  TEST_PROJECT_SUMMARY,
} from './data.js';

const app = express();
app.use(express.json());

// インメモリプロジェクトストレージ
const projects = new Map<string, { name: string; data: unknown }>([
  [TEST_PROJECT_SUMMARY.id, { name: TEST_PROJECT_SUMMARY.name, data: null }],
]);

// ── Helper ─────────────────────────────────────────────

function extractSessionCookie(req: express.Request): string | null {
  const cookieHeader = req.headers.cookie ?? '';
  const match = cookieHeader.match(/ars_session=([^;]+)/);
  return match?.[1] ?? null;
}

function requireSession(
  req: express.Request,
  res: express.Response,
): boolean {
  const session = extractSessionCookie(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  return true;
}

// ── Auth Routes ────────────────────────────────────────

/**
 * GET /auth/github/login
 * OAuth バイパス: 直接コールバックにリダイレクトしトークンを付与
 */
app.get('/auth/github/login', (req, res) => {
  const redirect = (req.query.redirect as string) ?? 'http://localhost:15173';
  const callbackUrl = `${redirect}/auth/callback?accessToken=mock-access&refreshToken=mock-refresh`;
  // ars_session Cookie をセット
  res.cookie('ars_session', TEST_SESSION_TOKEN, {
    httpOnly: true,
    path: '/',
    maxAge: 86400000,
  });
  res.redirect(302, callbackUrl);
});

/**
 * GET /auth/github/callback
 * Cernere callback のモック: セッション Cookie をセットしてリダイレクト
 */
app.get('/auth/github/callback', (req, res) => {
  res.cookie('ars_session', TEST_SESSION_TOKEN, {
    httpOnly: true,
    path: '/',
    maxAge: 86400000,
  });
  const origin = 'http://localhost:15173';
  res.redirect(302, `${origin}/auth/callback?accessToken=mock-access&refreshToken=mock-refresh`);
});

/**
 * GET /auth/me
 * セッション検証 → モックユーザー返却
 */
app.get('/auth/me', (req, res) => {
  if (!requireSession(req, res)) return;
  res.json(TEST_USER);
});

/**
 * GET /auth/session
 * セッション情報返却（access_token 含む）
 */
app.get('/auth/session', (req, res) => {
  if (!requireSession(req, res)) return;
  res.json(TEST_SESSION);
});

/**
 * POST /api/auth/refresh
 * トークンリフレッシュのモック
 */
app.post('/api/auth/refresh', (_req, res) => {
  res.json({
    accessToken: 'mock-access-refreshed',
    refreshToken: 'mock-refresh-refreshed',
  });
});

/**
 * POST /api/auth/logout
 * ログアウトのモック
 */
app.post('/api/auth/logout', (_req, res) => {
  res.json({ success: true });
});

// ── Project Routes ─────────────────────────────────────

/**
 * GET /api/projects
 * プロジェクト一覧
 */
app.get('/api/projects', (req, res) => {
  if (!requireSession(req, res)) return;
  const summaries = Array.from(projects.entries()).map(([id, p]) => ({
    id,
    name: p.name,
    updatedAt: '2025-01-01T00:00:00Z',
  }));
  res.json(summaries);
});

/**
 * POST /api/projects
 * プロジェクト保存
 */
app.post('/api/projects', (req, res) => {
  if (!requireSession(req, res)) return;
  const { projectId, name, data } = req.body;
  projects.set(projectId, { name, data });
  res.json({ success: true });
});

/**
 * GET /api/projects/:id
 * プロジェクト読み込み
 */
app.get('/api/projects/:id', (req, res) => {
  if (!requireSession(req, res)) return;
  const project = projects.get(req.params.id);
  if (!project || !project.data) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(project.data);
});

/**
 * DELETE /api/projects/:id
 * プロジェクト削除
 */
app.delete('/api/projects/:id', (req, res) => {
  if (!requireSession(req, res)) return;
  projects.delete(req.params.id);
  res.json({ success: true });
});

// ── Settings Routes ────────────────────────────────────

const settings = new Map<string, Map<string, string>>();

app.get('/api/settings/all', (req, res) => {
  if (!requireSession(req, res)) return;
  const projectId = req.query.projectId as string;
  const projectSettings = settings.get(projectId) ?? new Map();
  res.json(Object.fromEntries(projectSettings));
});

app.get('/api/settings', (req, res) => {
  if (!requireSession(req, res)) return;
  const projectId = req.query.projectId as string;
  const key = req.query.key as string;
  const value = settings.get(projectId)?.get(key) ?? null;
  res.json(value);
});

app.post('/api/settings', (req, res) => {
  if (!requireSession(req, res)) return;
  const { projectId, key, value } = req.body;
  if (!settings.has(projectId)) settings.set(projectId, new Map());
  settings.get(projectId)!.set(key, value);
  res.json({ success: true });
});

app.delete('/api/settings', (req, res) => {
  if (!requireSession(req, res)) return;
  const { projectId, key } = req.body;
  settings.get(projectId)?.delete(key);
  res.json({ success: true });
});

// ── Start ──────────────────────────────────────────────

const PORT = parseInt(process.env.MOCK_CERNERE_PORT ?? '18080', 10);

app.listen(PORT, () => {
  console.log(`Mock Cernere server running on http://localhost:${PORT}`);
});
