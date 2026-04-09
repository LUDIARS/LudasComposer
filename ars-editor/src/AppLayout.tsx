import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { CollabPresence } from './features/node-editor/components/CollabPresence';
import { LanguageSettings } from './components/LanguageSettings';
import { SecretsSetup } from './components/SecretsSetup';
import { useAuthStore } from './stores/authStore';
import { useCollabStore } from './stores/collabStore';
import { useProjectStore } from './stores/projectStore';
import { isTauri } from './lib/backend';
import { getSetupStatus } from './lib/setup-api';
import { openOAuthPopup } from './lib/auth-api';
import { useI18n } from '@/hooks/useI18n';
import { useIsMobile } from '@/hooks/useIsMobile';

interface NavItem {
  path: string;
  label: string;
}

export function AppLayout() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(() => isTauri() ? false : null);
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const logout = useAuthStore((s) => s.logout);
  const joinRoom = useCollabStore((s) => s.joinRoom);
  const leaveRoom = useCollabStore((s) => s.leaveRoom);
  const collabConnected = useCollabStore((s) => s.connected);
  const collabUsers = useCollabStore((s) => s.users);
  const projectName = useProjectStore((s) => s.project.name);

  // Web版のみ: セットアップ状態を確認
  useEffect(() => {
    if (isTauri()) return;
    getSetupStatus()
      .then((status) => setNeedsSetup(status.needs_setup))
      .catch(() => setNeedsSetup(false));
  }, []);

  // Web版のみ: ユーザー情報を取得
  useEffect(() => {
    if (!isTauri()) {
      fetchUser();
    }
  }, [fetchUser]);

  // ユーザーがログイン中の場合、プロジェクト部屋に自動参加
  useEffect(() => {
    if (!isTauri() && user && projectName) {
      const roomId = `project:${projectName}`;
      joinRoom(roomId, user.id, user.displayName, user.avatarUrl);
      return () => {
        leaveRoom();
      };
    }
  }, [user, projectName, joinRoom, leaveRoom]);

  // ナビ遷移時にドロワーを閉じる
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // セットアップが必要な場合はウィザードを表示
  if (needsSetup === true) {
    return <SecretsSetup />;
  }

  // ロード中
  if (needsSetup === null && !isTauri()) {
    return (
      <div className="flex items-center justify-center h-screen w-screen" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  const NAV_ITEMS: NavItem[] = [
    { path: '/', label: t('app.nav.editor') },
    { path: '/settings', label: t('app.nav.settings') },
  ];

  const navLinks = (onClick?: () => void) => (
    <>
      {NAV_ITEMS.map(item => {
        const isActive = item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClick}
            className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
              isActive
                ? 'bg-[var(--bg-surface-2)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );

  const rightSection = (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setShowLanguageSettings(true)}
        className="text-[10px] hover:opacity-80 transition-opacity px-1 min-h-[44px] flex items-center"
        style={{ color: 'var(--text-muted)' }}
        title={t('settings.language')}
      >
        {locale === 'ja' ? '\u{1F1EF}\u{1F1F5}' : '\u{1F1FA}\u{1F1F8}'}
      </button>
      {collabConnected && collabUsers.size > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }} />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{collabUsers.size}</span>
          <CollabPresence />
        </div>
      )}
      {!isTauri() && (
        user ? (
          <div className="flex items-center gap-2">
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-5 h-5 rounded-full"
            />
            <span className="text-xs hidden sm:inline" style={{ color: 'var(--text)' }}>{user.displayName}</span>
            <button
              onClick={logout}
              className="text-[10px] transition-colors min-h-[44px] flex items-center px-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('app.auth.logout')}
            </button>
          </div>
        ) : (
          <button
            onClick={async () => {
              const result = await openOAuthPopup();
              if (result.success) {
                await fetchUser();
              }
            }}
            className="text-xs transition-colors min-h-[44px] flex items-center px-2"
            style={{ color: 'var(--accent)' }}
          >
            {t('app.auth.signInGithub')}
          </button>
        )
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Global Navigation */}
      <nav
        className="flex items-center h-11 px-3 shrink-0"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-bold text-white mr-3 tracking-wider">ARS</span>

        {/* Desktop: inline nav */}
        {!isMobile && (
          <div className="flex items-center gap-1">
            {navLinks()}
          </div>
        )}

        <div className="flex-1" />

        {/* Right section (shared) */}
        {!isMobile && rightSection}

        {/* Mobile: hamburger */}
        {isMobile && (
          <button
            onClick={() => setNavOpen(!navOpen)}
            className="flex items-center justify-center w-11 h-11 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              {navOpen ? (
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
              ) : (
                <path d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" />
              )}
            </svg>
          </button>
        )}
      </nav>

      {/* Mobile: slide-in nav drawer (right side) */}
      {isMobile && navOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setNavOpen(false)}
          />
          <div
            className="fixed top-0 right-0 bottom-0 w-64 max-w-[80vw] z-50 flex flex-col"
            style={{
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 h-11 shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-xs font-bold text-white tracking-wider">ARS</span>
              <button
                onClick={() => setNavOpen(false)}
                className="w-11 h-11 flex items-center justify-center"
                style={{ color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Nav links */}
            <div className="flex flex-col p-3 gap-1">
              {navLinks(() => setNavOpen(false))}
            </div>

            <div className="flex-1" />

            {/* User section */}
            <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
              {rightSection}
            </div>
          </div>
        </>
      )}

      {/* Page Content - React Router Outlet */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
      {showLanguageSettings && (
        <LanguageSettings onClose={() => setShowLanguageSettings(false)} />
      )}
    </div>
  );
}
