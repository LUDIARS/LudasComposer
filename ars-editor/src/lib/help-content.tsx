import type { ReactNode } from 'react';
import { useI18nStore } from '@/stores/i18nStore';

/** Helper to get current translation function */
function t(key: string, vars?: Record<string, string | number>): string {
  return useI18nStore.getState().t(key, vars);
}

/** Build help content using current locale. Call at render time. */
export function getHelpContent(): Record<string, ReactNode> {
  return {
    sceneList: (
      <div className="space-y-2">
        <p className="font-semibold text-white">{t('sceneManager.scenes')}</p>
        <p>{t('help.sceneList.description')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('help.sceneList.item1')}</li>
          <li>{t('help.sceneList.item2')}</li>
          <li>{t('help.sceneList.item3')}</li>
          <li>{t('help.sceneList.item4')}</li>
        </ul>
      </div>
    ),

    nodeCanvas: (
      <div className="space-y-2">
        <p className="font-semibold text-white">Node Canvas</p>
        <p>{t('help.nodeCanvas.description')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('help.nodeCanvas.item1')}</li>
          <li>{t('help.nodeCanvas.item2')}</li>
          <li>{t('help.nodeCanvas.item3')}</li>
          <li>{t('help.nodeCanvas.item4')}</li>
          <li>{t('help.nodeCanvas.item5')}</li>
          <li>{t('help.nodeCanvas.item6')}</li>
          <li>{t('help.nodeCanvas.item7')}</li>
        </ul>
      </div>
    ),

    componentEditor: (
      <div className="space-y-2">
        <p className="font-semibold text-white">{t('componentEditor.editTitle')}</p>
        <p>{t('help.componentEditor.description')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('help.componentEditor.item1')}</li>
          <li>{t('help.componentEditor.item2')}</li>
          <li>{t('help.componentEditor.item3')}</li>
          <li>{t('help.componentEditor.item4')}</li>
          <li>{t('help.componentEditor.item5')}</li>
          <li>{t('help.componentEditor.item6')}</li>
          <li>{t('help.componentEditor.item7')}</li>
        </ul>
      </div>
    ),

    componentList: (
      <div className="space-y-2">
        <p className="font-semibold text-white">{t('toolbar.components')}</p>
        <p>{t('help.componentList.description')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('help.componentList.item1')}</li>
          <li>{t('help.componentList.item2')}</li>
          <li>{t('help.componentList.item3')}</li>
          <li>{t('help.componentList.item4')}</li>
          <li>{t('help.componentList.item5')}</li>
          <li>{t('help.componentList.item6')}</li>
          <li>{t('help.componentList.item7')}</li>
        </ul>
      </div>
    ),

    prefabList: (
      <div className="space-y-2">
        <p className="font-semibold text-white">{t('prefabList.title')}</p>
        <p>{t('help.prefabList.description')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('help.prefabList.item1')}</li>
          <li>{t('help.prefabList.item2')}</li>
          <li>{t('help.prefabList.item3')}</li>
          <li>{t('help.prefabList.item4')}</li>
        </ul>
      </div>
    ),

    preview: (
      <div className="space-y-2">
        <p className="font-semibold text-white">{t('preview.title')}</p>
        <p>{t('help.preview.description')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('help.preview.item1')}</li>
          <li>{t('help.preview.item2')}</li>
        </ul>
      </div>
    ),

    toolbar: (
      <div className="space-y-2">
        <p className="font-semibold text-white">{t('help.toolbar.title')}</p>
        <p>{t('help.toolbar.description')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('help.toolbar.item1')}</li>
          <li>{t('help.toolbar.item2')}</li>
          <li>{t('help.toolbar.item3')}</li>
          <li>{t('help.toolbar.item4')}</li>
          <li>{t('help.toolbar.item5')}</li>
          <li>{t('help.toolbar.item6')}</li>
          <li>{t('help.toolbar.item7')}</li>
        </ul>
      </div>
    ),

    componentPicker: (
      <div className="space-y-2">
        <p className="font-semibold text-white">{t('componentPicker.title')}</p>
        <p>{t('help.componentPicker.description')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('help.componentPicker.item1')}</li>
          <li>{t('help.componentPicker.item2')}</li>
          <li>{t('help.componentPicker.item3')}</li>
          <li>{t('help.componentPicker.item4')}</li>
        </ul>
      </div>
    ),

    sequenceEditor: (
      <div className="space-y-2">
        <p className="font-semibold text-white">{t('help.sequenceEditor.title')}</p>
        <p>{t('help.sequenceEditor.description')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('help.sequenceEditor.item1')}</li>
          <li>{t('help.sequenceEditor.item2')}</li>
          <li>{t('help.sequenceEditor.item3')}</li>
          <li>{t('help.sequenceEditor.item4')}</li>
          <li>{t('help.sequenceEditor.item5')}</li>
        </ul>
      </div>
    ),

    behaviorEditor: (
      <div className="space-y-2">
        <p className="font-semibold text-white">{t('behaviorEditor.title')}</p>
        <p>{t('help.behaviorEditor.description')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('help.behaviorEditor.item1')}</li>
          <li>{t('help.behaviorEditor.item2')}</li>
          <li>{t('help.behaviorEditor.item3')}</li>
          <li>{t('help.behaviorEditor.item4')}</li>
          <li>{t('help.behaviorEditor.item5')}</li>
          <li>{t('help.behaviorEditor.item6')}</li>
          <li>{t('help.behaviorEditor.item7')}</li>
        </ul>
      </div>
    ),

    subScenePicker: (
      <div className="space-y-2">
        <p className="font-semibold text-white">{t('help.subScenePicker.title')}</p>
        <p>{t('help.subScenePicker.description')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('help.subScenePicker.item1')}</li>
          <li>{t('help.subScenePicker.item2')}</li>
        </ul>
      </div>
    ),
  };
}

/**
 * @deprecated Use getHelpContent() instead for i18n support.
 * Kept for backward compatibility during migration.
 */
export const helpContent = new Proxy({} as Record<string, ReactNode>, {
  get(_target, prop: string) {
    return getHelpContent()[prop];
  },
});
