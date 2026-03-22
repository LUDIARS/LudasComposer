import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Scene } from '@/types/domain';
import { useCollabStore } from '@/stores/collabStore';
import { useAuthStore } from '@/stores/authStore';
import { useI18n } from '@/hooks/useI18n';

interface SceneItemProps {
  scene: Scene;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

export function SceneItem({ scene, isActive, onSelect, onRename, onDelete }: SceneItemProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(scene.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const locks = useCollabStore((s) => s.locks);
  const users = useCollabStore((s) => s.users);
  const requestLock = useCollabStore((s) => s.requestLock);
  const releaseLock = useCollabStore((s) => s.releaseLock);
  const connected = useCollabStore((s) => s.connected);
  const currentUser = useAuthStore((s) => s.user);

  const lockKey = `scene:${scene.id}`;
  const lock = locks.get(lockKey);
  const isLockedByOther = lock != null && lock.user_id !== currentUser?.id;
  const isLockedByMe = lock != null && lock.user_id === currentUser?.id;
  const lockOwner = lock ? users.get(lock.user_id) : null;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== scene.name) {
      onRename(trimmed);
    } else {
      setEditName(scene.name);
    }
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors',
        isActive
          ? 'bg-blue-600 text-white'
          : isLockedByOther
            ? 'bg-zinc-800/50 text-zinc-500'
            : 'hover:bg-zinc-700 text-zinc-300',
      )}
      onClick={() => {
        onSelect();
        if (connected && currentUser && !isLockedByOther) {
          requestLock(lockKey, scene.name);
        }
      }}
      onDoubleClick={() => {
        if (isLockedByOther) return;
        setEditName(scene.name);
        setIsEditing(true);
      }}
    >
      <span className="text-base">🎬</span>
      {isEditing ? (
        <input
          ref={inputRef}
          className="flex-1 bg-zinc-900 text-white px-1 py-0.5 rounded text-sm outline-none border border-zinc-500"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') {
              setEditName(scene.name);
              setIsEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate">{scene.name}</span>
      )}
      {isLockedByOther && lockOwner && (
        <span
          className="text-[10px] px-1 rounded"
          style={{ backgroundColor: lockOwner.color, color: 'white' }}
          title={`Locked by ${lock.display_name}`}
        >
          {lock.display_name}
        </span>
      )}
      {isLockedByMe && connected && (
        <button
          className="text-[10px] text-green-400 opacity-60 hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            releaseLock(lockKey);
          }}
          title="Release lock"
        >
          🔓
        </button>
      )}
      <button
        className={cn(
          'opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1 rounded hover:bg-red-600',
          isActive ? 'text-white' : 'text-zinc-400',
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(t('sceneManager.deleteConfirm', { name: scene.name }))) {
            onDelete();
          }
        }}
        title={t('sceneManager.deleteTitle')}
      >
        ✕
      </button>
    </div>
  );
}
