import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/hooks/useI18n';

interface HelpTooltipProps {
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  /** CSS selector or ref target to highlight when overlay opens */
  highlightSelector?: string;
  /** Ref to the element to highlight */
  highlightRef?: React.RefObject<HTMLElement | null>;
}

export function HelpTooltip({
  content,
  position = 'bottom',
  className = '',
  highlightSelector,
  highlightRef,
}: HelpTooltipProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [overlayMode, setOverlayMode] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  // Calculate highlight rect and tooltip position for overlay mode
  const updateHighlightRect = useCallback(() => {
    let el: HTMLElement | null = null;
    if (highlightRef?.current) {
      el = highlightRef.current;
    } else if (highlightSelector) {
      el = document.querySelector(highlightSelector);
    }
    // Fallback: highlight the closest parent panel
    if (!el && containerRef.current) {
      el = containerRef.current.closest('[data-help-target]') as HTMLElement | null;
      if (!el) {
        // Fallback to the parent section
        el = containerRef.current.parentElement?.closest('.flex.flex-col, .h-full, [class*="min-w-"]') as HTMLElement | null;
      }
    }
    if (el) {
      const rect = el.getBoundingClientRect();
      setHighlightRect(rect);
      // Position tooltip near the highlighted area
      const tooltipWidth = 320;
      const tooltipHeight = 200;
      let top = rect.top + rect.height / 2 - tooltipHeight / 2;
      let left: number;

      // Try to place to the right of the highlighted element
      if (rect.right + tooltipWidth + 16 < window.innerWidth) {
        left = rect.right + 16;
      } else if (rect.left - tooltipWidth - 16 > 0) {
        left = rect.left - tooltipWidth - 16;
      } else {
        // Center horizontally, place below
        left = Math.max(16, (window.innerWidth - tooltipWidth) / 2);
        top = rect.bottom + 16;
      }

      // Clamp to viewport
      top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));
      left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

      setTooltipPos({ top, left });
    } else {
      setHighlightRect(null);
      setTooltipPos(null);
    }
  }, [highlightSelector, highlightRef]);

  // Close on outside click (non-overlay mode)
  useEffect(() => {
    if (!isOpen || overlayMode) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, overlayMode]);

  // Cleanup timeout on unmount
  useEffect(() => clearHoverTimeout, [clearHoverTimeout]);

  // Update highlight rect on scroll/resize when overlay is open
  useEffect(() => {
    if (!overlayMode) return;
    const update = () => updateHighlightRect();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [overlayMode, updateHighlightRect]);

  const handleMouseEnter = useCallback(() => {
    if (overlayMode) return;
    clearHoverTimeout();
    setIsOpen(true);
  }, [clearHoverTimeout, overlayMode]);

  const handleMouseLeave = useCallback(() => {
    if (overlayMode) return;
    clearHoverTimeout();
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, [clearHoverTimeout, overlayMode]);

  const handleClick = useCallback(() => {
    if (overlayMode) {
      // Close overlay
      setOverlayMode(false);
      setIsOpen(false);
      setHighlightRect(null);
      setTooltipPos(null);
    } else {
      // Open overlay mode
      setOverlayMode(true);
      setIsOpen(true);
      updateHighlightRect();
    }
  }, [overlayMode, updateHighlightRect]);

  const handleCloseOverlay = useCallback(() => {
    setOverlayMode(false);
    setIsOpen(false);
    setHighlightRect(null);
    setTooltipPos(null);
  }, []);

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-zinc-700 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-700 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-zinc-700 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-zinc-700 border-t-transparent border-b-transparent border-l-transparent',
  };

  // Overlay portal with backdrop dimming and highlight
  const overlayPortal = overlayMode && highlightRect && tooltipPos
    ? createPortal(
        <div className="fixed inset-0 z-[9999]" onClick={handleCloseOverlay}>
          {/* Backdrop with cutout for highlighted area */}
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
            <defs>
              <mask id="help-highlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={highlightRect.left - 4}
                  y={highlightRect.top - 4}
                  width={highlightRect.width + 8}
                  height={highlightRect.height + 8}
                  rx={8}
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.6)"
              mask="url(#help-highlight-mask)"
              style={{ pointerEvents: 'all' }}
            />
          </svg>

          {/* Highlight border */}
          <div
            className="absolute rounded-lg border-2 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)] pointer-events-none transition-all duration-200"
            style={{
              top: highlightRect.top - 4,
              left: highlightRect.left - 4,
              width: highlightRect.width + 8,
              height: highlightRect.height + 8,
            }}
          />

          {/* Tooltip content */}
          <div
            className="absolute bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl p-4 text-sm text-zinc-300 min-w-[240px] max-w-[360px] leading-relaxed"
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">{content}</div>
              <button
                onClick={handleCloseOverlay}
                className="text-zinc-500 hover:text-white text-sm flex-shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
            <div className="text-[10px] text-zinc-500 mt-3 pt-2 border-t border-zinc-700">
              {t('helpTooltip.clickToClose')}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleClick}
        className={`inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full border transition-colors cursor-help leading-none ${
          overlayMode
            ? 'border-blue-400 text-blue-400 bg-blue-400/20'
            : 'border-zinc-500 text-zinc-400 hover:border-blue-400 hover:text-blue-400 hover:bg-blue-400/10'
        }`}
        aria-label={t('helpTooltip.help')}
      >
        ?
      </button>
      {isOpen && !overlayMode && (
        <div
          className={`absolute z-[100] ${positionClasses[position]}`}
        >
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-3 text-xs text-zinc-300 min-w-[200px] max-w-[320px] leading-relaxed">
            {content}
          </div>
          <div
            className={`absolute w-0 h-0 border-[6px] ${arrowClasses[position]}`}
          />
        </div>
      )}
      {overlayPortal}
    </span>
  );
}
