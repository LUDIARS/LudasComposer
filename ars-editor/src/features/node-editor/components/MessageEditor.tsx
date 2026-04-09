import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { MessageType } from '@/types/generated/MessageType';
import { cn } from '@/lib/utils';

interface MessageEditorProps {
  sceneId: string;
  messageId: string;
  onClose: () => void;
}

export function MessageEditor({ sceneId, messageId, onClose }: MessageEditorProps) {
  const scene = useProjectStore((s) => s.project.scenes[sceneId]);
  const updateMessage = useProjectStore((s) => s.updateMessage);
  const removeMessage = useProjectStore((s) => s.removeMessage);
  const message = scene?.messages.find((m) => m.id === messageId);

  const [name, setName] = useState(message?.name ?? '');
  const [description, setDescription] = useState(message?.description ?? '');
  const [messageType, setMessageType] = useState<MessageType>(message?.messageType ?? 'simple');
  const [actionIds, setActionIds] = useState<string[]>(message?.actionIds ?? []);

  if (!message || !scene) return null;

  const sourceDomain = scene.actors[message.sourceDomainId];
  const targetDomain = scene.actors[message.targetDomainId];
  const allActions = Object.values(scene.actions ?? {});

  const handleSave = () => {
    updateMessage(sceneId, messageId, { name, description, messageType, actionIds });
  };

  const toggleAction = (actionId: string) => {
    setActionIds((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId],
    );
  };

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg shadow-2xl p-4 w-[420px] max-h-[80vh] overflow-y-auto"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Message Definition</h3>
        <button
          onClick={onClose}
          style={{ color: 'var(--text-muted)', border: 'none', background: 'transparent', fontSize: '1.1rem' }}
        >
          &times;
        </button>
      </div>

      {/* Source → Target */}
      <div className="text-xs mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--green)' }} className="font-medium">{sourceDomain?.name ?? '?'}</span>
        <span>&rarr;</span>
        <span style={{ color: 'var(--accent)' }} className="font-medium">{targetDomain?.name ?? '?'}</span>
      </div>

      {/* Message Type Selector */}
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Type
        </label>
        <div className="flex gap-2">
          <button
            className={cn('flex-1 text-xs px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5')}
            style={{
              color: messageType === 'simple' ? 'var(--text)' : 'var(--text-muted)',
              background: messageType === 'simple' ? 'var(--bg-surface-2)' : 'var(--bg)',
              border: messageType === 'simple' ? '1px solid var(--text-muted)' : '1px solid var(--border)',
            }}
            onClick={() => setMessageType('simple')}
          >
            ▶ Simple
          </button>
          <button
            className={cn('flex-1 text-xs px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5')}
            style={{
              color: messageType === 'interface' ? 'var(--accent)' : 'var(--text-muted)',
              background: messageType === 'interface' ? 'rgba(88,166,255,0.1)' : 'var(--bg)',
              border: messageType === 'interface' ? '1px solid var(--accent)' : '1px solid var(--border)',
            }}
            onClick={() => setMessageType('interface')}
          >
            ▷ Interface
          </button>
        </div>
      </div>

      {/* Message Name */}
      <div className="mb-2">
        <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
          Name (何をするか)
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          placeholder="e.g. TakeDamage, RequestData, Notify..."
        />
      </div>

      {/* Description */}
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleSave}
          placeholder="このメッセージの目的や内容を記述..."
          rows={2}
          className="w-full resize-none"
        />
      </div>

      {/* Action 紐付け (Interface 時のみ表示) */}
      {messageType === 'interface' && (
        <div className="mb-3 rounded p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <label className="text-[10px] uppercase tracking-wider block mb-2" style={{ color: 'var(--accent)' }}>
            Actions (抽象)
          </label>
          {allActions.length === 0 ? (
            <div className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
              Actions タブでアクションを定義してください
            </div>
          ) : (
            <div className="space-y-1">
              {allActions.map((action) => {
                const isLinked = actionIds.includes(action.id);
                return (
                  <button
                    key={action.id}
                    onClick={() => toggleAction(action.id)}
                    className="w-full text-left px-2.5 py-2 rounded text-xs transition-colors flex items-start gap-2"
                    style={{
                      background: isLinked ? 'rgba(88,166,255,0.1)' : 'transparent',
                      border: isLinked ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 text-[10px]"
                      style={{
                        borderColor: isLinked ? 'var(--accent)' : 'var(--border)',
                        background: isLinked ? 'var(--accent)' : 'transparent',
                        color: isLinked ? '#000' : 'transparent',
                      }}
                    >
                      ✓
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{action.name}</div>
                      {action.behaviors.length > 0 && (
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {action.behaviors.slice(0, 2).map((b, i) => (
                            <div key={i}>• {b}</div>
                          ))}
                          {action.behaviors.length > 2 && (
                            <div>+{action.behaviors.length - 2} more</div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between">
        <button
          onClick={() => {
            const hasData = !!(name.trim() || description.trim() || actionIds.length > 0);
            if (hasData) {
              if (!confirm('このメッセージにはデータがあります。削除しますか？')) return;
            }
            removeMessage(sceneId, messageId);
            onClose();
          }}
          className="danger"
          style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
        >
          Delete
        </button>
        <button
          onClick={() => { handleSave(); onClose(); }}
          className="primary"
          style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
