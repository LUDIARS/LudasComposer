import { useState, useEffect } from 'react';
import { Outlet } from 'react-router';
import { LanguageSettings } from './components/LanguageSettings';
import { SecretsSetup } from './components/SecretsSetup';
import { useAuthStore } from './stores/authStore';
import { useCollabStore } from './stores/collabStore';
import { useProjectStore } from './stores/projectStore';
import { isTauri } from './lib/backend';
import { getSetupStatus } from './lib/setup-api';

export function AppLayout() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(() => isTauri() ? false : null);
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const joinRoom = useCollabStore((s) => s.joinRoom);
  const leaveRoom = useCollabStore((s) => s.leaveRoom);
  const projectName = useProjectStore((s) => s.project.name);

  useEffect(() => {
    if (isTauri()) return;
    getSetupStatus()
      .then((status) => setNeedsSetup(status.needs_setup))
      .catch(() => setNeedsSetup(false));
  }, []);

  useEffect(() => {
    if (!isTauri()) fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isTauri() && user && projectName) {
      const roomId = `project:${projectName}`;
      joinRoom(roomId, user.id, user.displayName, user.avatarUrl);
      return () => { leaveRoom(); };
    }
  }, [user, projectName, joinRoom, leaveRoom]);

  if (needsSetup === true) return <SecretsSetup />;

  if (needsSetup === null && !isTauri()) {
    return (
      <div className="flex items-center justify-center h-screen w-screen" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  // Expose language settings toggle for Toolbar to use
  return (
    <div className="flex flex-col h-screen w-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
      {showLanguageSettings && (
        <LanguageSettings onClose={() => setShowLanguageSettings(false)} />
      )}
    </div>
  );
}

// Export for Toolbar to trigger language settings
export { };
