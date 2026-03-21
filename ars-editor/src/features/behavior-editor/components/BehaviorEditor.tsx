import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useI18n } from '@/hooks/useI18n';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';
import type { SceneState, KeyBinding } from '@/types/domain';

const COMMON_KEYS = [
  'W', 'A', 'S', 'D', 'Space', 'Enter', 'Escape',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Shift', 'Ctrl', 'E', 'Q', 'R', 'F', 'Tab',
  '1', '2', '3', '4', '5',
  'MouseLeft', 'MouseRight',
];

export function BehaviorEditor() {
  const { t } = useI18n();
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const scenes = useProjectStore((s) => s.project.scenes);
  const addSceneState = useProjectStore((s) => s.addSceneState);
  const removeSceneState = useProjectStore((s) => s.removeSceneState);
  const renameSceneState = useProjectStore((s) => s.renameSceneState);
  const setActiveState = useProjectStore((s) => s.setActiveState);
  const addKeyBinding = useProjectStore((s) => s.addKeyBinding);
  const updateKeyBinding = useProjectStore((s) => s.updateKeyBinding);
  const removeKeyBinding = useProjectStore((s) => s.removeKeyBinding);

  const [newStateName, setNewStateName] = useState('');
  const [isCapturingKey, setIsCapturingKey] = useState(false);
  const [captureTargetStateId, setCaptureTargetStateId] = useState<string | null>(null);

  if (!activeSceneId) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm p-4">
        Select a scene to edit behaviors
      </div>
    );
  }

  const scene = scenes[activeSceneId];
  if (!scene) return null;

  const states = scene.states ?? [];
  const activeStateId = scene.activeStateId;
  const actors = Object.values(scene.actors);

  const handleAddState = () => {
    const name = newStateName.trim();
    if (!name) return;
    addSceneState(activeSceneId, name);
    setNewStateName('');
  };

  const handleStartCapture = (stateId: string) => {
    setIsCapturingKey(true);
    setCaptureTargetStateId(stateId);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-700">
        <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
          {t('behaviorEditor.title')}
          <HelpTooltip content={helpContent.behaviorEditor} position="bottom" highlightSelector='[data-help-target="behaviorEditor"]' />
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {t('behaviorEditor.sceneStates', { scene: scene.name, count: states.length })}
        </p>
      </div>

      {/* State tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-700 overflow-x-auto">
        {states.map((state) => (
          <button
            key={state.id}
            onClick={() => setActiveState(activeSceneId, state.id)}
            className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-colors ${
              activeStateId === state.id
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            {state.name}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-1">
          <input
            className="w-20 bg-zinc-900 text-white text-xs px-2 py-1 rounded border border-zinc-600 outline-none focus:border-cyan-500"
            placeholder={t('behaviorEditor.newStatePlaceholder')}
            value={newStateName}
            onChange={(e) => setNewStateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddState();
            }}
          />
          <button
            onClick={handleAddState}
            disabled={!newStateName.trim()}
            className="text-cyan-400 hover:text-cyan-300 text-xs px-1 disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      {/* Active state editor */}
      <div className="flex-1 overflow-y-auto">
        {activeStateId ? (
          <ActiveStateEditor
            sceneId={activeSceneId}
            state={states.find((s) => s.id === activeStateId)!}
            actors={actors}
            onRename={(name) => renameSceneState(activeSceneId, activeStateId, name)}
            onDelete={() => removeSceneState(activeSceneId, activeStateId)}
            onAddBinding={(binding) => addKeyBinding(activeSceneId, activeStateId, binding)}
            onUpdateBinding={(id, updates) => updateKeyBinding(activeSceneId, activeStateId, id, updates)}
            onRemoveBinding={(id) => removeKeyBinding(activeSceneId, activeStateId, id)}
            isCapturingKey={isCapturingKey && captureTargetStateId === activeStateId}
            onStartCapture={() => handleStartCapture(activeStateId)}
            onStopCapture={() => {
              setIsCapturingKey(false);
              setCaptureTargetStateId(null);
            }}
          />
        ) : (
          <div className="p-4 text-zinc-500 text-sm text-center">
            {t('behaviorEditor.addStatePrompt')}
          </div>
        )}
      </div>
    </div>
  );
}

interface ActiveStateEditorProps {
  sceneId: string;
  state: SceneState;
  actors: { id: string; name: string; role: string }[];
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddBinding: (binding: Omit<KeyBinding, 'id'>) => void;
  onUpdateBinding: (id: string, updates: Partial<KeyBinding>) => void;
  onRemoveBinding: (id: string) => void;
  isCapturingKey: boolean;
  onStartCapture: () => void;
  onStopCapture: () => void;
}

function ActiveStateEditor({
  state,
  actors,
  onRename,
  onDelete,
  onAddBinding,
  onUpdateBinding,
  onRemoveBinding,
  isCapturingKey,
  onStartCapture,
  onStopCapture,
}: ActiveStateEditorProps) {
  const { t } = useI18n();
  const [newKey, setNewKey] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTargetActorId, setNewTargetActorId] = useState<string>('');
  const [showKeyPicker, setShowKeyPicker] = useState(false);

  const handleKeyCapture = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isCapturingKey) return;
      e.preventDefault();
      e.stopPropagation();
      const key = e.key === ' ' ? 'Space' : e.key;
      setNewKey(key);
      onStopCapture();
    },
    [isCapturingKey, onStopCapture],
  );

  const handleAddBinding = () => {
    const key = newKey.trim();
    const description = newDescription.trim();
    if (!key || !description) return;
    onAddBinding({
      key,
      description,
      targetActorId: newTargetActorId || null,
    });
    setNewKey('');
    setNewDescription('');
    setNewTargetActorId('');
  };

  const nonSceneActors = actors.filter((a) => a.role !== 'scene');

  return (
    <div className="p-4 space-y-4">
      {/* State header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            className="bg-transparent text-white text-sm font-semibold outline-none border-b border-transparent focus:border-cyan-500 w-40"
            value={state.name}
            onChange={(e) => onRename(e.target.value)}
          />
          <span className="text-xs text-zinc-600">
            {t('behaviorEditor.bindings', { count: state.keyBindings.length })}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-zinc-800"
        >
          {t('behaviorEditor.deleteState')}
        </button>
      </div>

      {/* Existing bindings */}
      <div className="space-y-2">
        {state.keyBindings.length === 0 ? (
          <div className="text-zinc-500 text-sm text-center py-4 bg-zinc-900 rounded-md border border-zinc-800">
            {t('behaviorEditor.noBindings')}
          </div>
        ) : (
          state.keyBindings.map((binding) => (
            <KeyBindingRow
              key={binding.id}
              binding={binding}
              actors={nonSceneActors}
              onUpdate={(updates) => onUpdateBinding(binding.id, updates)}
              onRemove={() => onRemoveBinding(binding.id)}
            />
          ))
        )}
      </div>

      {/* Add new binding */}
      <div className="bg-zinc-900 rounded-md border border-zinc-700 p-3 space-y-3">
        <div className="text-xs text-zinc-400 font-medium">{t('behaviorEditor.addKeyBinding')}</div>

        {/* Key selection */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              className="w-full bg-zinc-800 text-white text-sm px-3 py-1.5 rounded border border-zinc-600 outline-none focus:border-cyan-500"
              placeholder={isCapturingKey ? t('behaviorEditor.pressKey') : t('behaviorEditor.keyPlaceholder')}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={handleKeyCapture}
              readOnly={isCapturingKey}
            />
          </div>
          <button
            onClick={() => {
              if (isCapturingKey) {
                onStopCapture();
              } else {
                onStartCapture();
              }
            }}
            className={`text-xs px-2 py-1.5 rounded transition-colors ${
              isCapturingKey
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-600'
            }`}
          >
            {isCapturingKey ? t('behaviorEditor.cancelCapture') : t('behaviorEditor.capture')}
          </button>
          <button
            onClick={() => setShowKeyPicker(!showKeyPicker)}
            className="text-xs px-2 py-1.5 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 rounded border border-zinc-600"
          >
            {t('behaviorEditor.list')}
          </button>
        </div>

        {/* Key picker dropdown */}
        {showKeyPicker && (
          <div className="flex flex-wrap gap-1">
            {COMMON_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => {
                  setNewKey(k);
                  setShowKeyPicker(false);
                }}
                className="text-xs px-2 py-1 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded border border-zinc-600"
              >
                {k}
              </button>
            ))}
          </div>
        )}

        {/* Description - natural language */}
        <input
          className="w-full bg-zinc-800 text-white text-sm px-3 py-1.5 rounded border border-zinc-600 outline-none focus:border-cyan-500"
          placeholder={t('behaviorEditor.descPlaceholder')}
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddBinding();
          }}
        />

        {/* Target actor */}
        <select
          className="w-full bg-zinc-800 text-white text-sm px-3 py-1.5 rounded border border-zinc-600 outline-none focus:border-cyan-500"
          value={newTargetActorId}
          onChange={(e) => setNewTargetActorId(e.target.value)}
        >
          <option value="">{t('behaviorEditor.targetActor')}</option>
          {nonSceneActors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </select>

        <button
          onClick={handleAddBinding}
          disabled={!newKey.trim() || !newDescription.trim()}
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-sm py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('behaviorEditor.addBinding')}
        </button>
      </div>
    </div>
  );
}

interface KeyBindingRowProps {
  binding: KeyBinding;
  actors: { id: string; name: string; role: string }[];
  onUpdate: (updates: Partial<KeyBinding>) => void;
  onRemove: () => void;
}

function KeyBindingRow({ binding, actors, onUpdate, onRemove }: KeyBindingRowProps) {
  const { t } = useI18n();
  const targetActor = actors.find((a) => a.id === binding.targetActorId);

  return (
    <div className="bg-zinc-900 rounded-md p-3 border border-zinc-700 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-zinc-800 text-cyan-400 px-2 py-0.5 rounded border border-zinc-600">
            {binding.key}
          </span>
          <input
            className="bg-transparent text-white text-sm outline-none border-b border-transparent focus:border-zinc-500 flex-1"
            value={binding.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
          />
        </div>
        <button
          onClick={onRemove}
          className="text-red-400 hover:text-red-300 text-xs px-1"
          title="Remove binding"
        >
          x
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">{t('behaviorEditor.target')}</span>
        <select
          className="flex-1 bg-zinc-800 text-xs text-zinc-300 px-2 py-1 rounded border border-zinc-700 outline-none focus:border-cyan-500"
          value={binding.targetActorId ?? ''}
          onChange={(e) => onUpdate({ targetActorId: e.target.value || null })}
        >
          <option value="">{t('behaviorEditor.targetNone')}</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </select>
        {targetActor && (
          <span className="text-xs text-cyan-500">
            → {targetActor.name}
          </span>
        )}
      </div>
    </div>
  );
}
