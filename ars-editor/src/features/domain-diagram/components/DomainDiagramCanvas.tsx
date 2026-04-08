import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useI18n } from '@/hooks/useI18n';
import { useDomainDiagram } from '../hooks/useDomainDiagram';
import { DomainNode } from './DomainNode';
import { ModuleNode } from './ModuleNode';
import { UIComponentNode } from './UIComponentNode';
import { SceneRefNode } from './SceneRefNode';
import { ActorDetailNode } from './ActorDetailNode';
import { MessageEdge } from './MessageEdge';
import { LayerSwitcher } from './LayerSwitcher';
import { DomainDiagramContext } from './DomainDiagramContext';
import type { DiagramLayer, AnyDiagramNode } from '../types';

const nodeTypes = {
  domain: DomainNode,
  module: ModuleNode,
  uiComponent: UIComponentNode,
  sceneRef: SceneRefNode,
  actorDetail: ActorDetailNode,
};

const edgeTypes = {
  message: MessageEdge,
};

export function DomainDiagramCanvas() {
  const { t } = useI18n();
  const [layer, setLayer] = useState<DiagramLayer>('domain');
  const [focusActorId, setFocusActorId] = useState<string | null>(null);
  const { nodes, edges, activeScene } = useDomainDiagram(layer, focusActorId);

  const contextValue = useMemo(
    () => ({ focusActorId, setFocusActorId }),
    [focusActorId],
  );

  const handleBack = useCallback(() => {
    setFocusActorId(null);
  }, []);

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'message' as const,
      animated: true,
    }),
    [],
  );

  const miniMapNodeColor = useCallback(
    (node: AnyDiagramNode) => {
      switch (node.type) {
        case 'domain':
          return '#22c55e';
        case 'actorDetail':
          return '#4ade80';
        case 'module':
          return '#8b5cf6';
        case 'uiComponent':
          return '#f59e0b';
        case 'sceneRef':
          return '#3b82f6';
        default:
          return '#6b7280';
      }
    },
    [],
  );

  if (!activeScene) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-lg">
        {t('domainDiagram.emptyPrompt')}
      </div>
    );
  }

  // Resolve the focused actor name for the breadcrumb
  const focusActorName = focusActorId
    ? activeScene.actors[focusActorId]?.name ?? focusActorId
    : null;

  const layerDescription = focusActorId
    ? getDetailDescription(t)
    : getLayerDescription(layer, t);

  const backLabel =
    t('domainDiagram.back') === 'domainDiagram.back'
      ? 'Back'
      : t('domainDiagram.back');

  return (
    <DomainDiagramContext.Provider value={contextValue}>
      <div className="flex-1 flex flex-col relative">
        {/* Top bar */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
          {/* Back button + breadcrumb when in detail view */}
          {focusActorId ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBack}
                className="bg-zinc-800/80 backdrop-blur-sm border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700/80 transition-colors flex items-center gap-1.5"
              >
                <span>&#x2190;</span>
                {backLabel}
              </button>
              <div className="bg-zinc-800/80 backdrop-blur-sm border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-green-400 font-medium">
                {focusActorName}
              </div>
            </div>
          ) : (
            <LayerSwitcher layer={layer} onChange={setLayer} />
          )}
          <div className="bg-zinc-800/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-zinc-700 max-w-xs">
            <div className="text-[11px] text-zinc-400">{layerDescription}</div>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute top-3 right-3 z-10">
          <Legend layer={layer} isDetail={!!focusActorId} />
        </div>

        <ReactFlow
          key={focusActorId ?? `overview-${layer}`}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          className="bg-zinc-900"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
          <Controls className="!bg-zinc-800 !border-zinc-600 !shadow-lg [&>button]:!bg-zinc-700 [&>button]:!border-zinc-600 [&>button]:!text-white [&>button:hover]:!bg-zinc-600" />
          <MiniMap
            className="!bg-zinc-800 !border-zinc-600"
            nodeColor={miniMapNodeColor}
          />
        </ReactFlow>
      </div>
    </DomainDiagramContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLayerDescription(
  layer: DiagramLayer,
  t: (key: string) => string,
): string {
  const key = `domainDiagram.description.${layer}`;
  const result = t(key);
  if (result !== key) return result;

  switch (layer) {
    case 'domain':
      return 'Shows how domains (actors) message each other \u2014 who sends what to whom. Scene transitions are shown as dashed links.';
    case 'system':
      return 'Shows how system/logic modules attach to domains \u2014 which functions affect which domain, and what they do.';
    case 'ui':
      return 'Shows which UI components display which domain information \u2014 what data the UI reads from each domain.';
    default:
      return '';
  }
}

function getDetailDescription(t: (key: string) => string): string {
  const key = 'domainDiagram.description.detail';
  const result = t(key);
  if (result !== key) return result;
  return 'Detail view \u2014 all objects attached to this actor: components, connections, tasks, variables, and scene transitions.';
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function Legend({ layer, isDetail }: { layer: DiagramLayer; isDetail: boolean }) {
  const items = isDetail ? getDetailLegendItems() : getLegendItems(layer);

  return (
    <div className="bg-zinc-800/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-zinc-700">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
        Legend
      </div>
      <div className="space-y-1">
        {items.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-[11px] text-zinc-300">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getLegendItems(layer: DiagramLayer): { color: string; label: string }[] {
  switch (layer) {
    case 'domain':
      return [
        { color: '#22c55e', label: 'Domain (Actor)' },
        { color: '#3b82f6', label: 'Scene Reference' },
        { color: '#6b7280', label: 'Message' },
      ];
    case 'system':
      return [
        { color: '#8b5cf6', label: 'System / Logic Module' },
        { color: '#22c55e', label: 'Domain (Actor)' },
        { color: '#6b7280', label: 'Provides' },
      ];
    case 'ui':
      return [
        { color: '#f59e0b', label: 'UI Component' },
        { color: '#22c55e', label: 'Domain (Actor)' },
        { color: '#6b7280', label: 'Displays' },
      ];
  }
}

function getDetailLegendItems(): { color: string; label: string }[] {
  return [
    { color: '#4ade80', label: 'Focused Actor (Detail)' },
    { color: '#22c55e', label: 'Connected Actor' },
    { color: '#8b5cf6', label: 'System / Logic Module' },
    { color: '#f59e0b', label: 'UI Component' },
    { color: '#3b82f6', label: 'Scene Reference' },
  ];
}
