import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { SceneRefFlowNode } from '../types';
import { SCENE_REF_NODE_COLORS } from '../types';

export const SceneRefNode = memo(function SceneRefNode({
  data,
  selected,
}: NodeProps<SceneRefFlowNode>) {
  const c = SCENE_REF_NODE_COLORS;

  return (
    <div
      className={cn(
        'rounded-lg border shadow-lg min-w-[160px] border-dashed',
        c.bg,
        c.border,
        selected && 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900',
      )}
    >
      <div className={cn('px-3 py-2 rounded-t-lg flex items-center gap-2', c.header)}>
        <span className="text-xs">&#x25B6;</span>
        <span className="text-sm font-bold text-white truncate">
          {data.sceneName}
        </span>
      </div>
      <div className="px-3 py-1.5">
        <div className="text-[10px] text-blue-400">Scene Reference</div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-blue-400 !border-blue-600"
      />
    </div>
  );
});
