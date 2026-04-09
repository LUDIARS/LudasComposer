import { useIsMobile } from '@/hooks/useIsMobile';
import type { ReactNode } from 'react';

interface ModalOverlayProps {
  children: ReactNode;
  onClose: () => void;
  /** デスクトップでの配置 (デフォルト: absolute bottom-4 center) */
  desktopClassName?: string;
  /** 幅 (デフォルト: 420px) */
  width?: string;
}

/**
 * モバイル: 画面中央のオーバーレイモーダル (背景暗転)
 * デスクトップ: キャンバス下部のフローティングパネル (従来)
 */
export function ModalOverlay({ children, onClose, desktopClassName, width = '420px' }: ModalOverlayProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      >
        <div
          className="rounded-lg shadow-2xl p-4 overflow-y-auto mx-4"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            width: '100%',
            maxWidth: width,
            maxHeight: '85vh',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={desktopClassName ?? 'absolute bottom-4 left-1/2 -translate-x-1/2 z-50'}
      style={{ width }}
    >
      <div
        className="rounded-lg shadow-2xl p-4 overflow-y-auto"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          maxHeight: '80vh',
        }}
      >
        {children}
      </div>
    </div>
  );
}
