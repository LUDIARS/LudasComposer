import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SupportedLocale = 'en' | 'ja';

/** Nested translation dictionary – values are either strings or nested objects */
export type TranslationDict = {
  [key: string]: string | TranslationDict;
};

/** Resolve a dot-separated key from a nested dictionary */
function resolve(dict: TranslationDict, key: string): string | undefined {
  const parts = key.split('.');
  let cur: TranslationDict | string = dict;
  for (const p of parts) {
    if (typeof cur === 'string' || cur == null) return undefined;
    cur = cur[p] as TranslationDict | string;
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** Interpolate {{var}} placeholders */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    vars[name] != null ? String(vars[name]) : `{{${name}}}`,
  );
}

interface I18nState {
  /** Currently active locale */
  locale: SupportedLocale;
  /** Built-in language packs keyed by locale */
  packs: Record<string, TranslationDict>;
  /** Custom (user-defined) overrides keyed by locale */
  customPacks: Record<string, TranslationDict>;
  /** Whether the initial pack for the active locale has been loaded */
  ready: boolean;

  /** Change locale – triggers async pack download */
  setLocale: (locale: SupportedLocale) => void;
  /** Register a built-in language pack */
  registerPack: (locale: string, dict: TranslationDict) => void;
  /** Merge custom translations (user/plugin defined) for a locale */
  registerCustomPack: (locale: string, dict: TranslationDict) => void;
  /** Translate a key with optional interpolation */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

/** Detect preferred locale from browser / OS */
export function detectLocale(): SupportedLocale {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || '';
    if (lang.startsWith('ja')) return 'ja';
  }
  return 'en';
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: detectLocale(),
      packs: {},
      customPacks: {},
      ready: false,

      setLocale: (locale) => {
        set({ locale });
        // If pack isn't loaded yet, load it
        const state = get();
        if (!state.packs[locale]) {
          loadPack(locale).then((dict) => {
            get().registerPack(locale, dict);
          });
        }
      },

      registerPack: (locale, dict) =>
        set((s) => ({
          packs: { ...s.packs, [locale]: dict },
          ready: s.locale === locale ? true : s.ready,
        })),

      registerCustomPack: (locale, dict) =>
        set((s) => ({
          customPacks: {
            ...s.customPacks,
            [locale]: deepMerge(s.customPacks[locale] ?? {}, dict),
          },
        })),

      t: (key, vars) => {
        const { locale, packs, customPacks } = get();
        // Custom overrides take priority
        const custom = customPacks[locale];
        if (custom) {
          const val = resolve(custom, key);
          if (val != null) return interpolate(val, vars);
        }
        // Built-in pack
        const pack = packs[locale];
        if (pack) {
          const val = resolve(pack, key);
          if (val != null) return interpolate(val, vars);
        }
        // Fallback to English
        const fallback = packs['en'];
        if (fallback) {
          const val = resolve(fallback, key);
          if (val != null) return interpolate(val, vars);
        }
        // Return the key itself as a last resort
        return key;
      },
    }),
    {
      name: 'ars-i18n',
      partialize: (s) => ({ locale: s.locale, customPacks: s.customPacks }),
    },
  ),
);

/** Deep-merge two translation dictionaries (b overrides a) */
function deepMerge(a: TranslationDict, b: TranslationDict): TranslationDict {
  const result = { ...a };
  for (const key of Object.keys(b)) {
    const bv = b[key];
    const av = a[key];
    if (typeof bv === 'object' && bv !== null && typeof av === 'object' && av !== null) {
      result[key] = deepMerge(av as TranslationDict, bv as TranslationDict);
    } else {
      result[key] = bv;
    }
  }
  return result;
}

/** Lazy-load a language pack */
async function loadPack(locale: string): Promise<TranslationDict> {
  switch (locale) {
    case 'ja': {
      const mod = await import('../locales/ja.json');
      return mod.default as TranslationDict;
    }
    case 'en':
    default: {
      const mod = await import('../locales/en.json');
      return mod.default as TranslationDict;
    }
  }
}

/** Initialize the store: load the active locale's pack */
export async function initI18n(): Promise<void> {
  const store = useI18nStore.getState();
  const locale = store.locale;
  if (!store.packs[locale]) {
    const dict = await loadPack(locale);
    store.registerPack(locale, dict);
  }
  // Always load English as fallback
  if (!store.packs['en'] && locale !== 'en') {
    const dict = await loadPack('en');
    store.registerPack('en', dict);
  }
}
