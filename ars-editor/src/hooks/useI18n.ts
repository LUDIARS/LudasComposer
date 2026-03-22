import { useI18nStore } from '@/stores/i18nStore';

/**
 * React hook for translations.
 *
 * Usage:
 *   const { t, locale, setLocale } = useI18n();
 *   <span>{t('nav.editor')}</span>
 */
export function useI18n() {
  const t = useI18nStore((s) => s.t);
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const ready = useI18nStore((s) => s.ready);

  return { t, locale, setLocale, ready };
}
