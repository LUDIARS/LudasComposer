import { useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useI18n } from '@/hooks/useI18n';
import * as backend from '@/lib/backend';
import type {
  TargetPlatform,
  OutputFormat,
  CodegenBridgeConfig,
  CodegenPreviewResult,
  CodegenPreviewTask,
} from '@/types/codegen';

// ── Platform card definitions ────────────────────────

interface PlatformCard {
  id: TargetPlatform;
  label: string;
  language: string;
  icon: string;
  color: string;
}

const PLATFORMS: PlatformCard[] = [
  { id: 'unity', label: 'Unity', language: 'C#', icon: 'U', color: '#4CAF50' },
  { id: 'godot', label: 'Godot', language: 'GDScript', icon: 'G', color: '#478CBF' },
  { id: 'unreal', label: 'Unreal Engine', language: 'C++', icon: 'UE', color: '#2196F3' },
  { id: 'ergo', label: 'Ergo', language: 'TypeScript', icon: 'E', color: '#FF9800' },
];

const OUTPUT_FORMATS: { id: OutputFormat; label: string; description: string }[] = [
  { id: 'source-only', label: 'Source Only', description: 'Generate source code files only' },
  { id: 'with-tests', label: 'Source + Tests', description: 'Include unit tests for each task' },
  { id: 'full', label: 'Full', description: 'Source + Tests + Documentation' },
];

// ── Dialog Steps ─────────────────────────────────────

type DialogStep = 'platform' | 'format' | 'scope' | 'preview';

const STEPS: DialogStep[] = ['platform', 'format', 'scope', 'preview'];

// ── Main Component ───────────────────────────────────

export function CodegenBridgeDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const project = useProjectStore((s) => s.project);

  const [step, setStep] = useState<DialogStep>('platform');
  const [platform, setPlatform] = useState<TargetPlatform>('ergo');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('source-only');
  const [outputDir, setOutputDir] = useState('./generated');
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [preview, setPreview] = useState<CodegenPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scenes = Object.values(project.scenes);
  const components = Object.values(project.components);

  const stepIndex = STEPS.indexOf(step);

  const buildConfig = useCallback((): CodegenBridgeConfig => ({
    platform,
    outputFormat,
    outputDir,
    sceneIds: selectedSceneIds,
    componentIds: selectedComponentIds,
    dryRun,
    maxConcurrent: 1,
  }), [platform, outputFormat, outputDir, selectedSceneIds, selectedComponentIds, dryRun]);

  const handleNext = useCallback(async () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= STEPS.length) return;

    const nextStep = STEPS[nextIndex];

    // Preview step: fetch preview from backend
    if (nextStep === 'preview') {
      setLoading(true);
      setError(null);
      try {
        const result = await backend.codegenPreview(project, buildConfig());
        setPreview(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Preview failed');
      } finally {
        setLoading(false);
      }
    }

    setStep(nextStep);
  }, [stepIndex, project, buildConfig]);

  const handleBack = useCallback(() => {
    const prevIndex = stepIndex - 1;
    if (prevIndex < 0) return;
    setStep(STEPS[prevIndex]);
  }, [stepIndex]);

  const toggleScene = useCallback((id: string) => {
    setSelectedSceneIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }, []);

  const toggleComponent = useCallback((id: string) => {
    setSelectedComponentIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

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
            {t('codegen.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-sm px-2 py-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none' }}
          >
            x
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-5 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              className="flex-1 h-1 rounded-full"
              style={{
                background: i <= stepIndex ? 'var(--accent)' : 'var(--bg-surface-2)',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: '320px' }}>
          {step === 'platform' && (
            <PlatformStep platform={platform} onChange={setPlatform} />
          )}
          {step === 'format' && (
            <FormatStep
              outputFormat={outputFormat}
              onChangeFormat={setOutputFormat}
              outputDir={outputDir}
              onChangeDir={setOutputDir}
              dryRun={dryRun}
              onChangeDryRun={setDryRun}
            />
          )}
          {step === 'scope' && (
            <ScopeStep
              scenes={scenes}
              components={components}
              selectedSceneIds={selectedSceneIds}
              selectedComponentIds={selectedComponentIds}
              onToggleScene={toggleScene}
              onToggleComponent={toggleComponent}
            />
          )}
          {step === 'preview' && (
            <PreviewStep preview={preview} loading={loading} error={error} />
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('codegen.step', { current: stepIndex + 1, total: STEPS.length })}
          </div>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                onClick={handleBack}
                className="px-4 py-1.5 text-xs rounded transition-colors"
                style={{
                  color: 'var(--text)',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border)',
                }}
              >
                {t('codegen.back')}
              </button>
            )}
            {stepIndex < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={loading}
                className="px-4 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50"
                style={{
                  color: '#fff',
                  background: 'var(--accent)',
                  border: 'none',
                }}
              >
                {loading ? t('codegen.loading') : t('codegen.next')}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-medium rounded transition-colors"
                style={{
                  color: '#fff',
                  background: 'var(--accent)',
                  border: 'none',
                }}
              >
                {t('codegen.done')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Platform Selection ───────────────────────

function PlatformStep({
  platform,
  onChange,
}: {
  platform: TargetPlatform;
  onChange: (p: TargetPlatform) => void;
}) {
  const { t } = useI18n();

  return (
    <div>
      <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
        {t('codegen.platformTitle')}
      </h3>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        {t('codegen.platformDesc')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className="flex items-center gap-3 p-3 rounded-lg text-left transition-all"
            style={{
              border: platform === p.id
                ? `2px solid ${p.color}`
                : '2px solid var(--border)',
              background: platform === p.id
                ? `${p.color}10`
                : 'var(--bg-surface-2)',
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ background: p.color }}
            >
              {p.icon}
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {p.label}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {p.language}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Output Format ────────────────────────────

function FormatStep({
  outputFormat,
  onChangeFormat,
  outputDir,
  onChangeDir,
  dryRun,
  onChangeDryRun,
}: {
  outputFormat: OutputFormat;
  onChangeFormat: (f: OutputFormat) => void;
  outputDir: string;
  onChangeDir: (d: string) => void;
  dryRun: boolean;
  onChangeDryRun: (v: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <div>
      <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
        {t('codegen.formatTitle')}
      </h3>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        {t('codegen.formatDesc')}
      </p>

      <div className="space-y-2 mb-4">
        {OUTPUT_FORMATS.map((f) => (
          <label
            key={f.id}
            className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
            style={{
              border: outputFormat === f.id
                ? '2px solid var(--accent)'
                : '2px solid var(--border)',
              background: outputFormat === f.id
                ? 'var(--accent-bg, rgba(59,130,246,0.08))'
                : 'var(--bg-surface-2)',
            }}
          >
            <input
              type="radio"
              name="outputFormat"
              value={f.id}
              checked={outputFormat === f.id}
              onChange={() => onChangeFormat(f.id)}
              className="mt-0.5 accent-blue-500"
            />
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {f.label}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {f.description}
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('codegen.outputDir')}
          </span>
          <input
            type="text"
            value={outputDir}
            onChange={(e) => onChangeDir(e.target.value)}
            className="mt-1 w-full text-sm px-3 py-1.5 rounded"
            style={{
              background: 'var(--bg-surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          />
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => onChangeDryRun(e.target.checked)}
            className="accent-blue-500"
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('codegen.dryRun')}
          </span>
        </label>
      </div>
    </div>
  );
}

// ── Step 3: Scope Selection ──────────────────────────

function ScopeStep({
  scenes,
  components,
  selectedSceneIds,
  selectedComponentIds,
  onToggleScene,
  onToggleComponent,
}: {
  scenes: { id: string; name: string }[];
  components: { id: string; name: string; category: string; domain: string }[];
  selectedSceneIds: string[];
  selectedComponentIds: string[];
  onToggleScene: (id: string) => void;
  onToggleComponent: (id: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div>
      <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
        {t('codegen.scopeTitle')}
      </h3>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        {t('codegen.scopeDesc')}
      </p>

      {/* Scenes */}
      <div className="mb-4">
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text)' }}>
          {t('codegen.scenes')} ({scenes.length})
        </div>
        {scenes.length === 0 ? (
          <div className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
            {t('codegen.noScenes')}
          </div>
        ) : (
          <div className="space-y-1">
            {scenes.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors"
                style={{
                  background: selectedSceneIds.includes(s.id)
                    ? 'var(--accent-bg, rgba(59,130,246,0.08))'
                    : 'transparent',
                  color: 'var(--text)',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedSceneIds.includes(s.id)}
                  onChange={() => onToggleScene(s.id)}
                  className="accent-blue-500"
                />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Components */}
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text)' }}>
          {t('codegen.components')} ({components.length})
        </div>
        {components.length === 0 ? (
          <div className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
            {t('codegen.noComponents')}
          </div>
        ) : (
          <div className="space-y-1">
            {components.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors"
                style={{
                  background: selectedComponentIds.includes(c.id)
                    ? 'var(--accent-bg, rgba(59,130,246,0.08))'
                    : 'transparent',
                  color: 'var(--text)',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedComponentIds.includes(c.id)}
                  onChange={() => onToggleComponent(c.id)}
                  className="accent-blue-500"
                />
                <span>{c.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  [{c.category}] {c.domain}
                </span>
              </label>
            ))}
          </div>
        )}

        <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
          {t('codegen.scopeHint')}
        </p>
      </div>
    </div>
  );
}

// ── Step 4: Preview ──────────────────────────────────

function PreviewStep({
  preview,
  loading,
  error,
}: {
  preview: CodegenPreviewResult | null;
  loading: boolean;
  error: string | null;
}) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('codegen.loading')}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <div className="text-sm mb-2" style={{ color: 'var(--red, #ef4444)' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div>
      <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
        {t('codegen.previewTitle')}
      </h3>

      {/* Summary */}
      <div
        className="rounded-lg p-3 mb-4"
        style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
      >
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{t('codegen.language')}: </span>
            <span style={{ color: 'var(--text)' }}>{preview.language}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{t('codegen.extension')}: </span>
            <span style={{ color: 'var(--text)' }}>{preview.fileExtension}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{t('codegen.totalTasks')}: </span>
            <span style={{ color: 'var(--text)' }}>{preview.totalTasks}</span>
          </div>
        </div>
      </div>

      {/* Task list */}
      {preview.tasks.length === 0 ? (
        <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
          {t('codegen.noTasks')}
        </div>
      ) : (
        <div className="space-y-2">
          {preview.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: CodegenPreviewTask }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
        style={{ background: 'transparent', border: 'none', color: 'var(--text)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{
              background: task.taskType === 'component' ? 'var(--accent)' : 'var(--green, #22c55e)',
              color: '#fff',
            }}
          >
            {task.taskType}
          </span>
          <span className="text-xs font-medium">{task.name}</span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {expanded ? '-' : '+'}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 text-[11px] space-y-1" style={{ color: 'var(--text-muted)' }}>
          <div>Output: {task.outputDir}</div>
          {task.dependencies.length > 0 && (
            <div>Dependencies: {task.dependencies.join(', ')}</div>
          )}
          <pre
            className="mt-1 p-2 rounded text-[10px] overflow-x-auto whitespace-pre-wrap"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
          >
            {task.promptPreview}
          </pre>
        </div>
      )}
    </div>
  );
}
