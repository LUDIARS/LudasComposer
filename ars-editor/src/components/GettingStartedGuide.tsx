import { useState } from 'react';
import { useI18n } from '@/hooks/useI18n';

interface GettingStartedGuideProps {
  onClose: () => void;
}

interface Step {
  number: number;
  title: string;
  description: string;
  details: string[];
  tips: string[];
}

export function GettingStartedGuide({ onClose }: GettingStartedGuideProps) {
  const { t } = useI18n();
  const [activeStep, setActiveStep] = useState(0);

  const steps: Step[] = [
    {
      number: 1,
      title: t('gettingStarted.step1.title'),
      description: t('gettingStarted.step1.description'),
      details: [
        t('gettingStarted.step1.details.0'),
        t('gettingStarted.step1.details.1'),
        t('gettingStarted.step1.details.2'),
      ],
      tips: [
        t('gettingStarted.step1.tips.0'),
        t('gettingStarted.step1.tips.1'),
      ],
    },
    {
      number: 2,
      title: t('gettingStarted.step2.title'),
      description: t('gettingStarted.step2.description'),
      details: [
        t('gettingStarted.step2.details.0'),
        t('gettingStarted.step2.details.1'),
        t('gettingStarted.step2.details.2'),
        t('gettingStarted.step2.details.3'),
      ],
      tips: [
        t('gettingStarted.step2.tips.0'),
        t('gettingStarted.step2.tips.1'),
      ],
    },
    {
      number: 3,
      title: t('gettingStarted.step3.title'),
      description: t('gettingStarted.step3.description'),
      details: [
        t('gettingStarted.step3.details.0'),
        t('gettingStarted.step3.details.1'),
        t('gettingStarted.step3.details.2'),
        t('gettingStarted.step3.details.3'),
      ],
      tips: [
        t('gettingStarted.step3.tips.0'),
        t('gettingStarted.step3.tips.1'),
        t('gettingStarted.step3.tips.2'),
      ],
    },
    {
      number: 4,
      title: t('gettingStarted.step4.title'),
      description: t('gettingStarted.step4.description'),
      details: [
        t('gettingStarted.step4.details.0'),
        t('gettingStarted.step4.details.1'),
        t('gettingStarted.step4.details.2'),
        t('gettingStarted.step4.details.3'),
      ],
      tips: [
        t('gettingStarted.step4.tips.0'),
        t('gettingStarted.step4.tips.1'),
      ],
    },
    {
      number: 5,
      title: t('gettingStarted.step5.title'),
      description: t('gettingStarted.step5.description'),
      details: [
        t('gettingStarted.step5.details.0'),
        t('gettingStarted.step5.details.1'),
        t('gettingStarted.step5.details.2'),
        t('gettingStarted.step5.details.3'),
      ],
      tips: [
        t('gettingStarted.step5.tips.0'),
        t('gettingStarted.step5.tips.1'),
      ],
    },
  ];

  const step = steps[activeStep];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[640px] max-w-[90vw] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div>
            <h2 className="text-lg font-bold text-white">{t('gettingStarted.title')}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t('gettingStarted.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Step Navigation */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-zinc-800 overflow-x-auto">
          {steps.map((s, i) => (
            <button
              key={s.number}
              onClick={() => setActiveStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                i === activeStep
                  ? 'bg-blue-600 text-white'
                  : i < activeStep
                    ? 'bg-green-900/40 text-green-400 border border-green-800'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                  i === activeStep
                    ? 'bg-white text-blue-600'
                    : i < activeStep
                      ? 'bg-green-400 text-green-900'
                      : 'bg-zinc-600 text-zinc-300'
                }`}
              >
                {i < activeStep ? '✓' : s.number}
              </span>
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Step Title */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
                {step.number}
              </span>
              <div>
                <h3 className="text-base font-semibold text-white">
                  {step.title}
                </h3>
              </div>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Details */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              {t('gettingStarted.steps')}
            </h4>
            <ol className="space-y-2">
              {step.details.map((detail, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-zinc-300"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {detail}
                </li>
              ))}
            </ol>
          </div>

          {/* Tips */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
              {t('gettingStarted.tipsLabel')}
            </h4>
            <ul className="space-y-1.5">
              {step.tips.map((tip, i) => (
                <li
                  key={i}
                  className="text-xs text-zinc-400 flex items-start gap-2"
                >
                  <span className="text-amber-400 mt-0.5 shrink-0">*</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-700">
          <button
            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
            disabled={activeStep === 0}
            className="text-sm px-4 py-1.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t('gettingStarted.previous')}
          </button>
          <span className="text-xs text-zinc-500">
            {activeStep + 1} / {steps.length}
          </span>
          {activeStep < steps.length - 1 ? (
            <button
              onClick={() => setActiveStep(activeStep + 1)}
              className="text-sm px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              {t('gettingStarted.next')}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-sm px-4 py-1.5 rounded bg-green-600 text-white hover:bg-green-500 transition-colors"
            >
              {t('gettingStarted.start')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
