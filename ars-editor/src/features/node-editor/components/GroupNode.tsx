import { memo } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from '@xyflow/react';
import type { GroupFlowNode } from '../types/nodes';
import { ROLE_COLORS } from '../types/nodes';
import { cn } from '@/lib/utils';

export const GroupNode = memo(function GroupNode({ data, selected }: NodeProps<GroupFlowNode>) {
  const nodeData = data;
  const colors = ROLE_COLORS[nodeData.role];

  return (
    <div
      className={cn(
        'rounded-lg border-2 min-w-[300px] min-h-[200px] h-full',
        colors.bg,
        colors.border,
        'bg-opacity-30',
        selected && 'ring-2 ring-white',
      )}
    >
      <NodeResizer
        minWidth={300}
        minHeight={200}
        isVisible={selected}
        lineClassName="!border-blue-400"
        handleClassName="!w-2 !h-2 !bg-blue-400 !border-blue-600"
      />
      <div className={cn('px-3 py-1 rounded-t-md', colors.header, 'bg-opacity-80')}>
        <span className="text-white font-semibold text-sm">{nodeData.name}</span>
        <span className="text-white/70 text-xs ml-2">[group]</span>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-400 !border-blue-600"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-400 !border-green-600"
      />
    </div>
  );
});
