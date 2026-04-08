import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { ModuleFlowNode } from '../types';
import { MODULE_NODE_COLORS } from '../types';

export const ModuleNode = memo(function ModuleNode({
  data,
  selected,
}: NodeProps<ModuleFlowNode>) {
  const c = MODULE_NODE_COLORS;
  const categoryIcon = data.category === 'System' ? '\u{1F527}' : '\u{1F3AE}';

  return (
    <div
      className={cn(
        'rounded-lg border shadow-lg min-w-[200px] max-w-[280px]',
        c.bg,
        c.border,
        selected && 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900',
      )}
    >
      {/* Header */}
      <div className={cn('px-3 py-2 rounded-t-lg flex items-center gap-2', c.header)}>
        <span className="text-xs">{categoryIcon}</span>
        <span className="text-sm font-bold text-white truncate flex-1">
          {data.name}
        </span>
        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white/80">
          {data.category}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Domain label */}
        {data.domain && (
          <div className="text-[10px] text-violet-400">
            domain: {data.domain}
          </div>
        )}

        {/* Tasks */}
        {data.taskNames.length > 0 && (
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
              Tasks
            </div>
            <div className="space-y-0.5">
              {data.taskNames.map((name) => (
                <div
                  key={name}
                  className="text-[11px] text-zinc-300 flex items-center gap-1"
                >
                  <span className="text-violet-400">&#x25CF;</span>
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Variables */}
        {data.variableNames.length > 0 && (
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
              Variables
            </div>
            <div className="flex flex-wrap gap-1">
              {data.variableNames.map((name) => (
                <span
                  key={name}
                  className="text-[11px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-violet-400 !border-violet-600"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-violet-400 !border-violet-600"
      />
    </div>
  );
});
