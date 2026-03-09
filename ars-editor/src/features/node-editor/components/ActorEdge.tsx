import { memo } from 'react';
import { getBezierPath, type EdgeProps } from '@xyflow/react';

export const ActorEdge = memo(function ActorEdge({
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
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: selected ? '#60a5fa' : '#6b7280',
        strokeWidth: selected ? 2.5 : 1.5,
        ...style,
      }}
    />
  );
});
