import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type ReactFlowInstance,
  type Connection as FlowConnection,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useNodeEditor } from '../hooks/useNodeEditor';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useEditorStore } from '@/stores/editorStore';
import { useI18n } from '@/hooks/useI18n';
import { useCollabStore } from '@/stores/collabStore';
import { ActorNode } from './ActorNode';
import { ActorEdge } from './ActorEdge';
import { ContextMenu } from './ContextMenu';
import { CollabCursors } from './CollabCursors';
import { CollabLocks } from './CollabLocks';
import { MessageEditor } from './MessageEditor';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useProjectStore } from '@/stores/projectStore';
import type { ActorType } from '@/types/domain';
import type { AnyFlowNode } from '../types/nodes';

const nodeTypes = {
  actor: ActorNode,
};

const edgeTypes = {
  actor: ActorEdge,
};

export function NodeCanvas() {
  const { t } = useI18n();
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, activeScene } =
    useNodeEditor();
  useUndoRedo();
  const openContextMenu = useEditorStore((s) => s.openContextMenu);
  const closeContextMenu = useEditorStore((s) => s.closeContextMenu);
  const setSelectedNodes = useEditorStore((s) => s.setSelectedNodes);
  const sendCursor = useCollabStore((s) => s.sendCursor);
  const collabConnected = useCollabStore((s) => s.connected);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<AnyFlowNode> | null>(null);
  const [flowClickPos, setFlowClickPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const addActor = useProjectStore((s) => s.addActor);

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
    (connection: FlowConnection | { source: string; target: string }) => {
      // Don't allow self-connections
      if (connection.source === connection.target) return false;
      // Don't allow duplicate messages
      if (!activeScene) return false;
      const exists = activeScene.messages.some(
        (m) => m.sourceDomainId === connection.source && m.targetDomainId === connection.target,
      );
      return !exists;
    },
    [activeScene],
  );

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Array<{ id: string }> }) => {
    setSelectedNodes(selectedNodes.map((n) => n.id));
  }, [setSelectedNodes]);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
  }, []);

  const onPaneClick = useCallback(() => {
    closeContextMenu();
    setSelectedEdgeId(null);
    setFabOpen(false);
  }, [closeContextMenu]);

  const handleFabAdd = useCallback((actorType: ActorType) => {
    if (!activeScene) return;
    const viewport = rfInstance?.getViewport();
    const centerX = viewport ? (-viewport.x + 200) / viewport.zoom : 250;
    const centerY = viewport ? (-viewport.y + 300) / viewport.zoom : 200;
    const labels: Record<ActorType, string> = {
      simple: 'New Domain',
      state: 'New State Domain',
      flexible: 'New Flexible Domain',
    };
    addActor(activeScene.id, {
      name: labels[actorType],
      role: 'actor',
      actorType,
      requirements: { overview: [], goals: [], role: [], behavior: [] },
      actorStates: [],
      flexibleContent: '',
      displays: [],
      position: { x: centerX, y: centerY },
      subSceneId: null,
    });
    setFabOpen(false);
  }, [activeScene, rfInstance, addActor]);

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!collabConnected || !rfInstance || !wrapperRef.current) return;
      const flowPos = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      sendCursor(flowPos.x, flowPos.y, activeScene?.id ?? null);
    },
    [collabConnected, rfInstance, sendCursor, activeScene],
  );

  if (!activeScene) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-lg">
        {t('nodeCanvas.emptyPrompt')}
      </div>
    );
  }

  const canvasHelpButton = (
    <div className="absolute top-2 right-2 z-10">
      <HelpTooltip content={helpContent.nodeCanvas} position="left" highlightSelector='[data-help-target="nodeCanvas"]' />
    </div>
  );

  return (
    <div ref={wrapperRef} className="flex-1 relative" onMouseMove={onMouseMove}>
      {canvasHelpButton}
      <ReactFlow
        key={activeScene.id}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        onPaneClick={onPaneClick}
        onContextMenu={onContextMenu}
        onSelectionChange={onSelectionChange}
        onEdgeClick={onEdgeClick}
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
            return '#22c55e';
          }}
        />
      </ReactFlow>
      <CollabCursors activeSceneId={activeScene.id} />
      <CollabLocks />
      <ContextMenu flowPosition={flowClickPos} />
      {selectedEdgeId && (
        <MessageEditor
          key={selectedEdgeId}
          sceneId={activeScene.id}
          messageId={selectedEdgeId}
          onClose={() => setSelectedEdgeId(null)}
        />
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <div className="absolute bottom-4 right-4 z-20 flex flex-col-reverse items-end gap-2">
          <button
            onClick={() => setFabOpen(!fabOpen)}
            className="w-14 h-14 rounded-full bg-blue-600 text-white text-2xl shadow-lg active:bg-blue-500 transition-colors flex items-center justify-center"
          >
            {fabOpen ? '×' : '+'}
          </button>
          {fabOpen && (
            <>
              <button
                onClick={() => handleFabAdd('simple')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-700 text-zinc-200 text-sm shadow-lg active:bg-zinc-600"
              >
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                Simple
              </button>
              <button
                onClick={() => handleFabAdd('state')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-700 text-zinc-200 text-sm shadow-lg active:bg-zinc-600"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                State
              </button>
              <button
                onClick={() => handleFabAdd('flexible')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-700 text-zinc-200 text-sm shadow-lg active:bg-zinc-600"
              >
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Flexible
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
