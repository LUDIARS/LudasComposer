import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { DomainFlowNode } from '../types';
import { DOMAIN_NODE_COLORS } from '../types';
import { useDomainDiagramContext } from './DomainDiagramContext';

const TYPE_BADGES: Record<string, { bg: string; text: string }> = {
  simple: { bg: 'bg-zinc-600', text: 'text-zinc-300' },
  state: { bg: 'bg-amber-600', text: 'text-amber-300' },
  flexible: { bg: 'bg-purple-600', text: 'text-purple-300' },
};

export const DomainNode = memo(function DomainNode({
  data,
  selected,
}: NodeProps<DomainFlowNode>) {
  const c = DOMAIN_NODE_COLORS;
  const { setFocusActorId } = useDomainDiagramContext();

  const handleDetail = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setFocusActorId(data.actorId);
    },
    [data.actorId, setFocusActorId],
  );

  const badge = TYPE_BADGES[data.actorType] ?? TYPE_BADGES.simple;

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
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', badge.bg, badge.text)}>
          {data.actorType}
        </span>
        {data.isRoot && (
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white/80">
            root
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Overview */}
        {data.overview && (
          <div className="text-[11px] text-zinc-300 truncate">
            {data.overview}
          </div>
        )}

        {/* Sub-scene reference */}
        {data.subSceneName && (
          <div className="text-[11px] text-blue-400 flex items-center gap-1">
            <span className="text-blue-500">&#x25B6;</span>
            {data.subSceneName}
          </div>
        )}

        {/* Detail button */}
        <button
          onClick={handleDetail}
          className="w-full mt-1 text-[11px] text-green-300 hover:text-white bg-green-800/40 hover:bg-green-700/60 px-2 py-1 rounded transition-colors text-center"
        >
          Detail
        </button>
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
