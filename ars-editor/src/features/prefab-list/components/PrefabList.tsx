import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useI18n } from '@/hooks/useI18n';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';
import { cn } from '@/lib/utils';

export function PrefabList() {
  const { t } = useI18n();
  const prefabs = useProjectStore((s) => s.project.prefabs);
  const deletePrefab = useProjectStore((s) => s.deletePrefab);
  const renamePrefab = useProjectStore((s) => s.renamePrefab);
  const instantiatePrefab = useProjectStore((s) => s.instantiatePrefab);
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const prefabList = Object.values(prefabs);

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleFinishRename = (id: string) => {
    const trimmed = editName.trim();
    if (trimmed) {
      renamePrefab(id, trimmed);
    }
    setEditingId(null);
  };

  const handleInstantiate = (prefabId: string) => {
    if (!activeSceneId) return;
    instantiatePrefab(prefabId, activeSceneId, {
      x: 300 + Math.random() * 100,
      y: 200 + Math.random() * 100,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-700">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          {t('prefabList.title')}
          <HelpTooltip content={helpContent.prefabList} position="right" highlightSelector='[data-help-target="prefabList"]' />
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {prefabList.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-4">
            {t('prefabList.empty')}
          </p>
        ) : (
          prefabList.map((prefab) => (
            <div
              key={prefab.id}
              className="group flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              <span className="text-base">🟣</span>
              {editingId === prefab.id ? (
                <input
                  className="flex-1 bg-zinc-900 text-white px-1 py-0.5 rounded text-sm outline-none border border-zinc-500"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleFinishRename(prefab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename(prefab.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 truncate cursor-pointer"
                  onDoubleClick={() => handleStartRename(prefab.id, prefab.name)}
                >
                  {prefab.name}
                </span>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded transition-colors',
                    activeSceneId
                      ? 'text-cyan-400 hover:bg-zinc-600'
                      : 'text-zinc-600 cursor-not-allowed',
                  )}
                  onClick={() => handleInstantiate(prefab.id)}
                  disabled={!activeSceneId}
                  title={t('prefabList.addToScene')}
                >
                  +
                </button>
                <button
                  className="text-xs text-red-400 hover:bg-zinc-600 px-1.5 py-0.5 rounded transition-colors"
                  onClick={() => {
                    if (confirm(t('prefabList.deleteConfirm', { name: prefab.name }))) {
                      deletePrefab(prefab.id);
                    }
                  }}
                  title={t('prefabList.deleteTitle')}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
