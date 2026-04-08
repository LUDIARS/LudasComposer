import { cn } from '@/lib/utils';
import { useI18n } from '@/hooks/useI18n';
import type { DiagramLayer } from '../types';
import { LAYER_COLORS } from '../types';

interface LayerSwitcherProps {
  layer: DiagramLayer;
  onChange: (layer: DiagramLayer) => void;
}

const LAYERS: { key: DiagramLayer; labelKey: string; fallback: string }[] = [
  { key: 'domain', labelKey: 'domainDiagram.layer.domain', fallback: 'Domain' },
  { key: 'system', labelKey: 'domainDiagram.layer.system', fallback: 'System' },
  { key: 'ui', labelKey: 'domainDiagram.layer.ui', fallback: 'UI' },
];

export function LayerSwitcher({ layer, onChange }: LayerSwitcherProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-1 bg-zinc-800/80 backdrop-blur-sm rounded-lg p-1 border border-zinc-700">
      {LAYERS.map(({ key, labelKey, fallback }) => {
        const active = layer === key;
        const colors = LAYER_COLORS[key];
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              active
                ? 'text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50',
            )}
            style={active ? { backgroundColor: colors.accent } : undefined}
          >
            {t(labelKey) === labelKey ? fallback : t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
