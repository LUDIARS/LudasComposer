import { useEditorStore } from '@/stores/editorStore';
import { useProjectStore } from '@/stores/projectStore';

export function SubScenePicker() {
  const actorId = useEditorStore((s) => s.subScenePickerTarget);
  const closeSubScenePicker = useEditorStore((s) => s.closeSubScenePicker);
  const activeSceneId = useProjectStore((s) => s.project.activeSceneId);
  const scenes = useProjectStore((s) => s.project.scenes);
  const setActorSubScene = useProjectStore((s) => s.setActorSubScene);

  if (!actorId || !activeSceneId) return null;

  const scene = scenes[activeSceneId];
  if (!scene) return null;
  const actor = scene.actors[actorId];
  if (!actor) return null;

  const availableScenes = Object.values(scenes).filter((s) => s.id !== activeSceneId);

  const handleSelect = (subSceneId: string | null) => {
    setActorSubScene(activeSceneId, actorId, subSceneId);
    closeSubScenePicker();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeSubScenePicker}>
      <div
        className="bg-zinc-800 border border-zinc-600 rounded-lg shadow-2xl w-[400px] max-h-[60vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-white">
            Set SubScene - {actor.name}
          </h2>
          <button
            className="text-zinc-400 hover:text-white text-sm"
            onClick={closeSubScenePicker}
          >
            ✕
          </button>
        </div>

        {/* Scene list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {/* None option */}
          <button
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              !actor.subSceneId
                ? 'bg-cyan-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => handleSelect(null)}
          >
            (None)
          </button>

          {availableScenes.length === 0 ? (
            <div className="text-zinc-500 text-sm text-center py-4">
              No other scenes available. Create another scene first.
            </div>
          ) : (
            availableScenes.map((s) => (
              <button
                key={s.id}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  actor.subSceneId === s.id
                    ? 'bg-cyan-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-700'
                }`}
                onClick={() => handleSelect(s.id)}
              >
                🎬 {s.name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
