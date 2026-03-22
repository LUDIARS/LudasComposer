import { useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { useProjectStore } from '@/stores/projectStore';
import { useI18n } from '@/hooks/useI18n';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';

export function SequenceEditor() {
  const { t } = useI18n();
  const actorId = useEditorStore((s) => s.sequenceEditorTarget);
  const closeSequenceEditor = useEditorStore((s) => s.closeSequenceEditor);
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const scenes = useProjectStore((s) => s.project.scenes);
  const addSequenceStep = useProjectStore((s) => s.addSequenceStep);
  const removeSequenceStep = useProjectStore((s) => s.removeSequenceStep);
  const updateSequenceStep = useProjectStore((s) => s.updateSequenceStep);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  if (!actorId || !activeSceneId) return null;

  const scene = scenes[activeSceneId];
  if (!scene) return null;
  const actor = scene.actors[actorId];
  if (!actor) return null;

  const sequences = actor.sequences ?? [];

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addSequenceStep(activeSceneId, actorId, {
      name,
      description: newDesc.trim(),
      order: sequences.length,
    });
    setNewName('');
    setNewDesc('');
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const current = sequences[index];
    const prev = sequences[index - 1];
    updateSequenceStep(activeSceneId, actorId, current.id, { order: prev.order });
    updateSequenceStep(activeSceneId, actorId, prev.id, { order: current.order });
  };

  const handleMoveDown = (index: number) => {
    if (index >= sequences.length - 1) return;
    const current = sequences[index];
    const next = sequences[index + 1];
    updateSequenceStep(activeSceneId, actorId, current.id, { order: next.order });
    updateSequenceStep(activeSceneId, actorId, next.id, { order: current.order });
  };

  const sorted = [...sequences].sort((a, b) => a.order - b.order);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeSequenceEditor}>
      <div
        className="bg-zinc-800 border border-zinc-600 rounded-lg shadow-2xl w-[480px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
            {t('sequenceEditor.title', { name: actor.name })}
            <HelpTooltip content={helpContent.sequenceEditor} position="bottom" />
          </h2>
          <button
            className="text-zinc-400 hover:text-white text-sm"
            onClick={closeSequenceEditor}
          >
            ✕
          </button>
        </div>

        {/* Sequence list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sorted.length === 0 ? (
            <div className="text-zinc-500 text-sm text-center py-4">{t('sequenceEditor.noSequences')}</div>
          ) : (
            sorted.map((step, idx) => (
              <div
                key={step.id}
                className="bg-zinc-900 rounded-md p-3 border border-zinc-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 text-xs font-mono">#{idx + 1}</span>
                    <input
                      className="bg-transparent text-white text-sm font-medium outline-none border-b border-transparent focus:border-zinc-500"
                      value={step.name}
                      onChange={(e) =>
                        updateSequenceStep(activeSceneId, actorId, step.id, {
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="text-zinc-500 hover:text-white text-xs px-1"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      title={t('sequenceEditor.moveUp')}
                    >
                      ↑
                    </button>
                    <button
                      className="text-zinc-500 hover:text-white text-xs px-1"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === sorted.length - 1}
                      title={t('sequenceEditor.moveDown')}
                    >
                      ↓
                    </button>
                    <button
                      className="text-red-400 hover:text-red-300 text-xs px-1"
                      onClick={() => removeSequenceStep(activeSceneId, actorId, step.id)}
                      title={t('sequenceEditor.remove')}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <input
                  className="w-full bg-transparent text-zinc-400 text-xs outline-none border-b border-transparent focus:border-zinc-500"
                  value={step.description}
                  placeholder={t('sequenceEditor.descriptionPlaceholder')}
                  onChange={(e) =>
                    updateSequenceStep(activeSceneId, actorId, step.id, {
                      description: e.target.value,
                    })
                  }
                />
              </div>
            ))
          )}
        </div>

        {/* Add new step */}
        <div className="border-t border-zinc-700 p-4 space-y-2">
          <div className="text-xs text-zinc-400 mb-1">{t('sequenceEditor.addStepLabel')}</div>
          <input
            className="w-full bg-zinc-900 text-white text-sm px-3 py-1.5 rounded border border-zinc-600 outline-none focus:border-orange-500"
            placeholder={t('sequenceEditor.stepNamePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <input
            className="w-full bg-zinc-900 text-white text-sm px-3 py-1.5 rounded border border-zinc-600 outline-none focus:border-orange-500"
            placeholder={t('sequenceEditor.stepDescPlaceholder')}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <button
            className="w-full bg-orange-600 hover:bg-orange-500 text-white text-sm py-1.5 rounded transition-colors disabled:opacity-50"
            onClick={handleAdd}
            disabled={!newName.trim()}
          >
            {t('sequenceEditor.addStep')}
          </button>
        </div>
      </div>
    </div>
  );
}
