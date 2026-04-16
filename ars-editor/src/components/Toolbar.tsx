import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { useAuthStore } from '@/stores/authStore';
import { canUndo, canRedo, undo, redo } from '@/stores/historyMiddleware';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useI18n } from '@/hooks/useI18n';
import * as backend from '@/lib/backend';
import * as authApi from '@/lib/auth-api';
import { safeLoadProject } from '@/lib/project-loader';
import { ProjectManager } from './ProjectManager';
import { ProjectWizard } from './ProjectWizard';
import { ArchetypeWizard } from '@/features/archetype-wizard';
import { CodegenBridgeDialog, CodegenFeedbackDialog } from '@/features/codegen-bridge';
import { GettingStartedGuide } from './GettingStartedGuide';
import { ProjectListDialog } from './ProjectListDialog';
import { LanguageSettings } from './LanguageSettings';
import { CollabPresence } from '@/features/node-editor/components/CollabPresence';

// ── Menu Dropdown ────────────────────────────────────────────

interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  color?: string;
  dividerAfter?: boolean;
}

function MenuDropdown({
  label,
  items,
  open,
  onToggle,
  onClose,
}: {
  label: string;
  items: MenuItem[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="px-3 h-10 text-sm font-medium rounded transition-colors"
        style={{
          color: open ? 'var(--text)' : 'var(--text-muted)',
          background: open ? 'var(--bg-surface-2)' : 'transparent',
          border: 'none',
        }}
      >
        {label}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-0.5 py-1 min-w-[220px] rounded-lg shadow-xl z-50"
          style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
        >
          {items.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => { item.onClick(); onClose(); }}
                disabled={item.disabled}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors disabled:opacity-30"
                style={{
                  color: item.color ?? (item.active ? 'var(--accent)' : 'var(--text)'),
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 0,
                }}
                onMouseEnter={(e) => { if (!item.disabled) (e.target as HTMLElement).style.background = 'var(--bg-surface)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
              >
                {item.active && <span className="mr-1.5">✓</span>}
                {item.label}
              </button>
              {item.dividerAfter && <div className="h-px my-1" style={{ background: 'var(--border)' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Toolbar ─────────────────────────────────────────────

export function Toolbar() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const project = useProjectStore((s) => s.project);
  const isDirty = useEditorStore((s) => s.isDirty);
  const projectPath = useEditorStore((s) => s.projectPath);
  const markDirty = useEditorStore((s) => s.markDirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const togglePanel = useEditorStore((s) => s.togglePanel);
  const panelVisibility = useEditorStore((s) => s.panelVisibility);
  const autoSaveEnabled = useEditorStore((s) => s.autoSaveEnabled);
  const setAutoSave = useEditorStore((s) => s.setAutoSave);
  const setMobileSceneMenu = useEditorStore((s) => s.setMobileSceneMenu);
  const mobileBottomSheetOpen = useEditorStore((s) => s.mobileBottomSheetOpen);
  const setMobileBottomSheet = useEditorStore((s) => s.setMobileBottomSheet);
  const isGenerating = useEditorStore((s) => s.isGenerating);
  const abortGeneration = useEditorStore((s) => s.abortGeneration);
  const activeGitRepo = useAuthStore((s) => s.activeGitRepo);
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const logout = useAuthStore((s) => s.logout);

  const [status, setStatus] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showArchetypeWizard, setShowArchetypeWizard] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [showCodegenBridge, setShowCodegenBridge] = useState(false);
  const [showCodeFeedback, setShowCodeFeedback] = useState(false);
  const [pushing, setPushing] = useState(false);
  const isMobile = useIsMobile();

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2000);
  };

  const handleSave = useCallback(async () => {
    try {
      let path = projectPath;
      if (!path) {
        const defaultDir = await backend.getDefaultProjectPath();
        path = `${defaultDir}/${project.name.replace(/\s+/g, '_')}.json`;
      }
      await backend.saveProject(path, project);
      markSaved(path);
      showStatus(t('toolbar.toast.saved'));
    } catch {
      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      markSaved();
      showStatus(t('toolbar.toast.downloaded'));
    }
  }, [project, projectPath, markSaved, t]);

  const handleLoad = useCallback(async () => {
    if (backend.isTauri()) {
      try {
        const input = prompt(t('toolbar.enterProjectPath'));
        if (!input) return;
        const loaded = await backend.loadProject(input);
        safeLoadProject(loaded, input);
        showStatus(t('toolbar.toast.loaded'));
      } catch {
        showStatus(t('toolbar.toast.loadFailed'));
      }
    } else {
      setShowProjectList(true);
    }
  }, [t]);

  const handleNew = useCallback(() => {
    if (isDirty && !confirm(t('toolbar.confirmNew'))) return;
    setShowWizard(true);
  }, [isDirty, t]);

  const handleGitPush = useCallback(async () => {
    if (!activeGitRepo) return;
    setPushing(true);
    try {
      await authApi.pushGitProject(activeGitRepo, project);
      markSaved();
      showStatus(t('toolbar.toast.pushed'));
    } catch {
      showStatus(t('toolbar.toast.pushFailed'));
    } finally {
      setPushing(false);
    }
  }, [activeGitRepo, project, markSaved, t]);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  // ── Menu Items ──────────────────────────────────────

  const fileItems: MenuItem[] = [
    { label: t('toolbar.newProject'), onClick: handleNew },
    { label: t('toolbar.openProject'), onClick: handleLoad },
    { label: `${t('toolbar.save')}${isDirty ? ' *' : ''}`, onClick: handleSave },
    { label: t('toolbar.archetypeWizard'), onClick: () => setShowArchetypeWizard(true), color: 'var(--accent)' },
    { label: t('toolbar.codeGeneration'), onClick: () => setShowCodegenBridge(true), color: 'var(--green)' },
    { label: t('toolbar.codeFeedback'), onClick: () => setShowCodeFeedback(true), color: 'var(--orange)', dividerAfter: true },
    { label: t('toolbar.undo'), onClick: () => { if (isGenerating) abortGeneration(); undo(); markDirty(); }, disabled: !canUndo() },
    { label: t('toolbar.redo'), onClick: () => { redo(); markDirty(); }, disabled: !canRedo(), dividerAfter: true },
    ...(activeGitRepo ? [{ label: t('toolbar.pushToGithub'), onClick: handleGitPush, disabled: pushing, color: 'var(--green)', dividerAfter: true as const }] : []),
    ...(!backend.isTauri() ? [{ label: t('toolbar.projects'), onClick: () => setShowProjectManager(true) }] : []),
  ];

  const windowItems: MenuItem[] = [
    { label: 'Scene Manager', onClick: () => togglePanel('sceneManager'), active: panelVisibility.sceneManager },
    { label: t('toolbar.components'), onClick: () => togglePanel('componentList'), active: panelVisibility.componentList },
    { label: t('toolbar.prefabs'), onClick: () => togglePanel('prefabList'), active: panelVisibility.prefabList },
    { label: t('toolbar.behavior'), onClick: () => togglePanel('behaviorEditor'), active: panelVisibility.behaviorEditor },
    { label: t('toolbar.preview'), onClick: () => togglePanel('preview'), active: panelVisibility.preview },
  ];

  const settingsItems: MenuItem[] = [
    { label: `Language: ${locale === 'ja' ? '日本語' : 'English'}`, onClick: () => setShowLanguageSettings(true) },
    { label: `Auto Save: ${autoSaveEnabled ? 'ON' : 'OFF'}`, onClick: () => setAutoSave(!autoSaveEnabled), active: autoSaveEnabled, dividerAfter: true },
    { label: 'Project Settings', onClick: () => navigate('/settings'), active: location.pathname === '/settings', dividerAfter: true },
    ...(!backend.isTauri() ? (
      user
        ? [
            { label: `${user.displayName}`, onClick: () => {}, disabled: true },
            { label: 'Sign out', onClick: logout, color: 'var(--red)' },
          ]
        : [{ label: 'Sign in with GitHub', onClick: async () => { const r = await authApi.openOAuthPopup(); if (r.success) await fetchUser(); }, color: 'var(--accent)' }]
    ) : []),
  ];

  const helpItems: MenuItem[] = [
    { label: 'Getting Started', onClick: () => setShowGuide(true), color: 'var(--orange)' },
  ];

  // ── Modals ──────────────────────────────────────────

  const modals = (
    <>
      {showProjectManager && <ProjectManager onClose={() => setShowProjectManager(false)} />}
      {showWizard && <ProjectWizard onClose={() => setShowWizard(false)} />}
      {showArchetypeWizard && <ArchetypeWizard onClose={() => setShowArchetypeWizard(false)} />}
      {showGuide && <GettingStartedGuide onClose={() => setShowGuide(false)} />}
      {showProjectList && <ProjectListDialog onClose={() => setShowProjectList(false)} />}
      {showLanguageSettings && <LanguageSettings onClose={() => setShowLanguageSettings(false)} />}
      {showCodegenBridge && <CodegenBridgeDialog onClose={() => setShowCodegenBridge(false)} />}
      {showCodeFeedback && <CodegenFeedbackDialog onClose={() => setShowCodeFeedback(false)} />}
    </>
  );

  // ── Mobile ──────────────────────────────────────────

  if (isMobile) {
    return (
      <div
        className="flex items-center gap-0 px-0.5 text-xs relative"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', minHeight: '44px' }}
      >
        <span className="text-[10px] font-bold text-white mx-1.5 tracking-wider shrink-0">ARS</span>

        {/* Same menus as desktop */}
        <MenuDropdown label="File" items={fileItems} open={openMenu === 'file'} onToggle={() => setOpenMenu(openMenu === 'file' ? null : 'file')} onClose={closeMenu} />
        <MenuDropdown label="Set" items={settingsItems} open={openMenu === 'settings'} onToggle={() => setOpenMenu(openMenu === 'settings' ? null : 'settings')} onClose={closeMenu} />
        <MenuDropdown label="?" items={helpItems} open={openMenu === 'help'} onToggle={() => setOpenMenu(openMenu === 'help' ? null : 'help')} onClose={closeMenu} />

        <div className="flex-1" />

        <CollabPresence />

        {status && <span style={{ color: 'var(--green)' }} className="text-[10px] mr-1 ml-1">{status}</span>}

        {/* ☰ = Scene drawer + bottom sheet (独自拡張) */}
        <button
          onClick={() => setMobileBottomSheet(!mobileBottomSheetOpen)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors"
          style={{ color: mobileBottomSheetOpen ? 'var(--accent)' : 'var(--text-muted)', border: 'none', background: 'transparent' }}
        >
          ▤
        </button>
        <button
          onClick={() => setMobileSceneMenu(true)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors text-base"
          style={{ color: 'var(--text)', border: 'none', background: 'transparent' }}
        >
          ☰
        </button>
        {modals}
      </div>
    );
  }

  // ── Desktop ─────────────────────────────────────────

  return (
    <div
      className="flex items-center h-10 px-1 text-sm"
      style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
    >
      <span className="text-xs font-bold text-white mx-2 tracking-wider shrink-0">ARS</span>

      <MenuDropdown
        label="File"
        items={fileItems}
        open={openMenu === 'file'}
        onToggle={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
        onClose={closeMenu}
      />
      <MenuDropdown
        label="Window"
        items={windowItems}
        open={openMenu === 'window'}
        onToggle={() => setOpenMenu(openMenu === 'window' ? null : 'window')}
        onClose={closeMenu}
      />
      <MenuDropdown
        label="Settings"
        items={settingsItems}
        open={openMenu === 'settings'}
        onToggle={() => setOpenMenu(openMenu === 'settings' ? null : 'settings')}
        onClose={closeMenu}
      />
      <MenuDropdown
        label="Help"
        items={helpItems}
        open={openMenu === 'help'}
        onToggle={() => setOpenMenu(openMenu === 'help' ? null : 'help')}
        onClose={closeMenu}
      />

      <div className="flex-1" />

      <CollabPresence />

      <div className="mx-2 h-4 w-px" style={{ background: 'var(--border)' }} />

      <span className="truncate max-w-[200px] mr-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        {project.name}
        {isDirty && <span className="ml-1" style={{ color: 'var(--orange)' }}>*</span>}
      </span>
      {status && <span className="mr-2 text-xs" style={{ color: 'var(--green)' }}>{status}</span>}

      {user && (
        <div className="flex items-center gap-1.5 mr-2">
          <img src={user.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.displayName}</span>
        </div>
      )}

      {modals}
    </div>
  );
}
