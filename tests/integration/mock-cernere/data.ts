/**
 * Mock Cernere テストデータ
 *
 * 結合テストで使用するモックユーザー・セッション・プロジェクトデータ。
 */

export const TEST_SESSION_TOKEN = 'test-session-token-12345';

export const TEST_USER = {
  id: 'user-test-001',
  githubId: 99999,
  login: 'test-user',
  displayName: 'Test User',
  avatarUrl: 'https://avatars.githubusercontent.com/u/0?v=4',
  email: 'test@example.com',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

export const TEST_SESSION = {
  id: 'session-test-001',
  userId: TEST_USER.id,
  expiresAt: '2099-12-31T23:59:59Z',
  createdAt: '2025-01-01T00:00:00Z',
  accessToken: 'mock-github-access-token',
};

export const TEST_PROJECT = {
  name: 'Test Project',
  scenes: {},
  components: {},
  activeSceneId: null,
  version: '1.0.0',
};

export const TEST_PROJECT_SUMMARY = {
  id: 'project-test-001',
  name: 'Test Project',
  updatedAt: '2025-01-01T00:00:00Z',
};
