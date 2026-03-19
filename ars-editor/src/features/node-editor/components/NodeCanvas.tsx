import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type ReactFlowInstance,
  type Connection as FlowConnection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useNodeEditor } from '../hooks/useNodeEditor';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useEditorStore } from '@/stores/editorStore';
import { useProjectStore } from '@/stores/projectStore';
import { ActorNode } from './ActorNode';
import { GroupNode } from './GroupNode';
import { ActorEdge } from './ActorEdge';
import { ContextMenu } from './ContextMenu';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';
import { validateConnection } from '@/lib/connection-validator';
import type { AnyFlowNode } from '../types/nodes';

const nodeTypes = {
  actor: ActorNode,
  group: GroupNode,
};

const edgeTypes = {
  actor: ActorEdge,
};

export function NodeCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, activeScene } =
    useNodeEditor();
  useUndoRedo();
  const openContextMenu = useEditorStore((s) => s.openContextMenu);
  const closeContextMenu = useEditorStore((s) => s.closeContextMenu);
  const setSelectedNodes = useEditorStore((s) => s.setSelectedNodes);
  const project = useProjectStore((s) => s.project);
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

  const isValidConnection = useCallback(
    (connection: FlowConnection | { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) => {
      if (!activeScene) return false;
      const result = validateConnection(
        project,
        activeScene,
        connection.source,
        connection.sourceHandle ?? null,
        connection.target,
        connection.targetHandle ?? null,
      );
      return result.valid;
    },
    [activeScene, project],
  );

  if (!activeScene) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-lg">
        Select or create a scene to start editing
      </div>
    );
  }

  const canvasHelpButton = (
    <div className="absolute top-2 right-2 z-10">
      <HelpTooltip content={helpContent.nodeCanvas} position="left" highlightSelector='[data-help-target="nodeCanvas"]' />
    </div>
  );

  return (
    <div ref={wrapperRef} className="flex-1 relative">
      {canvasHelpButton}
      <ReactFlow
        key={activeScene.id}
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
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'actor', animated: true }}
        isValidConnection={isValidConnection}
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
