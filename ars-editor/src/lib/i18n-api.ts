/**
 * Public API for extending the i18n system with custom translations.
 *
 * This allows users to add their own language entries for custom features,
 * menus, or other UI elements they have created.
 *
 * Usage:
 *   import { registerTranslations, registerTranslation } from '@/lib/i18n-api';
 *
 *   // Register multiple translations at once
 *   registerTranslations('en', {
 *     myFeature: {
 *       title: 'My Custom Feature',
 *       description: 'A description of my feature',
 *     },
 *   });
 *
 *   registerTranslations('ja', {
 *     myFeature: {
 *       title: 'カスタム機能',
 *       description: '機能の説明',
 *     },
 *   });
 *
 *   // Register a single key-value pair
 *   registerTranslation('en', 'myFeature.button', 'Click Me');
 *   registerTranslation('ja', 'myFeature.button', 'クリック');
 *
 *   // Then use in components:
 *   const { t } = useI18n();
 *   t('myFeature.title'); // => "My Custom Feature" or "カスタム機能"
 */
import { useI18nStore, type TranslationDict } from '@/stores/i18nStore';

/**
 * Register custom translations for a locale.
 * These override built-in translations and persist across sessions.
 */
export function registerTranslations(locale: string, translations: TranslationDict): void {
  useI18nStore.getState().registerCustomPack(locale, translations);
}

/**
 * Register a single translation key-value pair for a locale.
 * Dot-separated keys are expanded into nested objects.
 *
 * Example: registerTranslation('en', 'menu.file.open', 'Open File')
 * Results in: { menu: { file: { open: 'Open File' } } }
 */
export function registerTranslation(locale: string, key: string, value: string): void {
  const parts = key.split('.');
  const dict: TranslationDict = {};
  let cur = dict;
  for (let i = 0; i < parts.length - 1; i++) {
    const child: TranslationDict = {};
    cur[parts[i]] = child;
    cur = child;
  }
  cur[parts[parts.length - 1]] = value;
  useI18nStore.getState().registerCustomPack(locale, dict);
}

/**
 * Get the current locale.
 */
export function getCurrentLocale(): string {
  return useI18nStore.getState().locale;
}

/**
 * Get all available locale codes.
 */
export function getAvailableLocales(): string[] {
  const state = useI18nStore.getState();
  return [...new Set([...Object.keys(state.packs), ...Object.keys(state.customPacks)])];
}

/**
 * Translate a key using the current locale (non-React context).
 * For React components, prefer using the useI18n() hook.
 */
export function translate(key: string, vars?: Record<string, string | number>): string {
  return useI18nStore.getState().t(key, vars);
}
