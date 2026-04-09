import { useState, useCallback } from 'react';
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
import { HelpTooltip } from './HelpTooltip';
import { helpContent } from '@/lib/help-content';
import { useBackendHealth } from '@/hooks/useBackendHealth';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  }, [project, projectPath, markSaved]);

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
    showStatus(t('toolbar.toast.pushingGithub'));
    try {
      await authApi.pushGitProject(activeGitRepo, project);
      markSaved();
      showStatus(t('toolbar.toast.pushed'));
    } catch {
      showStatus(t('toolbar.toast.pushFailed'));
    } finally {
      setPushing(false);
    }
  }, [activeGitRepo, project, markSaved]);

  const lastSavedLabel = lastSavedAt
    ? t('toolbar.lastSaved', { time: new Date(lastSavedAt).toLocaleTimeString() })
    : '';

  // --- Mobile Toolbar (Foundation: min 44px touch targets) ---
  if (isMobile) {
    return (
      <div
        className="flex items-center gap-0.5 px-1 text-xs relative"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', minHeight: '44px' }}
      >
        {/* Hamburger - open scene drawer */}
        <button
          onClick={() => setMobileSceneMenu(true)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors text-base"
          style={{ color: 'var(--text)' }}
          title={t('toolbar.scenes')}
        >
          ☰
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          className="min-h-[44px] px-3 flex items-center rounded transition-colors"
          style={{ color: isDirty ? 'var(--orange)' : 'var(--text-muted)' }}
          title={t('toolbar.save')}
        >
          {t('toolbar.save')}{isDirty ? '*' : ''}
        </button>

        {/* Undo/Redo */}
        <button
          onClick={() => { if (isGenerating) abortGeneration(); undo(); markDirty(); }}
          disabled={!canUndo()}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors disabled:opacity-30"
          style={{ color: 'var(--text-muted)' }}
          title={t('toolbar.undo')}
        >
          ↩
        </button>
        <button
          onClick={() => { redo(); markDirty(); }}
          disabled={!canRedo()}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors disabled:opacity-30"
          style={{ color: 'var(--text-muted)' }}
          title={t('toolbar.redo')}
        >
          ↪
        </button>

        {/* Bottom sheet toggle */}
        <button
          onClick={() => setMobileBottomSheet(!mobileBottomSheetOpen)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors"
          style={{ color: mobileBottomSheetOpen ? 'var(--accent)' : 'var(--text-muted)' }}
          title={t('toolbar.togglePanel')}
        >
          ▤
        </button>

        <div className="flex-1" />

        {/* More menu */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          ⋯
        </button>

        {status && (
          <span className="text-green-400 ml-1">{status}</span>
        )}
        <span
          className={`w-2 h-2 rounded-full ml-1 ${
            backendHealth === 'ok' ? 'bg-green-500' :
            backendHealth === 'down' ? 'bg-red-500 animate-pulse' :
            'bg-zinc-500'
          }`}
        />

        {/* Dropdown menu */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="absolute right-2 top-full mt-1 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
              <button
                onClick={() => { handleNew(); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                {t('toolbar.newProject')}
              </button>
              <button
                onClick={() => { handleLoad(); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                {t('toolbar.openProject')}
              </button>
              <button
                onClick={() => { setShowArchetypeWizard(true); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-cyan-400 hover:bg-zinc-700 transition-colors"
              >
                {t('toolbar.archetypeWizard')}
              </button>
              <div className="h-px bg-zinc-700 my-1" />
              <button
                onClick={() => {
                  togglePanel('componentList');
                  setMobileBottomSheet(true);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 transition-colors ${
                  panelVisibility.componentList ? 'text-blue-400' : 'text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {t('toolbar.components')}
              </button>
              <button
                onClick={() => {
                  togglePanel('prefabList');
                  setMobileBottomSheet(true);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 transition-colors ${
                  panelVisibility.prefabList ? 'text-purple-400' : 'text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {t('toolbar.prefabs')}
              </button>
              <button
                onClick={() => {
                  togglePanel('behaviorEditor');
                  setMobileBottomSheet(true);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 transition-colors ${
                  panelVisibility.behaviorEditor ? 'text-cyan-400' : 'text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {t('toolbar.behavior')}
              </button>
              <button
                onClick={() => {
                  togglePanel('preview');
                  setMobileBottomSheet(true);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 transition-colors ${
                  panelVisibility.preview ? 'text-blue-400' : 'text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {t('toolbar.preview')}
              </button>
              <button
                onClick={() => {
                  togglePanel('domainDiagram');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 transition-colors ${
                  panelVisibility.domainDiagram ? 'text-emerald-400' : 'text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {t('toolbar.domainDiagram') === 'toolbar.domainDiagram' ? 'Domain Diagram' : t('toolbar.domainDiagram')}
              </button>
              <div className="h-px bg-zinc-700 my-1" />
              {!backend.isTauri() && (
                <button
                  onClick={() => { setShowProjectManager(true); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  {t('toolbar.projects')}
                </button>
              )}
              {activeGitRepo && (
                <button
                  onClick={() => { handleGitPush(); setMobileMenuOpen(false); }}
                  disabled={pushing}
                  className="w-full text-left px-3 py-2 text-green-400 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {t('toolbar.pushToGithub')}
                </button>
              )}
              <div className="h-px bg-zinc-700 my-1" />
              <button
                onClick={() => { setShowGuide(true); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-amber-400 hover:bg-zinc-700 transition-colors"
              >
                {t('toolbar.help')}
              </button>
              <div className="h-px bg-zinc-700 my-1" />
              <div className="px-3 py-2 text-zinc-500 truncate">
                {project.name}
                {isDirty && <span className="text-amber-400 ml-1">*</span>}
              </div>
            </div>
          </>
        )}
        {showProjectManager && (
          <ProjectManager onClose={() => setShowProjectManager(false)} />
        )}
        {showWizard && (
          <ProjectWizard onClose={() => setShowWizard(false)} />
        )}
        {showArchetypeWizard && (
          <ArchetypeWizard onClose={() => setShowArchetypeWizard(false)} />
        )}
        {showGuide && (
          <GettingStartedGuide onClose={() => setShowGuide(false)} />
        )}
        {showProjectList && (
          <ProjectListDialog onClose={() => setShowProjectList(false)} />
        )}
      </div>
    );
  }

  // --- Desktop Toolbar ---
  return (
    <div className="flex items-center gap-1 px-2 py-1 text-xs" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
      {/* File operations */}
      <button
        onClick={handleNew}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
        title={t('toolbar.newProject')}
      >
        {t('toolbar.new')}
      </button>
      <button
        onClick={handleLoad}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
        title={t('toolbar.openProject')}
      >
        {t('toolbar.open')}
      </button>
      <button
        onClick={() => setShowArchetypeWizard(true)}
        className="px-2 py-1 text-cyan-400 hover:bg-zinc-700 rounded transition-colors"
        title={t('toolbar.archetypeWizard')}
      >
        {t('toolbar.archetype')}
      </button>
      <button
        onClick={handleSave}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
        title={t('toolbar.saveProject')}
      >
        {t('toolbar.save')}{isDirty ? t('toolbar.unsavedMark') : ''}
      </button>

      <div className="w-px h-4 bg-zinc-600 mx-1" />

      {/* Undo/Redo */}
      <button
        onClick={() => { undo(); markDirty(); }}
        disabled={!canUndo()}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title={t('toolbar.undoAction')}
      >
        {t('toolbar.undo')}
      </button>
      <button
        onClick={() => { redo(); markDirty(); }}
        disabled={!canRedo()}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title={t('toolbar.redoAction')}
      >
        {t('toolbar.redo')}
      </button>

      <div className="w-px h-4 bg-zinc-600 mx-1" />

      {/* View toggles */}
      <button
        onClick={() => togglePanel('componentList')}
        className={`px-2 py-1 rounded transition-colors ${
          panelVisibility.componentList
            ? 'bg-blue-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-700'
        }`}
        title={t('toolbar.toggleComponentList')}
      >
        {t('toolbar.components')}
      </button>
      <button
        onClick={() => togglePanel('prefabList')}
        className={`px-2 py-1 rounded transition-colors ${
          panelVisibility.prefabList
            ? 'bg-purple-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-700'
        }`}
        title={t('toolbar.togglePrefabList')}
      >
        {t('toolbar.prefabs')}
      </button>
      <button
        onClick={() => togglePanel('behaviorEditor')}
        className={`px-2 py-1 rounded transition-colors ${
          panelVisibility.behaviorEditor
            ? 'bg-cyan-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-700'
        }`}
        title={t('toolbar.toggleBehaviorEditor')}
      >
        {t('toolbar.behavior')}
      </button>
      <button
        onClick={() => togglePanel('preview')}
        className={`px-2 py-1 rounded transition-colors ${
          panelVisibility.preview
            ? 'bg-blue-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-700'
        }`}
        title={t('toolbar.togglePreview')}
      >
        {t('toolbar.preview')}
      </button>

      <div className="w-px h-4 bg-zinc-600 mx-1" />

      <button
        onClick={() => togglePanel('domainDiagram')}
        className={`px-2 py-1 rounded transition-colors ${
          panelVisibility.domainDiagram
            ? 'bg-emerald-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-700'
        }`}
        title={t('toolbar.toggleDomainDiagram') === 'toolbar.toggleDomainDiagram' ? 'Toggle Domain Diagram' : t('toolbar.toggleDomainDiagram')}
      >
        {t('toolbar.domainDiagram') === 'toolbar.domainDiagram' ? 'Domain' : t('toolbar.domainDiagram')}
      </button>

      {/* Project name & status */}
      <div className="flex-1" />
      <span
        className={`w-2 h-2 rounded-full mr-2 ${
          backendHealth === 'ok' ? 'bg-green-500' :
          backendHealth === 'down' ? 'bg-red-500 animate-pulse' :
          'bg-zinc-500'
        }`}
        title={backendHealth === 'ok' ? 'Backend: connected' : backendHealth === 'down' ? 'Backend: offline' : 'Backend: checking...'}
      />
      {backendHealth === 'down' && (
        <span className="text-red-400 text-[10px] mr-2">Backend offline</span>
      )}
      {lastSavedLabel && !status && backendHealth !== 'down' && (
        <span className="text-zinc-600 mr-2">{lastSavedLabel}</span>
      )}
      <span className="text-zinc-500 truncate max-w-[200px]">
        {project.name}
        {isDirty && <span className="text-amber-400 ml-1">{t('toolbar.unsaved')}</span>}
      </span>
      {status && (
        <span className="text-green-400 ml-2">{status}</span>
      )}
      <div className="w-px h-4 bg-zinc-600 mx-1" />
      {activeGitRepo && (
        <button
          onClick={handleGitPush}
          disabled={pushing}
          className="px-2 py-1 text-green-400 hover:bg-zinc-700 rounded transition-colors disabled:opacity-50"
          title={t('toolbar.pushToRepo', { repo: activeGitRepo })}
        >
          {t('toolbar.push')}{pushing ? t('toolbar.pushing') : ''}
        </button>
      )}
      {!backend.isTauri() && (
        <button
          onClick={() => setShowProjectManager(true)}
          className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
          title={t('toolbar.projectManager')}
        >
          {t('toolbar.projects')}
        </button>
      )}
      <UserMenu onOpenProjectManager={() => setShowProjectManager(true)} />
      <div className="w-px h-4 bg-zinc-600 mx-1" />
      <HelpTooltip content={helpContent.toolbar} position="bottom" className="mr-1" />
      <button
        onClick={() => setShowGuide(true)}
        className="px-2 py-1 text-amber-400 hover:bg-zinc-700 rounded transition-colors font-medium"
        title={t('toolbar.gettingStarted')}
      >
        {t('toolbar.help')}
      </button>
      {showProjectManager && (
        <ProjectManager onClose={() => setShowProjectManager(false)} />
      )}
      {showWizard && (
        <ProjectWizard onClose={() => setShowWizard(false)} />
      )}
      {showArchetypeWizard && (
        <ArchetypeWizard onClose={() => setShowArchetypeWizard(false)} />
      )}
      {showGuide && (
        <GettingStartedGuide onClose={() => setShowGuide(false)} />
      )}
      {showProjectList && (
        <ProjectListDialog onClose={() => setShowProjectList(false)} />
      )}
    </div>
  );
}
