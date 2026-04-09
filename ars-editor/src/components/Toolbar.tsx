import { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { useAuthStore } from '@/stores/authStore';
import { canUndo, canRedo, undo, redo } from '@/stores/historyMiddleware';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useI18n } from '@/hooks/useI18n';
import * as backend from '@/lib/backend';
import * as authApi from '@/lib/auth-api';
import { safeLoadProject } from '@/lib/project-loader';
import { UserMenu } from './UserMenu';
import { ProjectManager } from './ProjectManager';
import { ProjectWizard } from './ProjectWizard';
import { ArchetypeWizard } from '@/features/archetype-wizard';
import { GettingStartedGuide } from './GettingStartedGuide';
import { ProjectListDialog } from './ProjectListDialog';
import { useBackendHealth } from '@/hooks/useBackendHealth';

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
        className="px-3 h-8 text-xs font-medium rounded transition-colors"
        style={{
          color: open ? 'var(--text)' : 'var(--text-muted)',
          background: open ? 'var(--bg-surface-2)' : 'transparent',
        }}
      >
        {label}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-0.5 py-1 min-w-[200px] rounded-lg shadow-xl z-50"
          style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
        >
          {items.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => { item.onClick(); onClose(); }}
                disabled={item.disabled}
                className="w-full text-left px-4 py-2 text-xs transition-colors disabled:opacity-30"
                style={{
                  color: item.color ?? (item.active ? 'var(--accent)' : 'var(--text)'),
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
  const { t } = useI18n();
  const project = useProjectStore((s) => s.project);
  const isDirty = useEditorStore((s) => s.isDirty);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const projectPath = useEditorStore((s) => s.projectPath);
  const markDirty = useEditorStore((s) => s.markDirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const togglePanel = useEditorStore((s) => s.togglePanel);
  const panelVisibility = useEditorStore((s) => s.panelVisibility);
  const setMobileSceneMenu = useEditorStore((s) => s.setMobileSceneMenu);
  const mobileBottomSheetOpen = useEditorStore((s) => s.mobileBottomSheetOpen);
  const setMobileBottomSheet = useEditorStore((s) => s.setMobileBottomSheet);
  const isGenerating = useEditorStore((s) => s.isGenerating);
  const abortGeneration = useEditorStore((s) => s.abortGeneration);
  const activeGitRepo = useAuthStore((s) => s.activeGitRepo);
  const [status, setStatus] = useState<string>('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showArchetypeWizard, setShowArchetypeWizard] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);
  const [pushing, setPushing] = useState(false);
  const isMobile = useIsMobile();
  const backendHealth = useBackendHealth();

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

  const lastSavedLabel = lastSavedAt
    ? t('toolbar.lastSaved', { time: new Date(lastSavedAt).toLocaleTimeString() })
    : '';

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  // ── Menu Items ──────────────────────────────────────

  const fileItems: MenuItem[] = [
    { label: t('toolbar.newProject'), onClick: handleNew },
    { label: t('toolbar.openProject'), onClick: handleLoad },
    { label: `${t('toolbar.save')}${isDirty ? ' *' : ''}`, onClick: handleSave, dividerAfter: true },
    { label: t('toolbar.archetypeWizard'), onClick: () => setShowArchetypeWizard(true), color: 'var(--accent)', dividerAfter: true },
    ...(activeGitRepo ? [{ label: t('toolbar.pushToGithub'), onClick: handleGitPush, disabled: pushing, color: 'var(--green)', dividerAfter: true }] : []),
    ...(!backend.isTauri() ? [{ label: t('toolbar.projects'), onClick: () => setShowProjectManager(true) }] : []),
  ];

  const toolItems: MenuItem[] = [
    { label: t('toolbar.undo'), onClick: () => { if (isGenerating) abortGeneration(); undo(); markDirty(); }, disabled: !canUndo() },
    { label: t('toolbar.redo'), onClick: () => { redo(); markDirty(); }, disabled: !canRedo() },
  ];

  const windowItems: MenuItem[] = [
    { label: 'Scene Manager', onClick: () => togglePanel('sceneManager'), active: panelVisibility.sceneManager },
    { label: t('toolbar.components'), onClick: () => togglePanel('componentList'), active: panelVisibility.componentList },
    { label: t('toolbar.prefabs'), onClick: () => togglePanel('prefabList'), active: panelVisibility.prefabList },
    { label: t('toolbar.behavior'), onClick: () => togglePanel('behaviorEditor'), active: panelVisibility.behaviorEditor },
    { label: t('toolbar.preview'), onClick: () => togglePanel('preview'), active: panelVisibility.preview, dividerAfter: true },
    { label: 'Domain Diagram', onClick: () => togglePanel('domainDiagram'), active: panelVisibility.domainDiagram },
  ];

  const helpItems: MenuItem[] = [
    { label: t('toolbar.help'), onClick: () => setShowGuide(true), color: 'var(--orange)' },
  ];

  // ── Mobile Toolbar ──────────────────────────────────

  if (isMobile) {
    return (
      <div
        className="flex items-center gap-0.5 px-1 text-xs relative"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', minHeight: '44px' }}
      >
        <button
          onClick={() => setMobileSceneMenu(true)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors text-base"
          style={{ color: 'var(--text)' }}
        >
          ☰
        </button>
        <button
          onClick={handleSave}
          className="min-h-[44px] px-3 flex items-center rounded transition-colors"
          style={{ color: isDirty ? 'var(--orange)' : 'var(--text-muted)' }}
        >
          {t('toolbar.save')}{isDirty ? '*' : ''}
        </button>
        <button
          onClick={() => { if (isGenerating) abortGeneration(); undo(); markDirty(); }}
          disabled={!canUndo()}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors disabled:opacity-30"
          style={{ color: 'var(--text-muted)' }}
        >
          ↩
        </button>
        <button
          onClick={() => { redo(); markDirty(); }}
          disabled={!canRedo()}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors disabled:opacity-30"
          style={{ color: 'var(--text-muted)' }}
        >
          ↪
        </button>
        <button
          onClick={() => setMobileBottomSheet(!mobileBottomSheetOpen)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors"
          style={{ color: mobileBottomSheetOpen ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          ▤
        </button>
        <div className="flex-1" />
        <span
          className={`w-2 h-2 rounded-full mr-1 ${
            backendHealth === 'ok' ? 'bg-green-500' :
            backendHealth === 'down' ? 'bg-red-500 animate-pulse' :
            'bg-zinc-500'
          }`}
        />
        {status && <span style={{ color: 'var(--green)' }} className="text-[10px] mr-1">{status}</span>}
        {showProjectManager && <ProjectManager onClose={() => setShowProjectManager(false)} />}
        {showWizard && <ProjectWizard onClose={() => setShowWizard(false)} />}
        {showArchetypeWizard && <ArchetypeWizard onClose={() => setShowArchetypeWizard(false)} />}
        {showGuide && <GettingStartedGuide onClose={() => setShowGuide(false)} />}
        {showProjectList && <ProjectListDialog onClose={() => setShowProjectList(false)} />}
      </div>
    );
  }

  // ── Desktop Menu Bar ────────────────────────────────

  return (
    <div
      className="flex items-center h-9 px-1 text-xs"
      style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Menu dropdowns */}
      <MenuDropdown
        label={t('toolbar.file') === 'toolbar.file' ? 'File' : t('toolbar.file')}
        items={fileItems}
        open={openMenu === 'file'}
        onToggle={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
        onClose={closeMenu}
      />
      <MenuDropdown
        label={t('toolbar.tools') === 'toolbar.tools' ? 'Tools' : t('toolbar.tools')}
        items={toolItems}
        open={openMenu === 'tools'}
        onToggle={() => setOpenMenu(openMenu === 'tools' ? null : 'tools')}
        onClose={closeMenu}
      />
      <MenuDropdown
        label={t('toolbar.window') === 'toolbar.window' ? 'Window' : t('toolbar.window')}
        items={windowItems}
        open={openMenu === 'window'}
        onToggle={() => setOpenMenu(openMenu === 'window' ? null : 'window')}
        onClose={closeMenu}
      />
      <MenuDropdown
        label={t('toolbar.helpMenu') === 'toolbar.helpMenu' ? 'Help' : t('toolbar.helpMenu')}
        items={helpItems}
        open={openMenu === 'help'}
        onToggle={() => setOpenMenu(openMenu === 'help' ? null : 'help')}
        onClose={closeMenu}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status area */}
      <span
        className={`w-2 h-2 rounded-full mr-2 ${
          backendHealth === 'ok' ? 'bg-green-500' :
          backendHealth === 'down' ? 'bg-red-500 animate-pulse' :
          'bg-zinc-500'
        }`}
        title={backendHealth === 'ok' ? 'Backend: connected' : backendHealth === 'down' ? 'Backend: offline' : 'Checking...'}
      />
      {backendHealth === 'down' && (
        <span className="mr-2" style={{ color: 'var(--red)', fontSize: '10px' }}>Offline</span>
      )}
      {lastSavedLabel && !status && backendHealth !== 'down' && (
        <span className="mr-2" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{lastSavedLabel}</span>
      )}
      <span className="truncate max-w-[200px] mr-2" style={{ color: 'var(--text-muted)' }}>
        {project.name}
        {isDirty && <span className="ml-1" style={{ color: 'var(--orange)' }}>*</span>}
      </span>
      {status && <span className="mr-2" style={{ color: 'var(--green)', fontSize: '10px' }}>{status}</span>}

      <UserMenu onOpenProjectManager={() => setShowProjectManager(true)} />

      {/* Modals */}
      {showProjectManager && <ProjectManager onClose={() => setShowProjectManager(false)} />}
      {showWizard && <ProjectWizard onClose={() => setShowWizard(false)} />}
      {showArchetypeWizard && <ArchetypeWizard onClose={() => setShowArchetypeWizard(false)} />}
      {showGuide && <GettingStartedGuide onClose={() => setShowGuide(false)} />}
      {showProjectList && <ProjectListDialog onClose={() => setShowProjectList(false)} />}
    </div>
  );
}
