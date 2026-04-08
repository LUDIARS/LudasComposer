import { useState, useCallback, useMemo, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useI18n } from '@/hooks/useI18n';
import { generateId } from '@/lib/utils';
import type { Component } from '@/types/domain';
import type { GameArchetype, ModuleTemplate, WizardStep, AiHearingEntry } from './types';
import { archetypes } from './archetypes';

interface ArchetypeWizardProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// AI Hearing cache (session-level)
// ---------------------------------------------------------------------------

const aiCache = new Map<string, AiHearingEntry>();

function getCachedAnswer(key: string): AiHearingEntry | undefined {
  return aiCache.get(key);
}

function setCachedAnswer(key: string, entry: AiHearingEntry): void {
  aiCache.set(key, entry);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function openGoogleSearch(keyword: string) {
  const q = encodeURIComponent(keyword);
  window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener');
}

function moduleToComponent(mod: ModuleTemplate): Component {
  return {
    id: generateId(),
    name: mod.name,
    category: mod.category,
    domain: mod.domain,
    variables: mod.variables.map((v) => ({ ...v })),
    tasks: mod.tasks.map((t) => ({
      name: t.name,
      description: t.description,
      inputs: t.inputs.map((p) => ({ ...p })),
      outputs: t.outputs.map((p) => ({ ...p })),
      testCases: null,
    })),
    dependencies: [],
    sourceModuleId: null,
  };
}

function deduplicateModules(modules: ModuleTemplate[]): ModuleTemplate[] {
  const seen = new Set<string>();
  return modules.filter((m) => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Sub-component: WizardAssistBar (Help / Google / AI)
// ---------------------------------------------------------------------------

interface WizardAssistBarProps {
  helpContent: React.ReactNode;
  searchKeyword: string;
  aiContextKey: string;
  aiQuestion: string;
}

function WizardAssistBar({ helpContent, searchKeyword, aiContextKey, aiQuestion }: WizardAssistBarProps) {
  const { t } = useI18n();
  const [showHelp, setShowHelp] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  const handleHelp = useCallback(() => {
    setShowHelp((v) => !v);
    setShowAi(false);
  }, []);

  const handleGoogle = useCallback(() => {
    openGoogleSearch(searchKeyword);
  }, [searchKeyword]);

  const handleAi = useCallback(async () => {
    setShowAi(true);
    setShowHelp(false);

    const cached = getCachedAnswer(aiContextKey);
    if (cached) {
      setAiAnswer(cached.answer);
      return;
    }

    setAiLoading(true);
    try {
      // Placeholder: in production this would call an AI endpoint.
      // For now we show the question and a helpful generic response after a small delay.
      await new Promise((r) => setTimeout(r, 600));
      const answer = t('archetypeWizard.ai.placeholder');
      const entry: AiHearingEntry = { question: aiQuestion, answer, timestamp: Date.now() };
      setCachedAnswer(aiContextKey, entry);
      setAiAnswer(answer);
    } finally {
      setAiLoading(false);
    }
  }, [aiContextKey, aiQuestion, t]);

  return (
    <div className="relative" ref={helpRef}>
      <div className="flex items-center gap-1.5">
        {/* Help button */}
        <button
          onClick={handleHelp}
          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors ${
            showHelp
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-zinc-600 text-zinc-400 hover:border-blue-500 hover:text-blue-400'
          }`}
          title={t('archetypeWizard.assist.help')}
        >
          <span className="text-xs">?</span>
          {t('archetypeWizard.assist.help')}
        </button>

        {/* Google search button */}
        <button
          onClick={handleGoogle}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-zinc-600 text-zinc-400 hover:border-green-500 hover:text-green-400 transition-colors"
          title={t('archetypeWizard.assist.google')}
        >
          <span className="text-xs">G</span>
          {t('archetypeWizard.assist.google')}
        </button>

        {/* AI hearing button */}
        <button
          onClick={handleAi}
          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors ${
            showAi
              ? 'border-purple-500 text-purple-400 bg-purple-500/10'
              : 'border-zinc-600 text-zinc-400 hover:border-purple-500 hover:text-purple-400'
          }`}
          title={t('archetypeWizard.assist.askAi')}
        >
          <span className="text-xs">AI</span>
          {t('archetypeWizard.assist.askAi')}
        </button>
      </div>

      {/* Help dropdown */}
      {showHelp && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl p-3 text-xs text-zinc-300 min-w-[260px] max-w-[380px] leading-relaxed">
          {helpContent}
          <button
            onClick={() => setShowHelp(false)}
            className="mt-2 text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            {t('common.close')}
          </button>
        </div>
      )}

      {/* AI hearing dropdown */}
      {showAi && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-800 border border-purple-600/50 rounded-lg shadow-xl p-3 text-xs text-zinc-300 min-w-[280px] max-w-[400px]">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-purple-400 font-medium text-[10px]">AI</span>
            <span className="text-zinc-500 text-[10px]">
              {getCachedAnswer(aiContextKey) ? t('archetypeWizard.ai.cached') : ''}
            </span>
          </div>
          <p className="text-zinc-400 mb-2 italic">{aiQuestion}</p>
          {aiLoading ? (
            <p className="text-zinc-500">{t('common.loading')}</p>
          ) : aiAnswer ? (
            <p className="text-zinc-300 leading-relaxed">{aiAnswer}</p>
          ) : null}
          <button
            onClick={() => setShowAi(false)}
            className="mt-2 text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            {t('common.close')}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Wizard
// ---------------------------------------------------------------------------

export function ArchetypeWizard({ onClose }: ArchetypeWizardProps) {
  const { t } = useI18n();
  const upsertComponent = useProjectStore((s) => s.upsertComponent);

  const [step, setStep] = useState<WizardStep>('archetype');
  const [selectedArchetype, setSelectedArchetype] = useState<GameArchetype | null>(null);
  const [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(new Set());
  const [injecting, setInjecting] = useState(false);

  // ---- Step navigation ----
  const handleSelectArchetype = useCallback((arch: GameArchetype) => {
    setSelectedArchetype(arch);
    // Pre-select recommended designs
    const recommended = new Set(
      arch.designPatterns.filter((d) => d.recommended).map((d) => d.id),
    );
    setSelectedDesigns(recommended);
    setStep('design');
  }, []);

  const toggleDesign = useCallback((id: string) => {
    setSelectedDesigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'design') setStep('archetype');
    else if (step === 'modules') setStep('design');
  }, [step]);

  const handleNextToModules = useCallback(() => {
    setStep('modules');
  }, []);

  // ---- Computed modules ----
  const allModules = useMemo(() => {
    if (!selectedArchetype) return [];
    const designModules = selectedArchetype.designPatterns
      .filter((d) => selectedDesigns.has(d.id))
      .flatMap((d) => d.modules);
    return deduplicateModules([...selectedArchetype.coreModules, ...designModules]);
  }, [selectedArchetype, selectedDesigns]);

  // ---- Inject into project ----
  const handleInject = useCallback(() => {
    setInjecting(true);
    for (const mod of allModules) {
      upsertComponent(moduleToComponent(mod));
    }
    setTimeout(() => {
      setInjecting(false);
      onClose();
    }, 200);
  }, [allModules, upsertComponent, onClose]);

  const stepIndex = step === 'archetype' ? 0 : step === 'design' ? 1 : 2;
  const stepLabels = [
    t('archetypeWizard.steps.archetype'),
    t('archetypeWizard.steps.design'),
    t('archetypeWizard.steps.modules'),
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-zinc-800 rounded-lg shadow-xl w-full max-w-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-white">{t('archetypeWizard.title')}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-lg leading-none">
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={`w-6 h-px ${i <= stepIndex ? 'bg-blue-500' : 'bg-zinc-600'}`} />}
              <div className={`flex items-center gap-1.5 text-xs ${
                i === stepIndex ? 'text-blue-400 font-medium' :
                i < stepIndex ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i < stepIndex ? 'bg-blue-600 text-white' :
                  i === stepIndex ? 'bg-blue-600/30 text-blue-400 ring-1 ring-blue-500' :
                  'bg-zinc-700 text-zinc-500'
                }`}>
                  {i < stepIndex ? '✓' : i + 1}
                </span>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-4 overflow-y-auto min-h-[240px]">

          {/* ===== Step 1: Archetype Selection ===== */}
          {step === 'archetype' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">{t('archetypeWizard.selectArchetype')}</p>
                <WizardAssistBar
                  helpContent={
                    <div className="space-y-1.5">
                      <p className="font-semibold text-white">{t('archetypeWizard.help.archetype.title')}</p>
                      <p>{t('archetypeWizard.help.archetype.desc')}</p>
                    </div>
                  }
                  searchKeyword="game archetype genre design pattern"
                  aiContextKey="archetype-selection"
                  aiQuestion={t('archetypeWizard.ai.archetypeQuestion')}
                />
              </div>
              <div className="space-y-2">
                {archetypes.map((arch) => (
                  <button
                    key={arch.id}
                    onClick={() => handleSelectArchetype(arch)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors hover:border-blue-500/50 hover:bg-zinc-700/50 ${
                      selectedArchetype?.id === arch.id
                        ? 'border-blue-500 bg-zinc-700/50'
                        : 'border-zinc-700 bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${arch.color} flex items-center justify-center text-base`}>
                        {arch.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-zinc-200 font-medium">{t(arch.nameKey)}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{t(arch.descKey)}</div>
                      </div>
                      <span className="text-zinc-600 text-xs">{arch.coreModules.length} {t('archetypeWizard.coreModulesCount')}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== Step 2: Design Pattern Selection ===== */}
          {step === 'design' && selectedArchetype && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  {t('archetypeWizard.selectDesign')}
                  <span className="text-zinc-600 ml-1">({t('archetypeWizard.optional')})</span>
                </p>
                <WizardAssistBar
                  helpContent={
                    <div className="space-y-1.5">
                      <p className="font-semibold text-white">{t('archetypeWizard.help.design.title')}</p>
                      <p>{t('archetypeWizard.help.design.desc')}</p>
                    </div>
                  }
                  searchKeyword={selectedArchetype.searchKeyword}
                  aiContextKey={`design-${selectedArchetype.id}`}
                  aiQuestion={t('archetypeWizard.ai.designQuestion', { archetype: t(selectedArchetype.nameKey) })}
                />
              </div>

              <div className="text-xs text-zinc-500 flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 rounded ${selectedArchetype.color} flex items-center justify-center text-[11px]`}>
                  {selectedArchetype.icon}
                </div>
                {t(selectedArchetype.nameKey)}
              </div>

              {selectedArchetype.designPatterns.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">{t('archetypeWizard.noDesigns')}</p>
              ) : (
                <div className="space-y-2">
                  {selectedArchetype.designPatterns.map((dp) => (
                    <button
                      key={dp.id}
                      onClick={() => toggleDesign(dp.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        selectedDesigns.has(dp.id)
                          ? 'border-blue-500 bg-blue-600/10'
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                          selectedDesigns.has(dp.id)
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'border-zinc-500 text-transparent'
                        }`}>
                          ✓
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-200 font-medium">{t(dp.nameKey)}</span>
                            {dp.recommended && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded">
                                {t('archetypeWizard.recommended')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">{t(dp.descKey)}</div>
                        </div>
                        <span className="text-zinc-600 text-[11px]">+{dp.modules.length}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== Step 3: Module Preview & Injection ===== */}
          {step === 'modules' && selectedArchetype && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">{t('archetypeWizard.modulePreview')}</p>
                <WizardAssistBar
                  helpContent={
                    <div className="space-y-1.5">
                      <p className="font-semibold text-white">{t('archetypeWizard.help.modules.title')}</p>
                      <p>{t('archetypeWizard.help.modules.desc')}</p>
                    </div>
                  }
                  searchKeyword={`${t(selectedArchetype.nameKey)} game components modules`}
                  aiContextKey={`modules-${selectedArchetype.id}-${[...selectedDesigns].join(',')}`}
                  aiQuestion={t('archetypeWizard.ai.modulesQuestion', { count: String(allModules.length) })}
                />
              </div>

              {/* Summary */}
              <div className="bg-zinc-900/50 rounded-lg px-4 py-3 border border-zinc-700">
                <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                  <div className={`w-5 h-5 rounded ${selectedArchetype.color} flex items-center justify-center text-[11px]`}>
                    {selectedArchetype.icon}
                  </div>
                  <span className="font-medium text-zinc-300">{t(selectedArchetype.nameKey)}</span>
                  <span className="text-zinc-600">|</span>
                  <span>{allModules.length} {t('archetypeWizard.modulesLabel')}</span>
                </div>
                {selectedDesigns.size > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedArchetype.designPatterns
                      .filter((d) => selectedDesigns.has(d.id))
                      .map((d) => (
                        <span key={d.id} className="text-[10px] px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded">
                          {t(d.nameKey)}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* Module list */}
              <div className="space-y-1">
                {allModules.map((mod, i) => {
                  const isCore = selectedArchetype.coreModules.some((c) => c.name === mod.name);
                  return (
                    <div
                      key={`${mod.name}-${i}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-700/30 border border-zinc-700/50"
                    >
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        mod.category === 'UI' ? 'bg-purple-600/20 text-purple-400' :
                        mod.category === 'Logic' ? 'bg-blue-600/20 text-blue-400' :
                        mod.category === 'System' ? 'bg-yellow-600/20 text-yellow-400' :
                        'bg-green-600/20 text-green-400'
                      }`}>
                        {mod.category}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-zinc-200">{mod.name}</span>
                        <span className="text-[10px] text-zinc-600 ml-2">{mod.domain}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span>{mod.variables.length}v</span>
                        <span>{mod.tasks.length}t</span>
                      </div>
                      {isCore && (
                        <span className="text-[10px] text-zinc-500">{t('archetypeWizard.core')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-700">
          <button
            onClick={step === 'archetype' ? onClose : handleBack}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            disabled={injecting}
          >
            {step === 'archetype' ? t('common.cancel') : t('archetypeWizard.back')}
          </button>

          {step === 'design' && (
            <button
              onClick={handleNextToModules}
              className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              {t('archetypeWizard.next')}
            </button>
          )}

          {step === 'modules' && (
            <button
              onClick={handleInject}
              disabled={injecting || allModules.length === 0}
              className="px-4 py-1.5 text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded transition-colors"
            >
              {injecting ? t('archetypeWizard.injecting') : t('archetypeWizard.inject', { count: String(allModules.length) })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
