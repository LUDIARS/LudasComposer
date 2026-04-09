import { memo } from 'react';
import { getBezierPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import type { MessageType } from '@/types/generated/MessageType';

export const ActorEdge = memo(function ActorEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = (data ?? {}) as Record<string, unknown>;
  const messageType = (edgeData.messageType as MessageType | undefined) ?? 'simple';
  const name = (edgeData.name as string | undefined) || '';
  const isInterface = messageType === 'interface';

  const strokeColor = selected ? '#60a5fa' : '#6b7280';
  const markerId = `marker-${id}`;

  return (
    <>
      {/* カスタム SVG マーカー定義 */}
      <defs>
        {isInterface ? (
          // Interface: 白抜き三角 (▷)
          <marker
            id={markerId}
            viewBox="0 0 12 12"
            refX="10"
            refY="6"
            markerWidth="12"
            markerHeight="12"
            orient="auto-start-reverse"
          >
            <path
              d="M 1 1 L 10 6 L 1 11 Z"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
          </marker>
        ) : (
          // Simple: 塗りつぶし三角 (▶)
          <marker
            id={markerId}
            viewBox="0 0 12 12"
            refX="10"
            refY="6"
            markerWidth="12"
            markerHeight="12"
            orient="auto-start-reverse"
          >
            <path
              d="M 1 1 L 10 6 L 1 11 Z"
              fill={strokeColor}
              stroke={strokeColor}
              strokeWidth="1"
            />
          </marker>
        )}
      </defs>

      {/* エッジパス */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={`url(#${markerId})`}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: isInterface ? '6 3' : undefined,
        }}
      />

      {/* 中央ラベルボックス */}
      {name && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                background: selected ? '#1e3a5f' : '#1f2937',
                color: selected ? '#93c5fd' : '#d1d5db',
                border: `1px solid ${selected ? '#3b82f6' : '#374151'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            >
              <span style={{ opacity: 0.6, fontSize: '10px' }}>
                {isInterface ? '▷' : '▶'}
              </span>
              {name}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
