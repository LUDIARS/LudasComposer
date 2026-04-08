import { useCallback, useEffect, useRef } from 'react';
import { SceneList } from '../scene-manager';
import { NodeCanvas } from '../node-editor';
import { DomainDiagramCanvas } from '../domain-diagram';
import { ComponentPicker } from '../component-picker';
import { ComponentEditor } from '../component-editor';
import { ComponentList } from '../component-list';
import { ScenePreview } from '../preview';
import { SequenceEditor } from '../sequence-editor';
import { SubScenePicker } from '../subscene-picker';
import { PrefabList } from '../prefab-list';
import { BehaviorEditor } from '../behavior-editor';
import { Toolbar } from '@/components/Toolbar';
import { useEditorStore } from '@/stores/editorStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useProjectStore } from '@/stores/projectStore';
import { generateId } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import * as backend from '@/lib/backend';

export function EditorPage() {
  const componentPickerTarget = useEditorStore((s) => s.componentPickerTarget);
  const sequenceEditorTarget = useEditorStore((s) => s.sequenceEditorTarget);
  const subScenePickerTarget = useEditorStore((s) => s.subScenePickerTarget);
  const panelVisibility = useEditorStore((s) => s.panelVisibility);
  const openComponentEditor = useEditorStore((s) => s.openComponentEditor);
  const markDirty = useEditorStore((s) => s.markDirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const projectPath = useEditorStore((s) => s.projectPath);
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds);
  const copyToClipboard = useEditorStore((s) => s.copyToClipboard);
  const clipboard = useEditorStore((s) => s.clipboard);
  const mobileSceneMenuOpen = useEditorStore((s) => s.mobileSceneMenuOpen);
  const setMobileSceneMenu = useEditorStore((s) => s.setMobileSceneMenu);
  const mobileBottomSheetOpen = useEditorStore((s) => s.mobileBottomSheetOpen);
  const setMobileBottomSheet = useEditorStore((s) => s.setMobileBottomSheet);
  const project = useProjectStore((s) => s.project);
  const addActor = useProjectStore((s) => s.addActor);
  const duplicateActor = useProjectStore((s) => s.duplicateActor);
  const isMobile = useIsMobile();

  // Track project changes to mark dirty
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    markDirty();
  }, [project, markDirty]);

  const handleSave = useCallback(async () => {
    try {
      let path = projectPath;
      if (!path) {
        const defaultDir = await backend.getDefaultProjectPath();
        path = `${defaultDir}/${project.name.replace(/\s+/g, '_')}.json`;
      }
      await backend.saveProject(path, project);
      markSaved(path);
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
    }
  }, [project, projectPath, markSaved]);

  const handleCopy = useCallback(() => {
    if (!project.activeSceneId || selectedNodeIds.length === 0) return;
    const scene = project.scenes[project.activeSceneId];
    if (!scene) return;
    const actors = selectedNodeIds
      .map((id) => scene.actors[id])
      .filter(Boolean);
    if (actors.length > 0) {
      copyToClipboard(actors);
    }
  }, [project, selectedNodeIds, copyToClipboard]);

  const handlePaste = useCallback(() => {
    if (!project.activeSceneId || !clipboard || clipboard.length === 0) return;
    for (const actor of clipboard) {
      addActor(project.activeSceneId, {
        ...actor,
        id: generateId(),
        name: `${actor.name} (Paste)`,
        position: {
          x: actor.position.x + 50,
          y: actor.position.y + 50,
        },
        parentId: null,
        children: [],
      });
    }
  }, [project.activeSceneId, clipboard, addActor]);

  const handleDuplicate = useCallback(() => {
    if (!project.activeSceneId || selectedNodeIds.length === 0) return;
    for (const id of selectedNodeIds) {
      duplicateActor(project.activeSceneId, id);
    }
  }, [project.activeSceneId, selectedNodeIds, duplicateActor]);

  useKeyboardShortcuts({
    onSave: handleSave,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onDuplicate: handleDuplicate,
  });

  // --- Mobile Layout ---
  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full">
        <Toolbar />

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {panelVisibility.domainDiagram ? <DomainDiagramCanvas /> : <NodeCanvas />}

          {mobileSceneMenuOpen && (
            <div
              className="mobile-overlay"
              onClick={() => setMobileSceneMenu(false)}
            />
          )}
          <div
            className={`mobile-scene-drawer ${mobileSceneMenuOpen ? 'open' : ''}`}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700">
              <h2 className="text-sm font-semibold text-white">Scenes</h2>
              <button
                onClick={() => setMobileSceneMenu(false)}
                className="text-zinc-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SceneList />
            </div>
            <div className="border-t border-zinc-700 p-2">
              <button
                className="w-full text-xs text-blue-400 hover:text-blue-300 hover:bg-zinc-800 py-2 rounded transition-colors"
                onClick={() => {
                  openComponentEditor(null);
                  setMobileSceneMenu(false);
                  setMobileBottomSheet(true);
                }}
              >
                + New Component
              </button>
            </div>
          </div>

          <div
            className={`mobile-bottom-sheet ${mobileBottomSheetOpen ? 'open' : ''}`}
          >
            <div
              className="mobile-bottom-sheet-handle"
              onClick={() => setMobileBottomSheet(!mobileBottomSheetOpen)}
            >
              <div className="mobile-bottom-sheet-bar" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {panelVisibility.componentEditor && <ComponentEditor />}
              {panelVisibility.preview && !panelVisibility.componentEditor && (
                <ScenePreview />
              )}
              {panelVisibility.componentList &&
                !panelVisibility.componentEditor &&
                !panelVisibility.preview && <ComponentList />}
              {panelVisibility.prefabList &&
                !panelVisibility.componentEditor &&
                !panelVisibility.preview &&
                !panelVisibility.componentList && <PrefabList />}
              {panelVisibility.behaviorEditor &&
                !panelVisibility.componentEditor &&
                !panelVisibility.preview &&
                !panelVisibility.componentList &&
                !panelVisibility.prefabList && <BehaviorEditor />}
              {!panelVisibility.componentEditor &&
                !panelVisibility.preview &&
                !panelVisibility.componentList &&
                !panelVisibility.prefabList &&
                !panelVisibility.behaviorEditor && (
                  <div className="p-4 text-zinc-500 text-sm text-center">
                    Toggle panels from the toolbar to view content here.
                  </div>
                )}
            </div>
          </div>
        </div>

        {componentPickerTarget && <ComponentPicker />}
        {sequenceEditorTarget && <SequenceEditor />}
        {subScenePickerTarget && <SubScenePicker />}
      </div>
    );
  }

  // --- Desktop Layout ---
  return (
    <div className="flex flex-col h-full w-full">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {panelVisibility.sceneManager && (
          <div className="w-60 min-w-[240px] bg-zinc-850 border-r border-zinc-700 flex flex-col" data-help-target="sceneList">
            <div className="flex-1 overflow-hidden">
              <SceneList />
            </div>
            <div className="border-t border-zinc-700 p-2">
              <button
                className="w-full text-xs text-blue-400 hover:text-blue-300 hover:bg-zinc-800 py-2 rounded transition-colors"
                onClick={() => openComponentEditor(null)}
              >
                + New Component
              </button>
            </div>
          </div>
        )}

        {panelVisibility.componentList && (
          <div className="w-64 min-w-[256px] bg-zinc-850 border-r border-zinc-700" data-help-target="componentList">
            <ComponentList />
          </div>
        )}

        {panelVisibility.prefabList && (
          <div className="w-60 min-w-[240px] bg-zinc-850 border-r border-zinc-700" data-help-target="prefabList">
            <PrefabList />
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden" data-help-target="nodeCanvas">
          {panelVisibility.domainDiagram ? <DomainDiagramCanvas /> : <NodeCanvas />}
        </div>

        {panelVisibility.preview && (
          <div className="w-72 min-w-[288px] bg-zinc-850 border-l border-zinc-700" data-help-target="preview">
            <ScenePreview />
          </div>
        )}

        {panelVisibility.behaviorEditor && (
          <div className="w-80 min-w-[320px] bg-zinc-850 border-l border-zinc-700" data-help-target="behaviorEditor">
            <BehaviorEditor />
          </div>
        )}

        {panelVisibility.componentEditor && (
          <div className="w-80 min-w-[320px] bg-zinc-850 border-l border-zinc-700" data-help-target="componentEditor">
            <ComponentEditor />
          </div>
        )}

        {componentPickerTarget && <ComponentPicker />}
        {sequenceEditorTarget && <SequenceEditor />}
        {subScenePickerTarget && <SubScenePicker />}
      </div>
    </div>
  );
}
