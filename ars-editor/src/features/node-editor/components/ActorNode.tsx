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
  const removeActor = useProjectStore((s) => s.removeActor);
  const duplicateActor = useProjectStore((s) => s.duplicateActor);
  const createPrefab = useProjectStore((s) => s.createPrefab);
  const renameActor = useProjectStore((s) => s.renameActor);
  const setActorRequirements = useProjectStore((s) => s.setActorRequirements);
  const messageSourceActorId = useEditorStore((s) => s.messageSourceActorId);
  const startMessageCreation = useEditorStore((s) => s.startMessageCreation);
  const cancelMessageCreation = useEditorStore((s) => s.cancelMessageCreation);
  const addMessage = useProjectStore((s) => s.addMessage);
  const colors = ROLE_COLORS[nodeData.role];

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Requirements editing
  const [editingReq, setEditingReq] = useState<string | null>(null);
  const [editReqText, setEditReqText] = useState('');
  const reqRef = useRef<HTMLTextAreaElement>(null);

  const isTargetSelectionMode = messageSourceActorId !== null;
  const isSource = messageSourceActorId === nodeData.actorId;
  const isSelectableTarget = isTargetSelectionMode && !isSource;

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

  const startEditReq = useCallback((field: string) => {
    const requirements = actor?.requirements;
    if (!requirements) return;
    const current = (requirements as Record<string, string[]>)[field] ?? [];
    setEditReqText(current.join('\n'));
    setEditingReq(field);
    requestAnimationFrame(() => reqRef.current?.focus());
  }, [actor]);

  const commitReq = useCallback(() => {
    if (!editingReq || !activeSceneId || !actor) return;
    const lines = editReqText.split('\n').map(s => s.trim()).filter(Boolean);
    setActorRequirements(activeSceneId, nodeData.actorId, {
      ...actor.requirements,
      [editingReq]: lines,
    });
    setEditingReq(null);
  }, [editingReq, editReqText, activeSceneId, nodeData.actorId, actor, setActorRequirements]);

  const subSceneName = actor?.subSceneId ? scenes[actor.subSceneId]?.name : null;
  const actorType = (actor?.actorType ?? 'simple') as ActorType;
  const typeColors = ACTOR_TYPE_COLORS[actorType];
  const requirements = actor?.requirements;

  const REQ_FIELDS = [
    { key: 'overview', label: '概要', color: 'var(--accent)' },
    { key: 'goals', label: '達成', color: 'var(--green)' },
    { key: 'role', label: '役割', color: 'var(--purple)' },
    { key: 'behavior', label: '挙動', color: 'var(--orange)' },
  ];

  return (
    <div
      className={cn(
        'rounded-lg border-2 min-w-[280px] max-w-[360px] shadow-lg',
        colors.bg,
        colors.border,
        selected && 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900',
        isSource && 'ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-900',
        isSelectableTarget && 'ring-2 ring-blue-400/50 ring-offset-1 ring-offset-zinc-900 cursor-pointer',
      )}
    >
      {/* Header */}
      <div className={cn('px-3 py-2.5 rounded-t-md flex items-center justify-between', colors.header)}>
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
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium ml-2 shrink-0', typeColors.badge, typeColors.text)}>
          {ACTOR_TYPE_LABELS[actorType]}
        </span>
      </div>

      {/* Requirements (メイン、タップで編集) */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Requirements
        </div>
        <div className="space-y-2">
          {REQ_FIELDS.map(({ key, label, color }) => {
            const items = requirements ? (requirements as Record<string, string[]>)[key] ?? [] : [];
            const isEditingThis = editingReq === key;

            return (
              <div key={key}>
                <div
                  className="flex items-center gap-1.5 mb-0.5 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); startEditReq(key); }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs font-medium" style={{ color }}>{label}</span>
                </div>

                {isEditingThis ? (
                  <textarea
                    ref={reqRef}
                    className="w-full text-xs rounded px-2 py-1.5 resize-none"
                    style={{
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      border: `1px solid ${color}`,
                      outline: 'none',
                    }}
                    rows={3}
                    value={editReqText}
                    onChange={(e) => setEditReqText(e.target.value)}
                    onBlur={commitReq}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setEditingReq(null); }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="1行に1項目..."
                  />
                ) : items.length > 0 ? (
                  <div
                    className="pl-3 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors hover:bg-white/5"
                    onClick={(e) => { e.stopPropagation(); startEditReq(key); }}
                  >
                    {items.map((item, i) => (
                      <div key={i} className="text-xs truncate" style={{ color: 'var(--text)' }}>
                        • {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="pl-3 text-xs italic cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={(e) => { e.stopPropagation(); startEditReq(key); }}
                  >
                    タップして追加...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* State type: show states */}
      {actorType === 'state' && actor && (
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
            States ({actor.actorStates?.length ?? 0})
          </div>
          {actor.actorStates && actor.actorStates.length > 0 ? (
            <div className="mt-1 space-y-0.5">
              {actor.actorStates.slice(0, 4).map((state) => (
                <div key={state.id} className="text-[10px] text-zinc-400 truncate">
                  <span className="text-amber-500/70">&#9679;</span> {state.name}
                </div>
              ))}
              {actor.actorStates.length > 4 && (
                <div className="text-[10px] text-zinc-600">+{actor.actorStates.length - 4} more</div>
              )}
            </div>
          ) : (
            <div className="text-zinc-600 text-[10px] italic mt-0.5">No states</div>
          )}
        </div>
      )}

      {/* Displays */}
      {actor && (actor.displays?.length ?? 0) > 0 && (
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-orange-400 text-[10px] font-semibold uppercase tracking-wider">
            Displays ({actor.displays.length})
          </div>
          <div className="mt-1 space-y-0.5">
            {actor.displays.slice(0, 4).map((display) => (
              <div key={display.id} className="text-[10px] text-zinc-400 truncate">
                <span className="text-orange-500/70">&#9632;</span> {display.name}
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
        <div className="px-3 py-1.5" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-zinc-400 text-xs">
            Sub: <span className="text-cyan-400">{subSceneName}</span>
          </div>
        </div>
      )}

      {/* Target selection mode */}
      {isSelectableTarget && (
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            className="w-full text-xs font-semibold py-1.5 rounded transition-colors"
            style={{
              color: 'var(--accent)',
              background: 'rgba(88, 166, 255, 0.1)',
              border: '1px solid rgba(88, 166, 255, 0.3)',
            }}
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

      {/* Actions (小さめ) */}
      <div className="px-2 py-1.5 flex gap-1 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
        {([
          { label: 'Copy', onClick: () => { if (actor) copyToClipboard([actor]); }, color: undefined },
          { label: 'Dup', onClick: () => { if (activeSceneId) duplicateActor(activeSceneId, nodeData.actorId); }, color: undefined },
          { label: 'Prefab', onClick: () => { if (activeSceneId) { const name = prompt('Prefab name:', nodeData.name); if (name) createPrefab(name, activeSceneId, nodeData.actorId); } }, color: 'var(--purple)' },
          { label: 'Sub', onClick: () => openSubScenePicker(nodeData.actorId), color: 'var(--accent)' },
        ] as Array<{ label: string; onClick: () => void; color: string | undefined }>).map(({ label, onClick, color }) => (
          <button
            key={label}
            className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{
              color: color ?? 'var(--text-muted)',
              background: 'transparent',
              border: '1px solid var(--border)',
              fontSize: '9px',
              padding: '2px 6px',
            }}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            {label}
          </button>
        ))}

        {!isTargetSelectionMode ? (
          <button
            className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{ color: 'var(--accent)', background: 'transparent', border: '1px solid var(--border)', fontSize: '9px', padding: '2px 6px' }}
            onClick={(e) => { e.stopPropagation(); startMessageCreation(nodeData.actorId); }}
          >
            + Msg
          </button>
        ) : isSource ? (
          <button
            className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{ color: 'var(--red)', background: 'transparent', border: '1px solid var(--border)', fontSize: '9px', padding: '2px 6px' }}
            onClick={(e) => { e.stopPropagation(); cancelMessageCreation(); }}
          >
            Cancel
          </button>
        ) : null}

        {!nodeData.isRoot && (
          <button
            className="text-[9px] px-1.5 py-0.5 rounded transition-colors ml-auto"
            style={{ color: 'var(--red)', background: 'transparent', border: '1px solid var(--border)', fontSize: '9px', padding: '2px 6px' }}
            onClick={(e) => {
              e.stopPropagation();
              if (!activeSceneId) return;
              const hasData = !!(
                actor &&
                (actor.requirements?.overview?.length ||
                  actor.requirements?.goals?.length ||
                  actor.requirements?.role?.length ||
                  actor.requirements?.behavior?.length ||
                  actor.actorStates?.length ||
                  actor.flexibleContent ||
                  actor.displays?.length ||
                  actor.subSceneId)
              );
              if (hasData) {
                if (!confirm(`「${nodeData.name}」にはデータがあります。削除しますか？`)) return;
              }
              removeActor(activeSceneId, nodeData.actorId);
            }}
          >
            Del
          </button>
        )}
      </div>

      {/* Connection handles */}
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
