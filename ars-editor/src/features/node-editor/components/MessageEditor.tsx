import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { MessageType } from '@/types/generated/MessageType';
import { cn } from '@/lib/utils';
import { ModalOverlay } from '@/components/ModalOverlay';

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
  const [selectedActionId, setSelectedActionId] = useState<string>(message?.actionIds?.[0] ?? '');

  if (!message || !scene) return null;

  const sourceDomain = scene.actors[message.sourceDomainId];
  const targetDomain = scene.actors[message.targetDomainId];
  const allActions = Object.values(scene.actions ?? {});
  const selectedAction = selectedActionId ? scene.actions?.[selectedActionId] : null;

  const handleSave = () => {
    updateMessage(sceneId, messageId, {
      name,
      description,
      messageType,
      actionIds: selectedActionId ? [selectedActionId] : [],
    });
  };

  return (
    <ModalOverlay onClose={onClose} width="420px">
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
        <div className="mb-3">
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--accent)' }}>
            Action (抽象)
          </label>
          {allActions.length === 0 ? (
            <div className="text-xs italic py-1" style={{ color: 'var(--text-muted)' }}>
              Actions タブでアクションを定義してください
            </div>
          ) : (
            <>
              <select
                value={selectedActionId}
                onChange={(e) => setSelectedActionId(e.target.value)}
                className="w-full"
              >
                <option value="">-- 選択なし --</option>
                {allActions.map((action) => (
                  <option key={action.id} value={action.id}>{action.name}</option>
                ))}
              </select>
              {selectedAction && selectedAction.behaviors.length > 0 && (
                <div className="mt-1.5 rounded p-2 text-[11px]" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {selectedAction.behaviors.map((b, i) => (
                    <div key={i}>• {b}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between">
        <button
          onClick={() => {
            const hasData = !!(name.trim() || description.trim() || selectedActionId);
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
    </ModalOverlay>
  );
}
