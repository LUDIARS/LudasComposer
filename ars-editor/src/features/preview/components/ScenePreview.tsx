import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';

const ROLE_COLORS: Record<string, string> = {
  scene: 'text-blue-400',
  actor: 'text-green-400',
  sequence: 'text-orange-400',
};

const ROLE_BG: Record<string, string> = {
  scene: 'bg-blue-900/30 border-blue-800',
  actor: 'bg-green-900/30 border-green-800',
  sequence: 'bg-orange-900/30 border-orange-800',
};

function ActorPreviewNode({
  actorId,
  sceneId,
  depth,
}: {
  actorId: string;
  sceneId: string;
  depth: number;
}) {
  const project = useProjectStore((s) => s.project);
  const scene = project.scenes[sceneId];
  if (!scene) return null;

  const actor = scene.actors[actorId];
  if (!actor) return null;

  const attachedComponents = actor.components
    .map((id) => project.components[id])
    .filter(Boolean);

  // Find connections involving this actor
  const connections = scene.connections.filter(
    (c) => c.sourceActorId === actorId || c.targetActorId === actorId,
  );

  // Find children (actors with parentId === actorId)
  const children = Object.values(scene.actors).filter(
    (a) => a.parentId === actorId,
  );

  return (
    <div className={`${depth > 0 ? 'ml-4 border-l border-zinc-700 pl-3' : ''}`}>
      <div className={`rounded border px-3 py-2 mb-1 ${ROLE_BG[actor.role] ?? 'bg-zinc-800 border-zinc-700'}`}>
        {/* Actor header */}
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm ${ROLE_COLORS[actor.role] ?? 'text-zinc-300'}`}>
            {actor.name}
          </span>
          <span className="text-xs text-zinc-500">[{actor.role}]</span>
        </div>

        {/* Attached components */}
        {attachedComponents.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {attachedComponents.map((comp) => (
              <div key={comp.id} className="text-xs text-zinc-400 flex items-center gap-1">
                <span className="text-zinc-600">├</span>
                <span>{comp.name}</span>
                <span className="text-zinc-600">({comp.category})</span>
              </div>
            ))}
          </div>
        )}

        {/* Connections */}
        {connections.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {connections.map((conn) => {
              const isSource = conn.sourceActorId === actorId;
              const otherId = isSource ? conn.targetActorId : conn.sourceActorId;
              const other = scene.actors[otherId];
              return (
                <div key={conn.id} className="text-xs text-zinc-500 flex items-center gap-1">
                  <span className="text-zinc-600">→</span>
                  <span>
                    {isSource ? conn.sourcePort : conn.targetPort}
                    {' → '}
                    {other?.name ?? otherId}
                    .{isSource ? conn.targetPort : conn.sourcePort}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Children */}
      {children.map((child) => (
        <ActorPreviewNode
          key={child.id}
          actorId={child.id}
          sceneId={sceneId}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function ScenePreview() {
  const project = useProjectStore((s) => s.project);
  const activeScene = project.activeSceneId
    ? project.scenes[project.activeSceneId]
    : null;

  const stats = useMemo(() => {
    if (!activeScene) return null;
    const actors = Object.values(activeScene.actors);
    const componentIds = new Set(actors.flatMap((a) => a.components));
    return {
      actorCount: actors.length,
      connectionCount: activeScene.connections.length,
      componentCount: componentIds.size,
    };
  }, [activeScene]);

  // Find root-level actors (no parentId)
  const rootActors = useMemo(() => {
    if (!activeScene) return [];
    return Object.values(activeScene.actors).filter(
      (a) => !a.parentId,
    );
  }, [activeScene]);

  if (!activeScene) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-zinc-700">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Preview
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          Select a scene to preview
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-700">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          Preview
          <HelpTooltip content={helpContent.preview} position="left" highlightSelector='[data-help-target="preview"]' />
        </h2>
        <div className="text-sm text-white mt-1">{activeScene.name}</div>
        {stats && (
          <div className="flex gap-3 mt-1 text-xs text-zinc-500">
            <span>{stats.actorCount} actors</span>
            <span>{stats.connectionCount} connections</span>
            <span>{stats.componentCount} components</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {rootActors.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-4">No actors in this scene</p>
        ) : (
          rootActors.map((actor) => (
            <ActorPreviewNode
              key={actor.id}
              actorId={actor.id}
              sceneId={activeScene.id}
              depth={0}
            />
          ))
        )}
      </div>

      {/* Scene JSON export */}
      <div className="border-t border-zinc-700 p-2">
        <button
          className="w-full text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 py-2 rounded transition-colors"
          onClick={() => {
            const json = JSON.stringify(activeScene, null, 2);
            navigator.clipboard.writeText(json);
          }}
          title="Copy scene JSON to clipboard"
        >
          Copy Scene JSON
        </button>
      </div>
    </div>
  );
}
