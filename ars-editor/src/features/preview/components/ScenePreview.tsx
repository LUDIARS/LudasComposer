import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useI18n } from '@/hooks/useI18n';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';

const ROLE_COLORS: Record<string, string> = {
  scene: 'text-blue-400',
  actor: 'text-green-400',
};

const ROLE_BG: Record<string, string> = {
  scene: 'bg-blue-900/30 border-blue-800',
  actor: 'bg-green-900/30 border-green-800',
};

const TYPE_BADGE: Record<string, string> = {
  simple: 'text-zinc-400',
  state: 'text-amber-400',
  flexible: 'text-purple-400',
};

function ActorPreviewNode({
  actorId,
  sceneId,
}: {
  actorId: string;
  sceneId: string;
}) {
  const project = useProjectStore((s) => s.project);
  const scene = project.scenes[sceneId];
  if (!scene) return null;

  const actor = scene.actors[actorId];
  if (!actor) return null;

  // Find messages involving this actor
  const messages = scene.messages.filter(
    (m) => m.sourceDomainId === actorId || m.targetDomainId === actorId,
  );

  return (
    <div className={`rounded border px-3 py-2 mb-1 ${ROLE_BG[actor.role] ?? 'bg-zinc-800 border-zinc-700'}`}>
      {/* Actor header */}
      <div className="flex items-center gap-2">
        <span className={`font-semibold text-sm ${ROLE_COLORS[actor.role] ?? 'text-zinc-300'}`}>
          {actor.name}
        </span>
        <span className={`text-xs ${TYPE_BADGE[actor.actorType] ?? 'text-zinc-500'}`}>
          [{actor.actorType}]
        </span>
      </div>

      {/* Requirements preview */}
      {actor.requirements?.overview?.length > 0 && (
        <div className="text-xs text-zinc-400 mt-1 truncate">
          {actor.requirements.overview[0]}{actor.requirements.overview.length > 1 && ` (+${actor.requirements.overview.length - 1})`}
        </div>
      )}

      {/* State type: show states */}
      {actor.actorType === 'state' && actor.actorStates?.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {actor.actorStates.map((s) => (
            <span key={s.id} className="text-[10px] bg-amber-900/40 text-amber-300 px-1 py-0.5 rounded">
              {s.name}
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {messages.map((msg) => {
            const isSource = msg.sourceDomainId === actorId;
            const otherId = isSource ? msg.targetDomainId : msg.sourceDomainId;
            const other = scene.actors[otherId];
            return (
              <div key={msg.id} className="text-xs text-zinc-500 flex items-center gap-1">
                <span className="text-zinc-600">{isSource ? '→' : '←'}</span>
                <span>
                  {msg.name || '(unnamed)'} {isSource ? '→' : '←'} {other?.name ?? otherId}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ScenePreview() {
  const { t } = useI18n();
  const project = useProjectStore((s) => s.project);
  const activeScene = project.activeSceneId
    ? project.scenes[project.activeSceneId]
    : null;

  const stats = useMemo(() => {
    if (!activeScene) return null;
    const actors = Object.values(activeScene.actors);
    return {
      domainCount: actors.length,
      messageCount: activeScene.messages.length,
    };
  }, [activeScene]);

  const allActors = useMemo(() => {
    if (!activeScene) return [];
    return Object.values(activeScene.actors);
  }, [activeScene]);

  if (!activeScene) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-zinc-700">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t('preview.title')}
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          {t('preview.selectScene')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-700">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          {t('preview.title')}
          <HelpTooltip content={helpContent.preview} position="left" highlightSelector='[data-help-target="preview"]' />
        </h2>
        <div className="text-sm text-white mt-1">{activeScene.name}</div>
        {stats && (
          <div className="flex gap-3 mt-1 text-xs text-zinc-500">
            <span>Domains: {stats.domainCount}</span>
            <span>Messages: {stats.messageCount}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {allActors.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-4">{t('preview.noActors')}</p>
        ) : (
          allActors.map((actor) => (
            <ActorPreviewNode
              key={actor.id}
              actorId={actor.id}
              sceneId={activeScene.id}
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
          {t('preview.copyJson')}
        </button>
      </div>
    </div>
  );
}
