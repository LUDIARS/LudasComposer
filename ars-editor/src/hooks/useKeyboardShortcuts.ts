import { useEffect, useRef } from 'react';
import { undo, redo } from '@/stores/historyMiddleware';
import { useEditorStore } from '@/stores/editorStore';

interface KeyboardShortcutOptions {
  onSave?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions = {}) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        // Abort AI code generation if running before undo
        const { isGenerating, abortGeneration } = useEditorStore.getState();
        if (isGenerating) {
          abortGeneration();
        }
        undo();
      } else if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (isCtrl && e.key === 's') {
        e.preventDefault();
        optionsRef.current.onSave?.();
      } else if (isCtrl && e.key === 'c' && !isInput) {
        e.preventDefault();
        optionsRef.current.onCopy?.();
      } else if (isCtrl && e.key === 'v' && !isInput) {
        e.preventDefault();
        optionsRef.current.onPaste?.();
      } else if (isCtrl && e.key === 'd' && !isInput) {
        e.preventDefault();
        optionsRef.current.onDuplicate?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
