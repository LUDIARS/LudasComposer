import { useState, useEffect, useCallback } from 'react';
import * as backend from '@/lib/backend';
import { safeLoadProject } from '@/lib/project-loader';

interface ProjectListDialogProps {
  onClose: () => void;
}

export function ProjectListDialog({ onClose }: ProjectListDialogProps) {

  const [projects, setProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    backend.listProjects()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleOpen = useCallback(async (filename: string) => {
    try {
      const defaultDir = await backend.getDefaultProjectPath();
      const path = `${defaultDir}/${filename}`;
      const project = await backend.loadProject(path);
      safeLoadProject(project, path);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-zinc-800 rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-white">Open Project</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && <div className="text-zinc-500 text-sm py-4 text-center">Loading...</div>}

          {error && (
            <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-400 mb-3">
              {error}
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="text-zinc-500 text-sm py-4 text-center">
              No saved projects found.
            </div>
          )}

          <div className="space-y-1">
            {projects.map((filename) => (
              <button
                key={filename}
                onClick={() => handleOpen(filename)}
                className="w-full text-left px-4 py-3 rounded-lg border border-zinc-700 hover:border-blue-500/50 hover:bg-zinc-700/50 transition-colors"
              >
                <div className="text-sm text-zinc-200">{filename.replace(/\.json$/, '')}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{filename}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
