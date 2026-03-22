import { useState, useEffect, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { useI18n } from '@/hooks/useI18n';
import { VariableEditor } from './VariableEditor';
import { TaskEditor } from './TaskEditor';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';
import type { Component, ComponentCategory } from '@/types/domain';
import { generateId } from '@/lib/utils';

const CATEGORIES: ComponentCategory[] = ['UI', 'Logic', 'System', 'GameObject'];

function createEmptyComponent(): Component {
  return {
    id: generateId(),
    name: '',
    category: 'Logic',
    domain: '',
    variables: [],
    tasks: [],
    dependencies: [],
  };
}

export function ComponentEditor() {
  const { t } = useI18n();
  const componentEditorTarget = useEditorStore((s) => s.componentEditorTarget);
  const closeComponentEditor = useEditorStore((s) => s.closeComponentEditor);
  const project = useProjectStore((s) => s.project);
  const upsertComponent = useProjectStore((s) => s.upsertComponent);

  const existingComponent = componentEditorTarget
    ? project.components[componentEditorTarget]
    : null;

  const [draft, setDraft] = useState<Component>(
    existingComponent ?? createEmptyComponent(),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    setDraft(existingComponent ?? createEmptyComponent());
    setIsDirty(false);
    setErrors({});
  }, [componentEditorTarget]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const allComponents = useMemo(() => Object.values(project.components), [project.components]);

  const updateField = <K extends keyof Component>(field: K, value: Component[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!draft.name.trim()) newErrors['name'] = t('componentEditor.nameRequired');
    if (!draft.domain.trim()) newErrors['domain'] = t('componentEditor.domainRequired');
    if (!CATEGORIES.includes(draft.category)) newErrors['category'] = t('componentEditor.invalidCategory');
    if (draft.tasks.length === 0) newErrors['tasks'] = t('componentEditor.taskRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    upsertComponent(draft);
    setIsDirty(false);
  };

  const toggleDependency = (depId: string) => {
    const deps = draft.dependencies.includes(depId)
      ? draft.dependencies.filter((d) => d !== depId)
      : [...draft.dependencies, depId];
    updateField('dependencies', deps);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700">
        <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
          {existingComponent ? t('componentEditor.editTitle') : t('componentEditor.newTitle')}
          {isDirty && <span className="text-amber-400 ml-1">*</span>}
          <HelpTooltip content={helpContent.componentEditor} position="left" highlightSelector='[data-help-target="componentEditor"]' />
        </h2>
        <button
          onClick={closeComponentEditor}
          className="text-zinc-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-1">{t('componentEditor.name')}</label>
          <input
            className="w-full bg-zinc-800 text-white text-sm px-3 py-1.5 rounded border border-zinc-600 outline-none focus:border-blue-500"
            placeholder={t('componentEditor.namePlaceholder')}
            value={draft.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
          {errors['name'] && <p className="text-red-400 text-xs mt-1">{errors['name']}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-1">{t('componentEditor.category')}</label>
          <select
            className="w-full bg-zinc-800 text-white text-sm px-3 py-1.5 rounded border border-zinc-600 outline-none focus:border-blue-500"
            value={draft.category}
            onChange={(e) => updateField('category', e.target.value as ComponentCategory)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {errors['category'] && <p className="text-red-400 text-xs mt-1">{errors['category']}</p>}
        </div>

        {/* Domain */}
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-1">{t('componentEditor.domain')}</label>
          <input
            className="w-full bg-zinc-800 text-white text-sm px-3 py-1.5 rounded border border-zinc-600 outline-none focus:border-blue-500"
            placeholder={t('componentEditor.domainPlaceholder')}
            value={draft.domain}
            onChange={(e) => updateField('domain', e.target.value)}
          />
          {errors['domain'] && <p className="text-red-400 text-xs mt-1">{errors['domain']}</p>}
        </div>

        {/* Variables */}
        <VariableEditor
          variables={draft.variables}
          onChange={(vars) => updateField('variables', vars)}
        />

        {/* Tasks */}
        <TaskEditor
          tasks={draft.tasks}
          onChange={(tasks) => updateField('tasks', tasks)}
        />
        {errors['tasks'] && <p className="text-red-400 text-xs">{errors['tasks']}</p>}

        {/* Dependencies */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">{t('componentEditor.dependencies')}</label>
          {allComponents.filter((c) => c.id !== draft.id).length === 0 ? (
            <p className="text-xs text-zinc-500 italic">{t('componentEditor.noDependencies')}</p>
          ) : (
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {allComponents
                .filter((c) => c.id !== draft.id)
                .map((comp) => (
                  <label
                    key={comp.id}
                    className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer hover:bg-zinc-800 px-2 py-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={draft.dependencies.includes(comp.id)}
                      onChange={() => toggleDependency(comp.id)}
                      className="accent-blue-500"
                    />
                    {comp.name}
                    <span className="text-zinc-500 text-xs">({comp.category})</span>
                  </label>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-700 flex gap-2 justify-end">
        <button
          onClick={closeComponentEditor}
          className="text-sm px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
        >
          {t('componentEditor.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('componentEditor.save')}
        </button>
      </div>
    </div>
  );
}
