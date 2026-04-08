import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { ActorDetailFlowNode } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
  UI: 'text-amber-400',
  Logic: 'text-cyan-400',
  System: 'text-violet-400',
  GameObject: 'text-rose-400',
};

export const ActorDetailNode = memo(function ActorDetailNode({
  data,
  selected,
}: NodeProps<ActorDetailFlowNode>) {
  return (
    <div
      className={cn(
        'rounded-xl border-2 shadow-2xl min-w-[300px] max-w-[420px]',
        'bg-green-950 border-green-400',
        selected && 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900',
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 rounded-t-xl bg-green-600 flex items-center gap-2">
        <span className="text-base font-bold text-white truncate flex-1">
          {data.name}
        </span>
        {data.isRoot && (
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white/80">
            root
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Components by category */}
        {data.componentsByCategory.map(({ category, components }) => (
          <div key={category}>
            <div className={cn('text-[11px] font-semibold uppercase tracking-wider mb-1', CATEGORY_COLORS[category] ?? 'text-zinc-400')}>
              {category}
            </div>
            <div className="space-y-1.5">
              {components.map((comp) => (
                <div key={comp.name} className="bg-zinc-800/60 rounded px-2 py-1.5">
                  <div className="text-[12px] text-zinc-200 font-medium">{comp.name}</div>
                  {comp.taskNames.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {comp.taskNames.map((t) => (
                        <span key={t} className="text-[10px] bg-zinc-700 text-zinc-300 px-1 py-0.5 rounded">
                          {t}()
                        </span>
                      ))}
                    </div>
                  )}
                  {comp.variableNames.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {comp.variableNames.map((v) => (
                        <span key={v} className="text-[10px] bg-zinc-700/60 text-zinc-400 px-1 py-0.5 rounded italic">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Sequences */}
        {data.sequenceStepNames.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1 text-orange-400">
              Sequences
            </div>
            <div className="flex flex-wrap gap-1">
              {data.sequenceStepNames.map((name, i) => (
                <span
                  key={name}
                  className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded"
                >
                  {i + 1}. {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Child count */}
        {data.childCount > 0 && (
          <div className="text-[11px] text-zinc-400">
            {data.childCount} child actor{data.childCount > 1 ? 's' : ''}
          </div>
        )}

        {/* Sub-scene */}
        {data.subSceneName && (
          <div className="text-[11px] text-blue-400 flex items-center gap-1">
            <span className="text-blue-500">&#x25B6;</span>
            {data.subSceneName}
          </div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-green-400 !border-green-600"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-400 !border-green-600"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-3 !h-3 !bg-green-400 !border-green-600"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-3 !h-3 !bg-green-400 !border-green-600"
      />
    </div>
  );
});
