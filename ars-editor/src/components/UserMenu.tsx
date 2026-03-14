import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import * as authApi from '@/lib/auth-api';
import { isTauri } from '@/lib/backend';
import { ProjectManager } from './ProjectManager';

interface UserMenuProps {
  onOpenProjectManager?: () => void;
}

export function UserMenu({ onOpenProjectManager }: UserMenuProps) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isTauri()) {
      fetchUser();
    }
  }, [fetchUser]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpenProjects = () => {
    setOpen(false);
    if (onOpenProjectManager) {
      onOpenProjectManager();
    } else {
      setShowProjectManager(true);
    }
  };

  // Don't show in Tauri desktop mode
  if (isTauri()) return null;

  if (loading) {
    return <span className="text-zinc-500 text-xs px-2">...</span>;
  }

  if (!user) {
    return (
      <>
        <a
          href={authApi.getLoginUrl()}
          className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors text-xs"
        >
          Login with GitHub
        </a>
        {showProjectManager && (
          <ProjectManager onClose={() => setShowProjectManager(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors text-xs"
        >
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="w-4 h-4 rounded-full"
          />
          <span className="max-w-[100px] truncate">{user.displayName}</span>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-600 rounded shadow-lg z-50">
            <div className="px-3 py-2 border-b border-zinc-700">
              <div className="text-sm text-zinc-200 font-medium truncate">{user.displayName}</div>
              <div className="text-xs text-zinc-500 truncate">@{user.login}</div>
            </div>
            <button
              onClick={handleOpenProjects}
              className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Projects
            </button>
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
      {showProjectManager && (
        <ProjectManager onClose={() => setShowProjectManager(false)} />
      )}
    </>
  );
}
