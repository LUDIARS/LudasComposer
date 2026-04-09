import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import * as backend from '@/lib/backend';

const AUTO_SAVE_DELAY = 2000;

export function useAutoSave() {
  const project = useProjectStore((s) => s.project);
  const projectPath = useEditorStore((s) => s.projectPath);
  const isDirty = useEditorStore((s) => s.isDirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDirty || !projectPath) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        await backend.saveProject(projectPath, project);
        markSaved(projectPath);
      } catch {
        // 自動保存の失敗は静かに無視（手動保存は別途可能）
      }
    }, AUTO_SAVE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [project, projectPath, isDirty, markSaved]);
}
