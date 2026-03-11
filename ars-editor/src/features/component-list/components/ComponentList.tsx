import { useState, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import type { ComponentCategory } from '@/types/domain';

const CATEGORIES: ComponentCategory[] = ['UI', 'Logic', 'System', 'GameObject'];

const CATEGORY_ICONS: Record<string, string> = {
  UI: '🖼️',
  Logic: '🎮',
  System: '🔧',
  GameObject: '📦',
};

export function ComponentList() {
  const project = useProjectStore((s) => s.project);
  const deleteComponent = useProjectStore((s) => s.deleteComponent);
  const openComponentEditor = useEditorStore((s) => s.openComponentEditor);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ComponentCategory | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, typeof filteredComponents> = {};
    for (const comp of filteredComponents) {
      if (!groups[comp.category]) groups[comp.category] = [];
      groups[comp.category].push(comp);
    }
    return groups;
  }, [filteredComponents]);

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete component "${name}"? This will remove it from all actors.`)) return;
    deleteComponent(id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-700">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
          Components ({allComponents.length})
        </h2>
        <input
          className="w-full bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none focus:border-blue-500 mb-2"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="flex gap-1 flex-wrap">
          <button
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              categoryFilter === null
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
            onClick={() => setCategoryFilter(null)}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
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

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredComponents.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-4">
            {allComponents.length === 0 ? 'No components defined yet' : 'No matching components'}
          </p>
        ) : (
          Object.entries(groupedByCategory).map(([category, comps]) => (
            <div key={category} className="mb-2">
              <div className="text-xs text-zinc-500 font-medium px-1 py-1 uppercase tracking-wider">
                {CATEGORY_ICONS[category] ?? '📎'} {category} ({comps.length})
              </div>
              {comps.map((comp) => (
                <div key={comp.id}>
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 cursor-pointer group"
                    onClick={() => setExpandedId(expandedId === comp.id ? null : comp.id)}
                  >
                    <span className="text-xs text-zinc-500">
                      {expandedId === comp.id ? '▼' : '▶'}
                    </span>
                    <span className="text-sm text-zinc-200 flex-1 truncate">{comp.name}</span>
                    <span className="text-xs text-zinc-600">{comp.domain}</span>
                    <button
                      className="text-xs text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        openComponentEditor(comp.id);
                      }}
                      title="Edit"
                    >
                      Edit
                    </button>
                    <button
                      className="text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(comp.id, comp.name);
                      }}
                      title="Delete"
                    >
                      Del
                    </button>
                  </div>

                  {expandedId === comp.id && (
                    <div className="ml-5 pl-3 border-l border-zinc-700 mb-2 space-y-1">
                      {/* Variables */}
                      {comp.variables.length > 0 && (
                        <div>
                          <div className="text-xs text-zinc-500 font-medium">Variables</div>
                          {comp.variables.map((v, i) => (
                            <div key={i} className="text-xs text-zinc-400 pl-2">
                              {v.name}: <span className="text-zinc-500">{v.type}</span>
                              {v.defaultValue !== undefined && (
                                <span className="text-zinc-600"> = {String(v.defaultValue)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tasks */}
                      {comp.tasks.length > 0 && (
                        <div>
                          <div className="text-xs text-zinc-500 font-medium">Tasks</div>
                          {comp.tasks.map((t, i) => (
                            <div key={i} className="text-xs text-zinc-400 pl-2">
                              <span className="text-zinc-300">{t.name}</span>
                              {t.inputs.length > 0 && (
                                <span className="text-zinc-600">
                                  {' '}in: {t.inputs.map((p) => p.name).join(', ')}
                                </span>
                              )}
                              {t.outputs.length > 0 && (
                                <span className="text-zinc-600">
                                  {' '}out: {t.outputs.map((p) => p.name).join(', ')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Dependencies */}
                      {comp.dependencies.length > 0 && (
                        <div>
                          <div className="text-xs text-zinc-500 font-medium">Dependencies</div>
                          {comp.dependencies.map((depId) => {
                            const dep = project.components[depId];
                            return (
                              <div key={depId} className="text-xs text-zinc-400 pl-2">
                                {dep ? dep.name : depId}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
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
  );
}
