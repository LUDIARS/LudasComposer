import { memo, useState, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import type { ActorFlowNode } from '../types/nodes';
import type { ActorType } from '@/types/domain';
import { ROLE_COLORS, ACTOR_TYPE_COLORS, ACTOR_TYPE_LABELS } from '../types/nodes';
import { cn } from '@/lib/utils';

export const ActorNode = memo(function ActorNode({ data, selected }: NodeProps<ActorFlowNode>) {
  const nodeData = data;
  const scenes = useProjectStore((s) => s.project.scenes);
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const activeScene = activeSceneId ? scenes[activeSceneId] : null;
  const actor = activeScene?.actors[nodeData.actorId];
  const openSubScenePicker = useEditorStore((s) => s.openSubScenePicker);
  const copyToClipboard = useEditorStore((s) => s.copyToClipboard);
  const messageSourceActorId = useEditorStore((s) => s.messageSourceActorId);
  const startMessageCreation = useEditorStore((s) => s.startMessageCreation);
  const cancelMessageCreation = useEditorStore((s) => s.cancelMessageCreation);
  const addMessage = useProjectStore((s) => s.addMessage);

  const isTargetSelectionMode = messageSourceActorId !== null;
  const isSource = messageSourceActorId === nodeData.actorId;
  const isSelectableTarget = isTargetSelectionMode && !isSource;
  const duplicateActor = useProjectStore((s) => s.duplicateActor);
  const createPrefab = useProjectStore((s) => s.createPrefab);
  const setActorType = useProjectStore((s) => s.setActorType);
  const renameActor = useProjectStore((s) => s.renameActor);
  const colors = ROLE_COLORS[nodeData.role];

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    setEditName(nodeData.name);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [nodeData.name]);

  const commitName = useCallback(() => {
    setEditing(false);
    const trimmed = editName.trim();
    if (trimmed && trimmed !== nodeData.name && activeSceneId) {
      renameActor(activeSceneId, nodeData.actorId, trimmed);
    }
  }, [editName, nodeData.name, nodeData.actorId, activeSceneId, renameActor]);

  const subSceneName = actor?.subSceneId ? scenes[actor.subSceneId]?.name : null;
  const actorType = (actor?.actorType ?? 'simple') as ActorType;
  const typeColors = ACTOR_TYPE_COLORS[actorType];
  const requirements = actor?.requirements;

  return (
    <div
      className={cn(
        'rounded-lg border-2 min-w-[260px] max-w-[340px] shadow-lg',
        colors.bg,
        colors.border,
        selected && 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900',
        isSource && 'ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-900',
        isSelectableTarget && 'ring-2 ring-blue-400/50 ring-offset-1 ring-offset-zinc-900 cursor-pointer',
      )}
    >
      {/* Header */}
      <div className={cn('px-3 py-2 rounded-t-md flex items-center justify-between', colors.header)}>
        {editing ? (
          <input
            ref={inputRef}
            className="bg-transparent text-white font-semibold text-sm border-b border-white/50 outline-none w-full mr-2"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span
            className="text-white font-semibold text-sm truncate cursor-text"
            onDoubleClick={startEditing}
          >
            {nodeData.name}
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-2">
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', typeColors.badge, typeColors.text)}>
            {ACTOR_TYPE_LABELS[actorType]}
          </span>
        </div>
      </div>

      {/* Actor Type Selector */}
      <div className="px-3 py-1.5 border-t border-zinc-700 flex items-center gap-1">
        {(['simple', 'state', 'flexible'] as ActorType[]).map((type) => (
          <button
            key={type}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded transition-colors',
              actorType === type
                ? `${ACTOR_TYPE_COLORS[type].badge} ${ACTOR_TYPE_COLORS[type].text}`
                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300',
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (activeSceneId && actor) {
                setActorType(activeSceneId, actor.id, type);
              }
            }}
          >
            {ACTOR_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Requirements */}
      <div className="px-3 py-2 border-t border-zinc-700 space-y-1">
        <div className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider">Requirements</div>
        {requirements && (requirements.overview?.length || requirements.goals?.length || requirements.role?.length || requirements.behavior?.length) ? (
          <div className="space-y-0.5">
            {requirements.overview?.length > 0 && (
              <div className="text-xs text-zinc-300">
                <span className="text-zinc-500">概要: </span>
                {requirements.overview.map((item, i) => <div key={i} className="truncate pl-3">• {item}</div>)}
              </div>
            )}
            {requirements.goals?.length > 0 && (
              <div className="text-xs text-zinc-300">
                <span className="text-zinc-500">達成: </span>
                {requirements.goals.map((item, i) => <div key={i} className="truncate pl-3">• {item}</div>)}
              </div>
            )}
            {requirements.role?.length > 0 && (
              <div className="text-xs text-zinc-300">
                <span className="text-zinc-500">役割: </span>
                {requirements.role.map((item, i) => <div key={i} className="truncate pl-3">• {item}</div>)}
              </div>
            )}
            {requirements.behavior?.length > 0 && (
              <div className="text-xs text-zinc-300">
                <span className="text-zinc-500">挙動: </span>
                {requirements.behavior.map((item, i) => <div key={i} className="truncate pl-3">• {item}</div>)}
              </div>
            )}
          </div>
        ) : (
          <div className="text-zinc-600 text-xs italic">未定義</div>
        )}
      </div>

      {/* State type: show state machine states */}
      {actorType === 'state' && actor && (
        <div className="px-3 py-2 border-t border-zinc-700">
          <div className="text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
            States ({actor.actorStates?.length ?? 0})
          </div>
          {actor.actorStates && actor.actorStates.length > 0 ? (
            <div className="mt-1 space-y-0.5">
              {actor.actorStates.slice(0, 4).map((state) => (
                <div key={state.id} className="text-[10px] text-zinc-400 truncate">
                  <span className="text-amber-500/70">&#9679;</span> {state.name}
                  {state.processes.length > 0 && (
                    <span className="text-zinc-600 ml-1">({state.processes.length})</span>
                  )}
                </div>
              ))}
              {actor.actorStates.length > 4 && (
                <div className="text-[10px] text-zinc-600">+{actor.actorStates.length - 4} more</div>
              )}
            </div>
          ) : (
            <div className="text-zinc-600 text-[10px] italic mt-0.5">No states defined</div>
          )}
        </div>
      )}

      {/* Flexible type: show content preview */}
      {actorType === 'flexible' && actor && (
        <div className="px-3 py-2 border-t border-zinc-700">
          <div className="text-purple-400 text-[10px] font-semibold uppercase tracking-wider">Free Content</div>
          {actor.flexibleContent ? (
            <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-3 whitespace-pre-wrap">
              {actor.flexibleContent}
            </div>
          ) : (
            <div className="text-zinc-600 text-[10px] italic mt-0.5">No content</div>
          )}
        </div>
      )}

      {/* Displays (表示物) */}
      {actor && (actor.displays?.length ?? 0) > 0 && (
        <div className="px-3 py-2 border-t border-zinc-700">
          <div className="text-orange-400 text-[10px] font-semibold uppercase tracking-wider">
            Displays ({actor.displays.length})
          </div>
          <div className="mt-1 space-y-0.5">
            {actor.displays.slice(0, 4).map((display) => (
              <div key={display.id} className="text-[10px] text-zinc-400 truncate">
                <span className="text-orange-500/70">&#9632;</span> {display.name}
                {display.satisfies.length > 0 && (
                  <span className="text-zinc-600 ml-1">({display.satisfies.length} req)</span>
                )}
              </div>
            ))}
            {actor.displays.length > 4 && (
              <div className="text-[10px] text-zinc-600">+{actor.displays.length - 4} more</div>
            )}
          </div>
        </div>
      )}

      {/* SubScene */}
      {subSceneName && (
        <div className="px-3 py-1.5 border-t border-zinc-700">
          <div className="text-zinc-400 text-xs">
            Sub: <span className="text-cyan-400">{subSceneName}</span>
          </div>
        </div>
      )}

      {/* ターゲット選択モード: このノードをターゲットとして選択 */}
      {isSelectableTarget && (
        <div className="px-3 py-2 border-t border-zinc-700">
          <button
            className="w-full text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2 py-1.5 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (activeSceneId && messageSourceActorId) {
                addMessage(activeSceneId, {
                  sourceDomainId: messageSourceActorId,
                  targetDomainId: nodeData.actorId,
                  name: '',
                  description: '',
                  messageType: 'simple',
                });
                cancelMessageCreation();
              }
            }}
          >
            ← このアクターに接続
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 py-1.5 border-t border-zinc-700 flex gap-1 flex-wrap">
        <button
          className="text-[10px] text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (actor) copyToClipboard([actor]);
          }}
        >
          Copy
        </button>
        <button
          className="text-[10px] text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (activeSceneId) duplicateActor(activeSceneId, nodeData.actorId);
          }}
        >
          Duplicate
        </button>
        <button
          className="text-[10px] text-purple-400 hover:text-purple-300 bg-zinc-800 hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (activeSceneId) {
              const name = prompt('Prefab name:', nodeData.name);
              if (name) createPrefab(name, activeSceneId, nodeData.actorId);
            }
          }}
        >
          Prefab
        </button>
        <button
          className="text-[10px] text-cyan-400 hover:text-cyan-300 bg-zinc-800 hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            openSubScenePicker(nodeData.actorId);
          }}
        >
          SubScene
        </button>
        {!isTargetSelectionMode ? (
          <button
            className="text-[10px] text-blue-400 hover:text-blue-300 bg-zinc-800 hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              startMessageCreation(nodeData.actorId);
            }}
          >
            + Message
          </button>
        ) : isSource ? (
          <button
            className="text-[10px] text-red-400 hover:text-red-300 bg-zinc-800 hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              cancelMessageCreation();
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>

      {/* Connection handles (minimal style — edges use arrow markers) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-zinc-500 !border-zinc-600 !opacity-0 hover:!opacity-100 !transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-zinc-500 !border-zinc-600 !opacity-0 hover:!opacity-100 !transition-opacity"
      />
    </div>
  );
});
