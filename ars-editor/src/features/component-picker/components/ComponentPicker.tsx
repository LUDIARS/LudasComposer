import { useState, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { useI18n } from '@/hooks/useI18n';
import { ComponentCard } from './ComponentCard';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';
import type { ComponentCategory } from '@/types/domain';

const CATEGORIES: ComponentCategory[] = ['UI', 'Logic', 'System', 'GameObject'];

export function ComponentPicker() {
  const { t } = useI18n();
  const targetActorId = useEditorStore((s) => s.componentPickerTarget);
  const closeComponentPicker = useEditorStore((s) => s.closeComponentPicker);
  const project = useProjectStore((s) => s.project);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ComponentCategory | null>(null);

  const activeScene = project.activeSceneId
    ? project.scenes[project.activeSceneId]
    : null;
  const actor = activeScene && targetActorId
    ? activeScene.actors[targetActorId]
    : null;

  const allComponents = useMemo(() => Object.values(project.components), [project.components]);

  const filteredComponents = useMemo(() => {
    return allComponents.filter((comp) => {
      if (categoryFilter && comp.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          comp.name.toLowerCase().includes(q) ||
          comp.domain.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allComponents, categoryFilter, searchQuery]);

  if (!targetActorId || !actor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[480px] max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <div>
              <h3 className="text-white font-semibold">{t('componentPicker.title')}</h3>
              <p className="text-xs text-zinc-400">Browse components</p>
            </div>
            <HelpTooltip content={helpContent.componentPicker} position="bottom" />
          </div>
          <button
            onClick={closeComponentPicker}
            className="text-zinc-400 hover:text-white text-lg"
          >
            &times;
          </button>
        </div>

        {/* Search & Filter */}
        <div className="px-4 py-2 space-y-2 border-b border-zinc-700">
          <input
            className="w-full bg-zinc-800 text-white text-sm px-3 py-1.5 rounded border border-zinc-600 outline-none focus:border-blue-500"
            placeholder={t('componentPicker.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex gap-1">
            <button
              className={`text-xs px-2 py-1 rounded transition-colors ${
                categoryFilter === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
              onClick={() => setCategoryFilter(null)}
            >
              {t('componentPicker.all')}
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  categoryFilter === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Component list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredComponents.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-4">
              {allComponents.length === 0
                ? t('componentPicker.noComponents')
                : t('componentPicker.noMatching')}
            </p>
          ) : (
            filteredComponents.map((comp) => (
              <ComponentCard
                key={comp.id}
                component={comp}
                isAttached={false}
                onToggle={() => {}}
              />
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-zinc-700">
          <p className="text-[10px] text-zinc-500 text-center">
            Component attachment will be available in the System Layer view
          </p>
        </div>
      </div>
    </div>
  );
}
