import { useState } from 'react';
import { useSceneManager } from '../hooks/useSceneManager';
import { SceneItem } from './SceneItem';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';
import { useI18n } from '@/hooks/useI18n';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';

export function SceneList() {
  const { t } = useI18n();
  const { scenes, activeSceneId, createScene, deleteScene, renameScene, setActiveScene } =
    useSceneManager();
  const [newSceneName, setNewSceneName] = useState('');
  const project = useProjectStore((s) => s.project);
  const activeScene = activeSceneId ? project.scenes[activeSceneId] : null;
  const panelVisibility = useEditorStore((s) => s.panelVisibility);
  const togglePanel = useEditorStore((s) => s.togglePanel);

  const handleCreate = () => {
    const name = newSceneName.trim() || `Scene ${scenes.length + 1}`;
    createScene(name);
    setNewSceneName('');
  };

  const actors = activeScene ? Object.values(activeScene.actors) : [];
  const messages = activeScene ? activeScene.messages : [];

  return (
    <div className="flex flex-col h-full">
      {/* Scenes header */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          {t('sceneManager.scenes')}
          <HelpTooltip content={helpContent.sceneList} position="right" highlightSelector='[data-help-target="sceneList"]' />
        </h2>
        <div className="flex gap-1">
          <input
            className="flex-1 text-sm px-2 py-1 rounded"
            placeholder={t('sceneManager.newScenePlaceholder')}
            value={newSceneName}
            onChange={(e) => setNewSceneName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
          <button
            className="primary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            onClick={handleCreate}
          >
            +
          </button>
        </div>
      </div>

      {/* Scene list */}
      <div className="overflow-y-auto p-2 space-y-1">
        {scenes.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>{t('sceneManager.noScenes')}</p>
        ) : (
          scenes.map((scene) => (
            <SceneItem
              key={scene.id}
              scene={scene}
              isActive={scene.id === activeSceneId}
              onSelect={() => setActiveScene(scene.id)}
              onRename={(name) => renameScene(scene.id, name)}
              onDelete={() => deleteScene(scene.id)}
            />
          ))
        )}

        {/* Domain Diagram toggle */}
        <button
          className="w-full text-left px-3 py-2 rounded text-xs transition-colors mt-1"
          style={{
            color: panelVisibility.domainDiagram ? 'var(--accent)' : 'var(--text-muted)',
            background: panelVisibility.domainDiagram ? 'rgba(88,166,255,0.1)' : 'transparent',
            border: panelVisibility.domainDiagram ? '1px solid rgba(88,166,255,0.3)' : '1px solid var(--border)',
          }}
          onClick={() => togglePanel('domainDiagram')}
        >
          {panelVisibility.domainDiagram ? '✓ ' : ''}Domain Diagram
        </button>
      </div>

      {/* Actor tree for active scene */}
      {activeScene && actors.length > 0 && (
        <div className="px-3 py-2 overflow-y-auto" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Actors ({actors.length})
          </div>
          <div className="space-y-0.5">
            {actors.map((actor) => {
              const isRoot = actor.id === activeScene.rootActorId;
              const outgoing = messages.filter(m => m.sourceDomainId === actor.id);
              const incoming = messages.filter(m => m.targetDomainId === actor.id);

              return (
                <div key={actor.id} className="text-[11px]">
                  <div className="flex items-center gap-1 px-1 py-0.5 rounded" style={{ color: isRoot ? 'var(--accent)' : 'var(--text)' }}>
                    <span style={{ color: isRoot ? 'var(--accent)' : 'var(--green)', fontSize: '8px' }}>●</span>
                    <span className="truncate">{actor.name}</span>
                    {isRoot && <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>(root)</span>}
                  </div>
                  {/* Outgoing messages as task tree */}
                  {outgoing.length > 0 && (
                    <div className="ml-3 border-l" style={{ borderColor: 'var(--border)' }}>
                      {outgoing.map((msg) => {
                        const target = activeScene.actors[msg.targetDomainId];
                        return (
                          <div key={msg.id} className="flex items-center gap-1 pl-2 py-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--orange)', fontSize: '7px' }}>→</span>
                            <span className="truncate">
                              {msg.name || '(msg)'} → <span style={{ color: 'var(--text)' }}>{target?.name ?? '?'}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Incoming (show if no outgoing, to indicate leaf) */}
                  {outgoing.length === 0 && incoming.length > 0 && (
                    <div className="ml-3 text-[10px] pl-2" style={{ color: 'var(--text-muted)' }}>
                      ← receives {incoming.length} msg{incoming.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
