import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { ActorDetailFlowNode } from '../types';

const TYPE_COLORS: Record<string, string> = {
  simple: 'text-zinc-400',
  state: 'text-amber-400',
  flexible: 'text-purple-400',
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
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium bg-white/20', TYPE_COLORS[data.actorType])}>
          {data.actorType}
        </span>
        {data.isRoot && (
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white/80">
            root
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Requirements */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1 text-zinc-400">
            Requirements
          </div>
          <div className="space-y-1">
            {data.overview && (
              <div className="text-[11px] text-zinc-300">
                <span className="text-zinc-500">概要: </span>{data.overview}
              </div>
            )}
            {data.goals && (
              <div className="text-[11px] text-zinc-300">
                <span className="text-zinc-500">達成: </span>{data.goals}
              </div>
            )}
            {data.role && (
              <div className="text-[11px] text-zinc-300">
                <span className="text-zinc-500">役割: </span>{data.role}
              </div>
            )}
            {data.behavior && (
              <div className="text-[11px] text-zinc-300">
                <span className="text-zinc-500">挙動: </span>{data.behavior}
              </div>
            )}
          </div>
        </div>

        {/* State machine states */}
        {data.actorType === 'state' && data.stateNames.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1 text-amber-400">
              States
            </div>
            <div className="flex flex-wrap gap-1">
              {data.stateNames.map((name) => (
                <span
                  key={name}
                  className="text-[10px] bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Flexible content preview */}
        {data.actorType === 'flexible' && data.flexibleContentPreview && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1 text-purple-400">
              Free Content
            </div>
            <div className="text-[10px] text-zinc-400 bg-zinc-800/60 rounded px-2 py-1 whitespace-pre-wrap">
              {data.flexibleContentPreview}
            </div>
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
