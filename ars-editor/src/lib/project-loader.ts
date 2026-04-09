/**
 * プロジェクトロードのヘルパー
 *
 * loadProject の前に isDirty=false にすることで、
 * autoSave が旧プロジェクトを上書きする問題を防ぐ。
 */

import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { clearHistory } from '@/stores/historyMiddleware';
import type { Project } from '@/types/domain';

/**
 * プロジェクトを安全にロードする。
 * 1. autoSave を止めるため isDirty=false にする
 * 2. プロジェクトを store にセット
 * 3. undo/redo 履歴をクリア
 * 4. projectPath と saved 状態を更新
 */
export function safeLoadProject(project: Project, path?: string): void {
  // まず isDirty を false にして autoSave の発火を防ぐ
  useEditorStore.getState().markSaved(path);

  // プロジェクトをロード
  useProjectStore.getState().loadProject(project);

  // 履歴クリア
  clearHistory();

  // 再度 markSaved (loadProject で project が変わり markDirty が呼ばれる可能性があるため)
  useEditorStore.getState().markSaved(path);
}
