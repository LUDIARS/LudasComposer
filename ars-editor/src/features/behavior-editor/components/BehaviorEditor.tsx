import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';
import type { ActorType, ActorState } from '@/types/domain';

export function BehaviorEditor() {
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const scenes = useProjectStore((s) => s.project.scenes);
  const setActorRequirements = useProjectStore((s) => s.setActorRequirements);
  const setActorType = useProjectStore((s) => s.setActorType);
  const setFlexibleContent = useProjectStore((s) => s.setFlexibleContent);
  const addActorState = useProjectStore((s) => s.addActorState);
  const removeActorState = useProjectStore((s) => s.removeActorState);
  const updateActorState = useProjectStore((s) => s.updateActorState);
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds);

  if (!activeSceneId) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm p-4">
        Select a scene
      </div>
    );
  }

  const scene = scenes[activeSceneId];
  if (!scene) return null;

  // Get the first selected actor
  const actorId = selectedNodeIds[0];
  const actor = actorId ? scene.actors[actorId] : null;

  if (!actor) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
            Domain Editor
            <HelpTooltip content={helpContent.behaviorEditor} position="bottom" highlightSelector='[data-help-target="behaviorEditor"]' />
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm p-4">
          Select a domain node to edit
        </div>
      </div>
    );
  }

  const actorType = (actor.actorType ?? 'simple') as ActorType;
  const req = actor.requirements ?? { overview: '', goals: '', role: '', behavior: '' };

  const handleReqChange = (field: string, value: string) => {
    setActorRequirements(activeSceneId, actorId, { ...req, [field]: value });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-700">
        <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
          Domain Editor
          <HelpTooltip content={helpContent.behaviorEditor} position="bottom" highlightSelector='[data-help-target="behaviorEditor"]' />
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">{actor.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Actor Type */}
        <div className="px-4 py-3 border-b border-zinc-700">
          <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-2">Type</div>
          <div className="flex gap-1">
            {(['simple', 'state', 'flexible'] as ActorType[]).map((type) => (
              <button
                key={type}
                onClick={() => setActorType(activeSceneId, actorId, type)}
                className={`text-xs px-3 py-1.5 rounded transition-colors ${
                  actorType === type
                    ? type === 'simple' ? 'bg-zinc-600 text-white' :
                      type === 'state' ? 'bg-amber-600 text-white' :
                      'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div className="px-4 py-3 border-b border-zinc-700 space-y-2">
          <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Requirements</div>
          <RequirementsField label="概要 (Overview)" value={req.overview} onChange={(v) => handleReqChange('overview', v)} />
          <RequirementsField label="達成する事 (Goals)" value={req.goals} onChange={(v) => handleReqChange('goals', v)} />
          <RequirementsField label="役割 (Role)" value={req.role} onChange={(v) => handleReqChange('role', v)} />
          <RequirementsField label="挙動 (Behavior)" value={req.behavior} onChange={(v) => handleReqChange('behavior', v)} multiline />
        </div>

        {/* State Machine Editor (State type only) */}
        {actorType === 'state' && (
          <div className="px-4 py-3 border-b border-zinc-700 space-y-2">
            <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">State Machine</div>
            <StateEditor
              states={actor.actorStates ?? []}
              onAddState={(name) => addActorState(activeSceneId, actorId, name)}
              onRemoveState={(stateId) => removeActorState(activeSceneId, actorId, stateId)}
              onUpdateState={(stateId, updates) => updateActorState(activeSceneId, actorId, stateId, updates)}
            />
          </div>
        )}

        {/* Flexible Content (Flexible type only) */}
        {actorType === 'flexible' && (
          <div className="px-4 py-3 space-y-2">
            <div className="text-xs text-purple-400 font-semibold uppercase tracking-wider">Free Content</div>
            <textarea
              value={actor.flexibleContent ?? ''}
              onChange={(e) => setFlexibleContent(activeSceneId, actorId, e.target.value)}
              placeholder="自由に記述..."
              rows={10}
              className="w-full bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RequirementsField({ label, value, onChange, multiline }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] text-zinc-500 block mb-0.5">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
        />
      )}
    </div>
  );
}

function StateEditor({ states, onAddState, onRemoveState, onUpdateState }: {
  states: ActorState[];
  onAddState: (name: string) => void;
  onRemoveState: (stateId: string) => void;
  onUpdateState: (stateId: string, updates: Partial<ActorState>) => void;
}) {
  const [newStateName, setNewStateName] = useState('');
  const [newProcessMap, setNewProcessMap] = useState<Record<string, string>>({});

  const handleAddState = () => {
    const name = newStateName.trim();
    if (!name) return;
    onAddState(name);
    setNewStateName('');
  };

  const handleAddProcess = (stateId: string) => {
    const text = (newProcessMap[stateId] ?? '').trim();
    if (!text) return;
    const state = states.find((s) => s.id === stateId);
    if (!state) return;
    onUpdateState(stateId, { processes: [...state.processes, text] });
    setNewProcessMap({ ...newProcessMap, [stateId]: '' });
  };

  const handleRemoveProcess = (stateId: string, index: number) => {
    const state = states.find((s) => s.id === stateId);
    if (!state) return;
    onUpdateState(stateId, { processes: state.processes.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-2">
      {states.map((state) => (
        <div key={state.id} className="bg-zinc-900 rounded border border-zinc-700 p-2">
          <div className="flex items-center justify-between mb-1">
            <input
              className="bg-transparent text-amber-300 text-sm font-medium outline-none border-b border-transparent focus:border-amber-500 flex-1"
              value={state.name}
              onChange={(e) => onUpdateState(state.id, { name: e.target.value })}
            />
            <button
              onClick={() => onRemoveState(state.id)}
              className="text-red-400 hover:text-red-300 text-xs px-1"
            >
              x
            </button>
          </div>
          {/* Processes */}
          <div className="space-y-0.5 mt-1">
            {state.processes.map((proc, idx) => (
              <div key={idx} className="flex items-center gap-1 text-[11px] text-zinc-300">
                <span className="text-zinc-600">{idx + 1}.</span>
                <span className="flex-1">{proc}</span>
                <button
                  onClick={() => handleRemoveProcess(state.id, idx)}
                  className="text-zinc-600 hover:text-red-400 text-[10px]"
                >
                  x
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            <input
              className="flex-1 bg-zinc-800 text-white text-[11px] px-2 py-1 rounded border border-zinc-700 outline-none focus:border-amber-500"
              placeholder="Add process..."
              value={newProcessMap[state.id] ?? ''}
              onChange={(e) => setNewProcessMap({ ...newProcessMap, [state.id]: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddProcess(state.id); }}
            />
            <button
              onClick={() => handleAddProcess(state.id)}
              className="text-amber-400 text-xs px-1"
            >
              +
            </button>
          </div>
        </div>
      ))}

      {/* Add new state */}
      <div className="flex gap-1">
        <input
          className="flex-1 bg-zinc-800 text-white text-xs px-2 py-1.5 rounded border border-zinc-700 outline-none focus:border-amber-500"
          placeholder="New state name..."
          value={newStateName}
          onChange={(e) => setNewStateName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddState(); }}
        />
        <button
          onClick={handleAddState}
          disabled={!newStateName.trim()}
          className="text-amber-400 hover:text-amber-300 text-xs px-2 py-1.5 bg-zinc-800 rounded border border-zinc-700 disabled:opacity-30"
        >
          + State
        </button>
      </div>
    </div>
  );
}
