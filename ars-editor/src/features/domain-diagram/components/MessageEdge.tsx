import { memo } from 'react';
import { getBezierPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import type { MessageEdgeData } from '../types';

export const MessageEdge = memo(function MessageEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
}: EdgeProps & { data?: MessageEdgeData }) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const description = data?.description ?? '';
  const strokeColor = selected ? '#60a5fa' : (style.stroke as string) ?? '#6b7280';

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 2.5 : 1.5,
          ...style,
        }}
      />
      {/* Edge label */}
      {description && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="bg-zinc-800/90 border border-zinc-600 rounded px-1.5 py-0.5 text-[10px] text-zinc-300 max-w-[160px] truncate whitespace-nowrap">
              {description}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
