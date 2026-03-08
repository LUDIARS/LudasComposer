import { useProjectStore } from '@/stores/projectStore';

export function useSceneManager() {
  const project = useProjectStore((s) => s.project);
  const createScene = useProjectStore((s) => s.createScene);
  const deleteScene = useProjectStore((s) => s.deleteScene);
  const renameScene = useProjectStore((s) => s.renameScene);
  const setActiveScene = useProjectStore((s) => s.setActiveScene);

  const scenes = Object.values(project.scenes);
  const activeSceneId = project.activeSceneId;

  return {
    scenes,
    activeSceneId,
    createScene,
    deleteScene,
    renameScene,
    setActiveScene,
  };
}
