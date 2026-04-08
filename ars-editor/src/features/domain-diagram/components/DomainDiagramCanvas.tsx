import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useI18n } from '@/hooks/useI18n';
import { useDomainDiagram } from '../hooks/useDomainDiagram';
import { DomainNode } from './DomainNode';
import { ModuleNode } from './ModuleNode';
import { UIComponentNode } from './UIComponentNode';
import { SceneRefNode } from './SceneRefNode';
import { MessageEdge } from './MessageEdge';
import { LayerSwitcher } from './LayerSwitcher';
import { LAYER_COLORS } from '../types';
import type { DiagramLayer, AnyDiagramNode } from '../types';

const nodeTypes = {
  domain: DomainNode,
  module: ModuleNode,
  uiComponent: UIComponentNode,
  sceneRef: SceneRefNode,
};

const edgeTypes = {
  message: MessageEdge,
};

export function DomainDiagramCanvas() {
  const { t } = useI18n();
  const [layer, setLayer] = useState<DiagramLayer>('domain');
  const { nodes, edges, activeScene } = useDomainDiagram(layer);

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
        {t('domainDiagram.emptyPrompt') === 'domainDiagram.emptyPrompt'
          ? 'Select a scene to view the domain diagram'
          : t('domainDiagram.emptyPrompt')}
      </div>
    );
  }

  const layerDescription = getLayerDescription(layer, t);

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Top bar with layer switcher and description */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <LayerSwitcher layer={layer} onChange={setLayer} />
        <div className="bg-zinc-800/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-zinc-700 max-w-xs">
          <div className="text-[11px] text-zinc-400">{layerDescription}</div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10">
        <Legend layer={layer} />
      </div>

      <ReactFlow
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
  );
}

// ---------------------------------------------------------------------------
// Helper: layer description
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
      return 'Shows how domains (actors) message each other — who sends what to whom. Scene transitions are shown as dashed links.';
    case 'system':
      return 'Shows how system/logic modules attach to domains — which functions affect which domain, and what they do.';
    case 'ui':
      return 'Shows which UI components display which domain information — what data the UI reads from each domain.';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Legend component
// ---------------------------------------------------------------------------

function Legend({ layer }: { layer: DiagramLayer }) {
  const items = getLegendItems(layer);

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
