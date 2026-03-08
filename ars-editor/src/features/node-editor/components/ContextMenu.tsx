import { useEditorStore } from '@/stores/editorStore';
import { useProjectStore } from '@/stores/projectStore';
import type { ActorRole } from '@/types/domain';
import { useCallback, useEffect, useRef } from 'react';

interface ContextMenuProps {
  flowPosition: { x: number; y: number } | null;
}

export function ContextMenu({ flowPosition }: ContextMenuProps) {
  const contextMenu = useEditorStore((s) => s.contextMenu);
  const closeContextMenu = useEditorStore((s) => s.closeContextMenu);
  const addActor = useProjectStore((s) => s.addActor);
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
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

  const handleAddActor = useCallback(
    (role: ActorRole) => {
      if (!activeSceneId || !flowPosition) return;
      addActor(activeSceneId, {
        name: `New ${role.charAt(0).toUpperCase() + role.slice(1)}`,
        role,
        components: [],
        children: [],
        position: flowPosition,
      });
      closeContextMenu();
    },
    [activeSceneId, addActor, closeContextMenu, flowPosition],
  );

  if (!contextMenu) return null;

  const items: { label: string; role: ActorRole; icon: string }[] = [
    { label: 'Add Actor', role: 'actor', icon: '🟢' },
    { label: 'Add Sequence', role: 'sequence', icon: '🟠' },
  ];

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <div className="px-3 py-1 text-xs text-zinc-500 uppercase tracking-wider">Add Node</div>
      {items.map(({ label, role, icon }) => (
        <button
          key={role}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
          onClick={() => handleAddActor(role)}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
