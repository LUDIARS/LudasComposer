import { useEditorStore } from '@/stores/editorStore';

export function SequenceEditor() {
  const closeSequenceEditor = useEditorStore((s) => s.closeSequenceEditor);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[400px] p-6 text-center">
        <p className="text-zinc-400 text-sm mb-4">
          Sequences have been replaced by the new domain architecture.
          Use the Domain Editor panel to define actor behavior.
        </p>
        <button
          onClick={closeSequenceEditor}
          className="px-4 py-2 bg-zinc-700 text-white text-sm rounded hover:bg-zinc-600 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
