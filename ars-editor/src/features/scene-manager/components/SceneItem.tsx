import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Scene } from '@/types/domain';

interface SceneItemProps {
  scene: Scene;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

export function SceneItem({ scene, isActive, onSelect, onRename, onDelete }: SceneItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(scene.name);
  const inputRef = useRef<HTMLInputElement>(null);

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
          : 'hover:bg-zinc-700 text-zinc-300',
      )}
      onClick={onSelect}
      onDoubleClick={() => {
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
      <button
        className={cn(
          'opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1 rounded hover:bg-red-600',
          isActive ? 'text-white' : 'text-zinc-400',
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete scene "${scene.name}"?`)) {
            onDelete();
          }
        }}
        title="Delete scene"
      >
        ✕
      </button>
    </div>
  );
}
