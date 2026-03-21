import { useI18n } from '@/hooks/useI18n';
import type { SupportedLocale } from '@/stores/i18nStore';

interface LanguageSettingsProps {
  onClose: () => void;
}

const LOCALES: { value: SupportedLocale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
];

export function LanguageSettings({ onClose }: LanguageSettingsProps) {
  const { t, locale, setLocale } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[400px] max-w-[90vw] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-white">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Language Selection */}
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-1">
              {t('settings.language')}
            </label>
            <p className="text-xs text-zinc-500 mb-3">
              {t('settings.languageDescription')}
            </p>
            <div className="space-y-2">
              {LOCALES.map((loc) => (
                <button
                  key={loc.value}
                  onClick={() => setLocale(loc.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                    locale === loc.value
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <span className="text-lg">
                    {loc.value === 'en' ? '🇺🇸' : '🇯🇵'}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{loc.label}</div>
                    <div className="text-xs text-zinc-500">
                      {t(`settings.languages.${loc.value}`)}
                    </div>
                  </div>
                  {locale === loc.value && (
                    <span className="ml-auto text-blue-400 text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-700 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-1.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
          >
            {t('settings.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
