import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { useI18n } from '@/hooks/useI18n';
import type { ActorNodeData } from '../types/nodes';
import { ROLE_COLORS } from '../types/nodes';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, string> = {
  UI: '🖼️',
  Logic: '🎮',
  System: '🔧',
  GameObject: '📦',
};

export const ActorNode = memo(function ActorNode({ data, selected }: NodeProps) {
  const { t } = useI18n();
  const nodeData = data as unknown as ActorNodeData;
  const components = useProjectStore((s) => s.project.components);
  const scenes = useProjectStore((s) => s.project.scenes);
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const activeScene = activeSceneId ? scenes[activeSceneId] : null;
  const actor = activeScene?.actors[nodeData.actorId];
  const openComponentPicker = useEditorStore((s) => s.openComponentPicker);
  const openSequenceEditor = useEditorStore((s) => s.openSequenceEditor);
  const openSubScenePicker = useEditorStore((s) => s.openSubScenePicker);
  const copyToClipboard = useEditorStore((s) => s.copyToClipboard);
  const duplicateActor = useProjectStore((s) => s.duplicateActor);
  const createPrefab = useProjectStore((s) => s.createPrefab);
  const prefabs = useProjectStore((s) => s.project.prefabs);
  const colors = ROLE_COLORS[nodeData.role];

  const attachedComponents = nodeData.componentIds
    .map((id) => components[id])
    .filter(Boolean);

  // Collect all ports from attached components' tasks
  const inputPorts: { name: string; type: string }[] = [];
  const outputPorts: { name: string; type: string }[] = [];
  for (const comp of attachedComponents) {
    for (const task of comp.tasks) {
      for (const input of task.inputs) {
        inputPorts.push(input);
      }
      for (const output of task.outputs) {
        outputPorts.push(output);
      }
    }
  }

  const subSceneName = actor?.subSceneId ? scenes[actor.subSceneId]?.name : null;
  const sequenceCount = actor?.sequences?.length ?? 0;
  const prefabName = actor?.prefabId ? prefabs[actor.prefabId]?.name : null;

  return (
    <div
      className={cn(
        'rounded-lg border-2 min-w-[220px] shadow-lg',
        colors.bg,
        colors.border,
        selected && 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900',
      )}
    >
      {/* Header */}
      <div className={cn('px-3 py-2 rounded-t-md flex items-center justify-between', colors.header)}>
        <span className="text-white font-semibold text-sm truncate">{nodeData.name}</span>
        <div className="flex items-center gap-1 ml-2">
          {prefabName && (
            <span className="text-white/50 text-[10px] bg-white/10 px-1 rounded">P</span>
          )}
          <span className="text-white/70 text-xs">[{nodeData.role}]</span>
        </div>
      </div>

      {/* Prefab indicator */}
      {prefabName && (
        <div className="px-3 py-1 border-t border-zinc-700">
          <div className="text-purple-400 text-[10px]">{t('actorNode.prefab', { name: prefabName })}</div>
        </div>
      )}

      {/* Components */}
      <div className="px-3 py-2 border-t border-zinc-700">
        <div className="text-zinc-400 text-xs mb-1">{t('actorNode.components')}</div>
        {attachedComponents.length > 0 ? (
          <div className="space-y-1">
            {attachedComponents.map((comp) => (
              <div key={comp.id} className="flex items-center gap-1 text-xs text-zinc-300">
                <span>{CATEGORY_ICONS[comp.category] ?? '📎'}</span>
                <span className="truncate">{comp.name}</span>
                <span className="text-zinc-500 ml-auto">[{comp.category}]</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-600 text-xs italic">{t('actorNode.noComponents')}</div>
        )}
        <button
          className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            openComponentPicker(nodeData.actorId);
          }}
        >
          {t('actorNode.addComponent')}
        </button>
      </div>

      {/* Sequences */}
      <div className="px-3 py-2 border-t border-zinc-700">
        <div className="flex items-center justify-between">
          <div className="text-zinc-400 text-xs">
            {t('actorNode.sequences')} {sequenceCount > 0 ? `(${sequenceCount})` : ''}
          </div>
          <button
            className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              openSequenceEditor(nodeData.actorId);
            }}
          >
            {t('actorNode.editSequences')}
          </button>
        </div>
        {sequenceCount > 0 && actor?.sequences && (
          <div className="mt-1 space-y-0.5">
            {actor.sequences.slice(0, 3).map((step) => (
              <div key={step.id} className="text-[10px] text-zinc-500 truncate">
                {step.order + 1}. {step.name}
              </div>
            ))}
            {sequenceCount > 3 && (
              <div className="text-[10px] text-zinc-600">{t('actorNode.moreSequences', { count: sequenceCount - 3 })}</div>
            )}
          </div>
        )}
      </div>

      {/* SubScene */}
      <div className="px-3 py-1.5 border-t border-zinc-700">
        <div className="flex items-center justify-between">
          <div className="text-zinc-400 text-xs">
            {t('actorNode.subScene')} {subSceneName ? <span className="text-cyan-400">{subSceneName}</span> : <span className="text-zinc-600 italic">{t('actorNode.none')}</span>}
          </div>
          <button
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              openSubScenePicker(nodeData.actorId);
            }}
          >
            {t('actorNode.setSubScene')}
          </button>
        </div>
      </div>

      {/* Actions: Copy, Duplicate, Save as Prefab */}
      <div className="px-3 py-1.5 border-t border-zinc-700 flex gap-1 flex-wrap">
        <button
          className="text-[10px] text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (actor) copyToClipboard([actor]);
          }}
          title={t('actorNode.copyActor')}
        >
          {t('actorNode.copy')}
        </button>
        <button
          className="text-[10px] text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (activeSceneId) duplicateActor(activeSceneId, nodeData.actorId);
          }}
          title={t('actorNode.duplicateActor')}
        >
          {t('actorNode.duplicate')}
        </button>
        <button
          className="text-[10px] text-purple-400 hover:text-purple-300 bg-zinc-800 hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (activeSceneId) {
              const name = prompt(t('actorNode.prefabNamePrompt'), nodeData.name);
              if (name) createPrefab(name, activeSceneId, nodeData.actorId);
            }
          }}
          title={t('actorNode.savePrefab')}
        >
          {t('actorNode.savePrefabBtn')}
        </button>
      </div>

      {/* Ports */}
      {(inputPorts.length > 0 || outputPorts.length > 0) && (
        <div className="px-3 py-2 border-t border-zinc-700 flex justify-between text-xs">
          <div className="space-y-1">
            {inputPorts.map((port, i) => (
              <div key={`in-${i}`} className="text-zinc-400 flex items-center gap-1">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`input-${port.name}`}
                  className="!w-2.5 !h-2.5 !bg-blue-400 !border-blue-600"
                  style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none' }}
                />
                <span>{port.name}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {outputPorts.map((port, i) => (
              <div key={`out-${i}`} className="text-zinc-400 flex items-center gap-1">
                <span>{port.name}</span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`output-${port.name}`}
                  className="!w-2.5 !h-2.5 !bg-green-400 !border-green-600"
                  style={{ position: 'relative', top: 'auto', right: 'auto', transform: 'none' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Default handles when no ports */}
      {inputPorts.length === 0 && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-blue-400 !border-blue-600"
        />
      )}
      {outputPorts.length === 0 && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-green-400 !border-green-600"
        />
      )}
    </div>
  );
});
