import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { useAuthStore } from '@/stores/authStore';
import { canUndo, canRedo, undo, redo, clearHistory } from '@/stores/historyMiddleware';
import { useIsMobile } from '@/hooks/useIsMobile';
import * as backend from '@/lib/backend';
import * as authApi from '@/lib/auth-api';
import { UserMenu } from './UserMenu';
import { ProjectManager } from './ProjectManager';
import { ProjectWizard } from './ProjectWizard';
import { GettingStartedGuide } from './GettingStartedGuide';
import { HelpTooltip } from './HelpTooltip';
import { helpContent } from '@/lib/help-content';

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);
  const isDirty = useEditorStore((s) => s.isDirty);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const projectPath = useEditorStore((s) => s.projectPath);
  const markDirty = useEditorStore((s) => s.markDirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const setProjectPath = useEditorStore((s) => s.setProjectPath);
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
  const [showGuide, setShowGuide] = useState(false);
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
      showStatus('Saved!');
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
      showStatus('Downloaded!');
    }
  }, [project, projectPath, markSaved]);

  const handleLoad = useCallback(async () => {
    if (backend.isTauri()) {
      try {
        const input = prompt('Enter project file path:');
        if (!input) return;
        const loaded = await backend.loadProject(input);
        loadProject(loaded);
        clearHistory();
        setProjectPath(input);
        markSaved(input);
        showStatus('Loaded!');
      } catch {
        showStatus('Load failed');
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          loadProject(parsed);
          clearHistory();
          markSaved();
          showStatus('Loaded!');
        } catch {
          showStatus('Invalid file');
        }
      };
      input.click();
    }
  }, [loadProject, setProjectPath, markSaved]);

  const handleNew = useCallback(() => {
    if (isDirty && !confirm('Create a new project? Unsaved changes will be lost.')) return;
    setShowWizard(true);
  }, [isDirty]);

  const handleGitPush = useCallback(async () => {
    if (!activeGitRepo) return;
    setPushing(true);
    showStatus('Pushing to GitHub...');
    try {
      await authApi.pushGitProject(activeGitRepo, project);
      markSaved();
      showStatus('Pushed!');
    } catch {
      showStatus('Push failed');
    } finally {
      setPushing(false);
    }
  }, [activeGitRepo, project, markSaved]);

  const lastSavedLabel = lastSavedAt
    ? `Last saved: ${new Date(lastSavedAt).toLocaleTimeString()}`
    : '';

  // --- Mobile Toolbar ---
  if (isMobile) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border-b border-zinc-700 text-xs relative">
        {/* Hamburger - open scene drawer */}
        <button
          onClick={() => setMobileSceneMenu(true)}
          className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors text-base"
          title="Scenes"
        >
          ☰
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
          title="Save"
        >
          Save{isDirty ? ' *' : ''}
        </button>

        {/* Undo/Redo */}
        <button
          onClick={() => { if (isGenerating) abortGeneration(); undo(); markDirty(); }}
          disabled={!canUndo()}
          className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors disabled:opacity-30"
          title="Undo"
        >
          ↩
        </button>
        <button
          onClick={() => { redo(); markDirty(); }}
          disabled={!canRedo()}
          className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors disabled:opacity-30"
          title="Redo"
        >
          ↪
        </button>

        {/* Bottom sheet toggle */}
        <button
          onClick={() => setMobileBottomSheet(!mobileBottomSheetOpen)}
          className={`px-2 py-1 rounded transition-colors ${
            mobileBottomSheetOpen
              ? 'bg-blue-600 text-white'
              : 'text-zinc-300 hover:bg-zinc-700'
          }`}
          title="Toggle Panel"
        >
          ▤
        </button>

        <div className="flex-1" />

        {/* More menu */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
        >
          ⋯
        </button>

        {status && (
          <span className="text-green-400 ml-1">{status}</span>
        )}

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
                New Project
              </button>
              <button
                onClick={() => { handleLoad(); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Open Project
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
                Components
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
                Prefabs
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
                Behavior
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
                Preview
              </button>
              <div className="h-px bg-zinc-700 my-1" />
              {!backend.isTauri() && (
                <button
                  onClick={() => { setShowProjectManager(true); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Projects
                </button>
              )}
              {activeGitRepo && (
                <button
                  onClick={() => { handleGitPush(); setMobileMenuOpen(false); }}
                  disabled={pushing}
                  className="w-full text-left px-3 py-2 text-green-400 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  Push to GitHub
                </button>
              )}
              <div className="h-px bg-zinc-700 my-1" />
              <button
                onClick={() => { setShowGuide(true); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-amber-400 hover:bg-zinc-700 transition-colors"
              >
                ? Help
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
        {showGuide && (
          <GettingStartedGuide onClose={() => setShowGuide(false)} />
        )}
      </div>
    );
  }

  // --- Desktop Toolbar ---
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border-b border-zinc-700 text-xs">
      {/* File operations */}
      <button
        onClick={handleNew}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
        title="New Project"
      >
        New
      </button>
      <button
        onClick={handleLoad}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
        title="Open Project"
      >
        Open
      </button>
      <button
        onClick={handleSave}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
        title="Save Project (Ctrl+S)"
      >
        Save{isDirty ? ' *' : ''}
      </button>

      <div className="w-px h-4 bg-zinc-600 mx-1" />

      {/* Undo/Redo */}
      <button
        onClick={() => { undo(); markDirty(); }}
        disabled={!canUndo()}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        onClick={() => { redo(); markDirty(); }}
        disabled={!canRedo()}
        className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Y)"
      >
        Redo
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
        title="Toggle Component List"
      >
        Components
      </button>
      <button
        onClick={() => togglePanel('prefabList')}
        className={`px-2 py-1 rounded transition-colors ${
          panelVisibility.prefabList
            ? 'bg-purple-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-700'
        }`}
        title="Toggle Prefab List"
      >
        Prefabs
      </button>
      <button
        onClick={() => togglePanel('behaviorEditor')}
        className={`px-2 py-1 rounded transition-colors ${
          panelVisibility.behaviorEditor
            ? 'bg-cyan-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-700'
        }`}
        title="Toggle Behavior Editor"
      >
        Behavior
      </button>
      <button
        onClick={() => togglePanel('preview')}
        className={`px-2 py-1 rounded transition-colors ${
          panelVisibility.preview
            ? 'bg-blue-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-700'
        }`}
        title="Toggle Preview"
      >
        Preview
      </button>

      {/* Project name & status */}
      <div className="flex-1" />
      {lastSavedLabel && !status && (
        <span className="text-zinc-600 mr-2">{lastSavedLabel}</span>
      )}
      <span className="text-zinc-500 truncate max-w-[200px]">
        {project.name}
        {isDirty && <span className="text-amber-400 ml-1">(unsaved)</span>}
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
          title={`Push to ${activeGitRepo}`}
        >
          Push{pushing ? '...' : ''}
        </button>
      )}
      {!backend.isTauri() && (
        <button
          onClick={() => setShowProjectManager(true)}
          className="px-2 py-1 text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
          title="Project Manager"
        >
          Projects
        </button>
      )}
      <UserMenu onOpenProjectManager={() => setShowProjectManager(true)} />
      <div className="w-px h-4 bg-zinc-600 mx-1" />
      <HelpTooltip content={helpContent.toolbar} position="bottom" className="mr-1" />
      <button
        onClick={() => setShowGuide(true)}
        className="px-2 py-1 text-amber-400 hover:bg-zinc-700 rounded transition-colors font-medium"
        title="Getting Started Guide"
      >
        ? Help
      </button>
      {showProjectManager && (
        <ProjectManager onClose={() => setShowProjectManager(false)} />
      )}
      {showWizard && (
        <ProjectWizard onClose={() => setShowWizard(false)} />
      )}
      {showGuide && (
        <GettingStartedGuide onClose={() => setShowGuide(false)} />
      )}
    </div>
  );
}
