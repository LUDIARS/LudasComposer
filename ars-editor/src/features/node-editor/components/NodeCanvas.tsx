import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useNodeEditor } from '../hooks/useNodeEditor';
import { useEditorStore } from '@/stores/editorStore';
import { ActorNode } from './ActorNode';
import { GroupNode } from './GroupNode';
import { ContextMenu } from './ContextMenu';
import type { AnyFlowNode } from '../types/nodes';

const nodeTypes = {
  actor: ActorNode,
  group: GroupNode,
};

export function NodeCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, activeScene } =
    useNodeEditor();
  const openContextMenu = useEditorStore((s) => s.openContextMenu);
  const closeContextMenu = useEditorStore((s) => s.closeContextMenu);
  const setSelectedNodes = useEditorStore((s) => s.setSelectedNodes);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<AnyFlowNode> | null>(null);
  const [flowClickPos, setFlowClickPos] = useState<{ x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (!wrapperRef.current || !rfInstance) return;
      const bounds = wrapperRef.current.getBoundingClientRect();
      const screenPos = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      const flowPos = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setFlowClickPos(flowPos);
      openContextMenu(screenPos);
    },
    [rfInstance, openContextMenu],
  );

  if (!activeScene) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-lg">
        Select or create a scene to start editing
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="flex-1 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        onPaneClick={() => closeContextMenu()}
        onContextMenu={onContextMenu}
        onSelectionChange={({ nodes: selectedNodes }) => {
          setSelectedNodes(selectedNodes.map((n) => n.id));
        }}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Delete"
        className="bg-zinc-900"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
        <Controls className="!bg-zinc-800 !border-zinc-600 !shadow-lg [&>button]:!bg-zinc-700 [&>button]:!border-zinc-600 [&>button]:!text-white [&>button:hover]:!bg-zinc-600" />
        <MiniMap
          className="!bg-zinc-800 !border-zinc-600"
          nodeColor={(node) => {
            const data = node.data as Record<string, unknown>;
            const role = data?.role as string;
            if (role === 'scene') return '#3b82f6';
            if (role === 'sequence') return '#f97316';
            return '#22c55e';
          }}
        />
      </ReactFlow>
      <ContextMenu flowPosition={flowClickPos} />
    </div>
  );
}
