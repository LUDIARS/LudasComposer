import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';

interface MessageEditorProps {
  sceneId: string;
  messageId: string;
  onClose: () => void;
}

export function MessageEditor({ sceneId, messageId, onClose }: MessageEditorProps) {
  const scene = useProjectStore((s) => s.project.scenes[sceneId]);
  const updateMessage = useProjectStore((s) => s.updateMessage);
  const message = scene?.messages.find((m) => m.id === messageId);

  const [name, setName] = useState(message?.name ?? '');
  const [description, setDescription] = useState(message?.description ?? '');

  if (!message || !scene) return null;

  const sourceDomain = scene.actors[message.sourceDomainId];
  const targetDomain = scene.actors[message.targetDomainId];

  const handleSave = () => {
    updateMessage(sceneId, messageId, { name, description });
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-600 rounded-lg shadow-2xl p-4 w-[400px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-sm font-semibold">Message Definition</h3>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Source → Target */}
      <div className="text-xs text-zinc-400 mb-3 flex items-center gap-2">
        <span className="text-green-400 font-medium">{sourceDomain?.name ?? '?'}</span>
        <span className="text-zinc-500">&rarr;</span>
        <span className="text-blue-400 font-medium">{targetDomain?.name ?? '?'}</span>
      </div>

      {/* Message Name */}
      <div className="mb-2">
        <label className="text-zinc-400 text-[10px] uppercase tracking-wider block mb-1">
          Name (何を)
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          placeholder="e.g. TakeDamage, RequestData, Notify..."
          className="w-full bg-zinc-900 border border-zinc-600 rounded px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Description */}
      <div className="mb-3">
        <label className="text-zinc-400 text-[10px] uppercase tracking-wider block mb-1">
          Description (説明)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleSave}
          placeholder="このメッセージの目的や内容を記述..."
          rows={3}
          className="w-full bg-zinc-900 border border-zinc-600 rounded px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => {
            handleSave();
            onClose();
          }}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
