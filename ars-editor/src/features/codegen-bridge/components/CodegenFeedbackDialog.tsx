import { useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import * as backend from '@/lib/backend';
import type {
  CodegenBridgeConfig,
  FeedbackReport,
  ApplyResult,
  FileChange,
} from '@/types/codegen';

// ── Badge helpers ───────────────────────────────────

function changeBadge(change: string) {
  switch (change) {
    case 'added':
      return { label: 'ADD', bg: '#4CAF50', fg: '#fff' };
    case 'modified':
      return { label: 'MOD', bg: '#FF9800', fg: '#fff' };
    case 'removed':
      return { label: 'DEL', bg: '#f44336', fg: '#fff' };
    default:
      return { label: change, bg: '#888', fg: '#fff' };
  }
}

function kindBadge(kind: string) {
  switch (kind) {
    case 'code':
      return { label: 'code', color: '#2196F3' };
    case 'codedesign':
      return { label: 'design', color: '#9C27B0' };
    case 'project':
      return { label: 'project', color: '#FF5722' };
    default:
      return { label: kind, color: '#888' };
  }
}

// ── Main Component ──────────────────────────────────

type Phase = 'detect' | 'report' | 'applied';

export function CodegenFeedbackDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);
  const projectPath = useEditorStore((s) => s.projectPath);

  const [phase, setPhase] = useState<Phase>('detect');
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputDir, setOutputDir] = useState('./generated');
  const [markStale, setMarkStale] = useState(true);
  const [createBackup, setCreateBackup] = useState(true);

  const buildConfig = useCallback((): CodegenBridgeConfig => ({
    platform: 'ergo',
    outputFormat: 'source-only',
    outputDir,
    sceneIds: [],
    componentIds: [],
    dryRun: false,
    maxConcurrent: 1,
  }), [outputDir]);

  // Auto-detect on mount
  useEffect(() => {
    if (!projectPath) return;
    handleDetect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDetect = useCallback(async () => {
    if (!projectPath) {
      setError('Project file path is not set. Save your project first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await backend.codegenFeedback(projectPath, buildConfig());
      setReport(result);
      setPhase('report');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Feedback detection failed');
    } finally {
      setLoading(false);
    }
  }, [projectPath, buildConfig]);

  const handleApply = useCallback(async () => {
    if (!projectPath || !report) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await backend.codegenApply(projectPath, project, buildConfig(), {
        markCodeStale: markStale,
        backupProject: createBackup,
      });
      setApplyResult(resp.result);
      // Update UI project state with the mutated Project
      loadProject(resp.project);
      setPhase('applied');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setLoading(false);
    }
  }, [projectPath, project, report, buildConfig, markStale, createBackup, loadProject]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const hasChanges = report && (report.changes.length > 0 || report.projectChanged);
  const hasCodedesignChanges = report?.changes.some(
    (c) => c.kind === 'codedesign' && c.change !== 'removed',
  );
  const hasCodeChanges = report?.changes.some(
    (c) => c.kind === 'code' && c.change !== 'removed',
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          width: '640px',
          maxHeight: '80vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Code Feedback
          </h2>
          <button
            onClick={onClose}
            className="text-sm px-2 py-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none' }}
          >
            x
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: '200px' }}>
          {error && (
            <div
              className="text-xs px-3 py-2 rounded mb-3"
              style={{ background: '#f443361a', color: '#f44336', border: '1px solid #f4433644' }}
            >
              {error}
            </div>
          )}

          {/* Detect phase */}
          {phase === 'detect' && !loading && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Detect changes in generated code and codedesign since the last sync.
              </p>
              <div className="space-y-2">
                <label className="block text-xs font-medium" style={{ color: 'var(--text)' }}>
                  Output Directory
                </label>
                <input
                  type="text"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              {!projectPath && (
                <p className="text-xs" style={{ color: '#FF9800' }}>
                  Save your project to a file before running feedback.
                </p>
              )}
            </div>
          )}

          {/* Report phase */}
          {phase === 'report' && report && (
            <div className="space-y-3">
              {report.manifestMissing && (
                <div
                  className="text-xs px-3 py-2 rounded"
                  style={{ background: '#2196F31a', color: '#2196F3', border: '1px solid #2196F344' }}
                >
                  No manifest found. Run Code Generation first to establish a baseline.
                </div>
              )}

              {!hasChanges && !report.manifestMissing && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No changes detected.
                </p>
              )}

              {hasChanges && (
                <>
                  {/* Summary */}
                  <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>
                      Added: <strong style={{ color: '#4CAF50' }}>{report.changes.filter(c => c.change === 'added').length}</strong>
                    </span>
                    <span>
                      Modified: <strong style={{ color: '#FF9800' }}>{report.changes.filter(c => c.change === 'modified').length}</strong>
                    </span>
                    <span>
                      Removed: <strong style={{ color: '#f44336' }}>{report.changes.filter(c => c.change === 'removed').length}</strong>
                    </span>
                    {report.projectChanged && (
                      <span style={{ color: '#FF5722' }}>Project file changed</span>
                    )}
                  </div>

                  {/* Change list */}
                  <div
                    className="rounded overflow-hidden"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    {report.changes.map((c, i) => (
                      <ChangeRow key={i} change={c} />
                    ))}
                  </div>

                  {/* Apply options */}
                  <div
                    className="space-y-2 pt-2"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                      Apply Options
                    </p>
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text)' }}>
                      <input
                        type="checkbox"
                        checked={markStale}
                        onChange={(e) => setMarkStale(e.target.checked)}
                      />
                      Mark stale codedesign when code changes
                      {hasCodeChanges && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          ({report.changes.filter(c => c.kind === 'code' && c.change !== 'removed').length} files)
                        </span>
                      )}
                    </label>
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text)' }}>
                      <input
                        type="checkbox"
                        checked={createBackup}
                        onChange={(e) => setCreateBackup(e.target.checked)}
                      />
                      Create project backup before apply
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Applied phase */}
          {phase === 'applied' && applyResult && (
            <div className="space-y-3">
              <div
                className="text-xs px-3 py-2 rounded"
                style={{ background: '#4CAF501a', color: '#4CAF50', border: '1px solid #4CAF5044' }}
              >
                Feedback applied successfully.
              </div>

              {applyResult.backupPath && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Backup: <code style={{ color: 'var(--text)' }}>{applyResult.backupPath}</code>
                </p>
              )}

              {applyResult.applied.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>
                    Applied to Project ({applyResult.applied.length})
                  </p>
                  <div
                    className="rounded text-xs space-y-1 p-2"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
                  >
                    {applyResult.applied.map((a, i) => (
                      <div key={i} style={{ color: 'var(--text)' }}>
                        <span style={{ color: '#4CAF50' }}>{a.entityName || a.path}</span>
                        {' — '}
                        <span style={{ color: 'var(--text-muted)' }}>{a.summary}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {applyResult.staleMarked.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>
                    Stale markers added ({applyResult.staleMarked.length})
                  </p>
                  <div
                    className="rounded text-xs space-y-1 p-2"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
                  >
                    {applyResult.staleMarked.map((s, i) => (
                      <div key={i} style={{ color: '#FF9800' }}>{s}</div>
                    ))}
                  </div>
                </div>
              )}

              {applyResult.requiresReview.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: '#FF9800' }}>
                    Requires Review ({applyResult.requiresReview.length})
                  </p>
                  <div
                    className="rounded text-xs space-y-1 p-2"
                    style={{ background: '#FF98001a', border: '1px solid #FF980044' }}
                  >
                    {applyResult.requiresReview.map((r, i) => (
                      <div key={i} style={{ color: 'var(--text)' }}>
                        <span>{r.entityName || r.path}</span>
                        {' — '}
                        <span style={{ color: 'var(--text-muted)' }}>{r.summary}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading spinner */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {phase === 'detect' ? 'Detecting changes...' : 'Applying changes...'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {phase === 'report' && hasChanges && (
              <>
                {hasCodedesignChanges && 'Codedesign changes will update the Project. '}
                {hasCodeChanges && 'Code changes will mark codedesign as stale.'}
              </>
            )}
          </div>
          <div className="flex gap-2">
            {phase === 'applied' && (
              <button
                onClick={onClose}
                className="text-xs px-4 py-1.5 rounded font-medium"
                style={{
                  background: 'var(--green)',
                  color: '#fff',
                  border: 'none',
                }}
              >
                Done
              </button>
            )}
            {phase === 'detect' && (
              <button
                onClick={handleDetect}
                disabled={loading || !projectPath}
                className="text-xs px-4 py-1.5 rounded font-medium"
                style={{
                  background: loading || !projectPath ? 'var(--border)' : 'var(--blue)',
                  color: '#fff',
                  border: 'none',
                  opacity: loading || !projectPath ? 0.5 : 1,
                }}
              >
                Detect Changes
              </button>
            )}
            {phase === 'report' && (
              <>
                <button
                  onClick={() => { setPhase('detect'); setReport(null); }}
                  className="text-xs px-4 py-1.5 rounded"
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Back
                </button>
                {hasChanges && (
                  <button
                    onClick={handleApply}
                    disabled={loading}
                    className="text-xs px-4 py-1.5 rounded font-medium"
                    style={{
                      background: loading ? 'var(--border)' : '#FF9800',
                      color: '#fff',
                      border: 'none',
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    Apply Changes
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────

function ChangeRow({ change }: { change: FileChange }) {
  const cb = changeBadge(change.change);
  const kb = kindBadge(change.kind);
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-xs"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span
        className="px-1.5 py-0.5 rounded text-[10px] font-bold"
        style={{ background: cb.bg, color: cb.fg, minWidth: '32px', textAlign: 'center' }}
      >
        {cb.label}
      </span>
      <span
        className="px-1.5 py-0.5 rounded text-[10px]"
        style={{ color: kb.color, border: `1px solid ${kb.color}44` }}
      >
        {kb.label}
      </span>
      <span className="flex-1 truncate" style={{ color: 'var(--text)' }}>
        {change.path}
      </span>
      {change.entityName && (
        <span style={{ color: 'var(--text-muted)' }}>{change.entityName}</span>
      )}
    </div>
  );
}
