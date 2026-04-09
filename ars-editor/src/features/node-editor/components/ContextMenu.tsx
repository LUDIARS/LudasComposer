import { useEditorStore } from '@/stores/editorStore';
import { useProjectStore } from '@/stores/projectStore';
import type { ActorType } from '@/types/domain';
import { useCallback, useEffect, useRef } from 'react';
import { generateId } from '@/lib/utils';

interface ContextMenuProps {
  flowPosition: { x: number; y: number } | null;
}

export function ContextMenu({ flowPosition }: ContextMenuProps) {
  const contextMenu = useEditorStore((s) => s.contextMenu);
  const closeContextMenu = useEditorStore((s) => s.closeContextMenu);
  const clipboard = useEditorStore((s) => s.clipboard);
  const addActor = useProjectStore((s) => s.addActor);
  const instantiatePrefab = useProjectStore((s) => s.instantiatePrefab);
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const prefabs = useProjectStore((s) => s.project.prefabs);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        closeContextMenu();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [closeContextMenu]);

  const handleAddDomain = useCallback(
    (actorType: ActorType) => {
      if (!activeSceneId || !flowPosition) return;
      const labels: Record<ActorType, string> = {
        simple: 'New Domain',
        state: 'New State Domain',
        flexible: 'New Flexible Domain',
      };
      addActor(activeSceneId, {
        name: labels[actorType],
        role: 'actor',
        actorType,
        requirements: { overview: [], goals: [], role: [], behavior: [] },
        actorStates: [],
        flexibleContent: '',
        displays: [],
        position: flowPosition,
        subSceneId: null,
      });
      closeContextMenu();
    },
    [activeSceneId, addActor, closeContextMenu, flowPosition],
  );

  const handlePaste = useCallback(() => {
    if (!activeSceneId || !flowPosition || !clipboard) return;
    for (const actor of clipboard) {
      addActor(activeSceneId, {
        ...actor,
        id: generateId(),
        name: `${actor.name} (Paste)`,
        position: flowPosition,
      });
    }
    closeContextMenu();
  }, [activeSceneId, addActor, clipboard, closeContextMenu, flowPosition]);

  const handleInstantiatePrefab = useCallback(
    (prefabId: string) => {
      if (!activeSceneId || !flowPosition) return;
      instantiatePrefab(prefabId, activeSceneId, flowPosition);
      closeContextMenu();
    },
    [activeSceneId, instantiatePrefab, closeContextMenu, flowPosition],
  );

  if (!contextMenu) return null;

  const items: { label: string; actorType: ActorType; icon: string }[] = [
    { label: 'Add Simple Domain', actorType: 'simple', icon: '⬜' },
    { label: 'Add State Domain', actorType: 'state', icon: '🟡' },
    { label: 'Add Flexible Domain', actorType: 'flexible', icon: '🟣' },
  ];

  const prefabList = Object.values(prefabs);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl py-1 min-w-[200px]"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <div className="px-3 py-1 text-xs text-zinc-500 uppercase tracking-wider">Add Domain</div>
      {items.map(({ label, actorType, icon }) => (
        <button
          key={actorType}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
          onClick={() => handleAddDomain(actorType)}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </button>
      ))}

      {/* Paste */}
      {clipboard && clipboard.length > 0 && (
        <>
          <div className="h-px bg-zinc-700 my-1" />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
            onClick={handlePaste}
          >
            <span>📋</span>
            <span>Paste ({clipboard.length})</span>
          </button>
        </>
      )}

      {/* Prefabs */}
      {prefabList.length > 0 && (
        <>
          <div className="h-px bg-zinc-700 my-1" />
          <div className="px-3 py-1 text-xs text-zinc-500 uppercase tracking-wider">From Prefab</div>
          {prefabList.map((prefab) => (
            <button
              key={prefab.id}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-300 hover:bg-zinc-700 transition-colors"
              onClick={() => handleInstantiatePrefab(prefab.id)}
            >
              <span>🟣</span>
              <span>{prefab.name}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
