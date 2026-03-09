import type { Component } from '@/types/domain';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, string> = {
  UI: '🖼️',
  Logic: '🎮',
  System: '🔧',
  GameObject: '📦',
};

interface ComponentCardProps {
  component: Component;
  isAttached: boolean;
  onToggle: () => void;
}

export function ComponentCard({ component, isAttached, onToggle }: ComponentCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors border',
        isAttached
          ? 'bg-blue-900/50 border-blue-500'
          : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500',
      )}
      onClick={onToggle}
    >
      <input
        type="checkbox"
        checked={isAttached}
        onChange={onToggle}
        className="accent-blue-500"
        onClick={(e) => e.stopPropagation()}
      />
      <span>{CATEGORY_ICONS[component.category] ?? '📎'}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{component.name}</div>
        <div className="text-xs text-zinc-500">
          {component.category} · {component.domain}
        </div>
      </div>
      {component.tasks.length > 0 && (
        <span className="text-xs text-zinc-500">{component.tasks.length} tasks</span>
      )}
    </div>
  );
}
