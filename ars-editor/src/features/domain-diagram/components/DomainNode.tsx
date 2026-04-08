import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { DomainFlowNode } from '../types';
import { DOMAIN_NODE_COLORS } from '../types';

export const DomainNode = memo(function DomainNode({
  data,
  selected,
}: NodeProps<DomainFlowNode>) {
  const c = DOMAIN_NODE_COLORS;

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
        <span className="text-sm font-bold text-white truncate flex-1">
          {data.name}
        </span>
        {data.isRoot && (
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white/80">
            root
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Attached components */}
        {data.componentNames.length > 0 && (
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
              Components
            </div>
            <div className="flex flex-wrap gap-1">
              {data.componentNames.map((name) => (
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

        {/* Child count */}
        {data.childCount > 0 && (
          <div className="text-[11px] text-zinc-400">
            {data.childCount} child actor{data.childCount > 1 ? 's' : ''}
          </div>
        )}

        {/* Sub-scene reference */}
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
        className="!w-2.5 !h-2.5 !bg-green-400 !border-green-600"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-green-400 !border-green-600"
      />
    </div>
  );
});
