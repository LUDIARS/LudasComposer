import { useState } from 'react';
import { useSceneManager } from '../hooks/useSceneManager';
import { SceneItem } from './SceneItem';
import { HelpTooltip } from '@/components/HelpTooltip';
import { helpContent } from '@/lib/help-content';

export function SceneList() {
  const { scenes, activeSceneId, createScene, deleteScene, renameScene, setActiveScene } =
    useSceneManager();
  const [newSceneName, setNewSceneName] = useState('');

  const handleCreate = () => {
    const name = newSceneName.trim() || `Scene ${scenes.length + 1}`;
    createScene(name);
    setNewSceneName('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-700">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
          Scenes
          <HelpTooltip content={helpContent.sceneList} position="right" />
        </h2>
        <div className="flex gap-1">
          <input
            className="flex-1 bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-600 outline-none focus:border-blue-500"
            placeholder="New scene name..."
            value={newSceneName}
            onChange={(e) => setNewSceneName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          <button
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-2 py-1 rounded transition-colors"
            onClick={handleCreate}
          >
            +
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {scenes.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-4">No scenes yet</p>
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
      </div>
    </div>
  );
}
