import { useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { pushHistory, undo, redo } from '@/stores/historyMiddleware';

export function useUndoRedo() {
  const project = useProjectStore((s) => s.project);
  const prevProjectRef = useRef(project);

  // Track project changes for history
  useEffect(() => {
    const prev = prevProjectRef.current;
    if (prev !== project) {
      // Only push to history if it's a real user change (not undo/redo load)
      const prevJson = JSON.stringify(prev);
      const currJson = JSON.stringify(project);
      if (prevJson !== currJson) {
        pushHistory(prev);
      }
      prevProjectRef.current = project;
    }
  }, [project]);

  const handleUndo = useCallback(() => {
    undo();
  }, []);

  const handleRedo = useCallback(() => {
    redo();
  }, []);

  return { handleUndo, handleRedo };
}
