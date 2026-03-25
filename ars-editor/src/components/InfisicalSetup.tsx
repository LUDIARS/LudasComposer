import { useState, useCallback } from 'react';
import { useI18n } from '@/hooks/useI18n';
import * as setupApi from '@/lib/setup-api';

type Step = 'connection' | 'credentials' | 'verify';

const STEP_ORDER: Step[] = ['connection', 'credentials', 'verify'];

export function InfisicalSetup() {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('connection');
  const [host, setHost] = useState('https://app.infisical.com');
  const [environment, setEnvironment] = useState('dev');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [projectId, setProjectId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(false);
  const [savedPath, setSavedPath] = useState('');

  const stepIndex = STEP_ORDER.indexOf(step);

  const config: setupApi.SetupConfig = {
    host: host.trim(),
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    project_id: projectId.trim(),
    environment: environment.trim(),
  };

  const handleNext = useCallback(() => {
    setError('');
    if (step === 'connection') {
      if (!host.trim()) return;
      setStep('credentials');
    } else if (step === 'credentials') {
      if (!clientId.trim() || !clientSecret.trim() || !projectId.trim()) return;
      setStep('verify');
    }
  }, [step, host, clientId, clientSecret, projectId]);

  const handleBack = useCallback(() => {
    setError('');
    setValidated(false);
    if (step === 'credentials') setStep('connection');
    else if (step === 'verify') setStep('credentials');
  }, [step]);

  const handleValidate = useCallback(async () => {
    setLoading(true);
    setError('');
    setValidated(false);
    try {
      const result = await setupApi.validateConfig(config);
      if (result.valid) {
        setValidated(true);
      } else {
        setError(t('setup.validationFailed', { error: result.error || 'Unknown error' }));
      }
    } catch (e) {
      setError(t('setup.validationFailed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLoading(false);
    }
  }, [config, t]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await setupApi.saveConfig(config);
      if (result.success) {
        setSavedPath(result.path);
        // The server will restart automatically; reload after a brief delay.
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [config]);

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-zinc-900 text-zinc-200">
      <div className="bg-zinc-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-white">{t('setup.title')}</h2>
          <p className="text-xs text-zinc-400 mt-1">{t('setup.subtitle')}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          {STEP_ORDER.map((s, i) => {
            const labelKey = `setup.steps.${s}` as const;
            return (
              <div key={s} className="flex items-center gap-2">
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
                    {i < stepIndex ? '\u2713' : i + 1}
                  </span>
                  {t(labelKey)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-4 min-h-[260px]">
          {/* Step 1: Connection */}
          {step === 'connection' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('setup.host')}</label>
                <input
                  type="url"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder={t('setup.hostPlaceholder')}
                  autoFocus
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">{t('setup.hostHelp')}</p>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('setup.environment')}</label>
                <input
                  type="text"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  placeholder={t('setup.environmentPlaceholder')}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">{t('setup.environmentHelp')}</p>
              </div>
            </div>
          )}

          {/* Step 2: Credentials */}
          {step === 'credentials' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">{t('setup.credentialsHelp')}</p>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('setup.clientId')}</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={t('setup.clientIdPlaceholder')}
                  autoFocus
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('setup.clientSecret')}</label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={t('setup.clientSecretPlaceholder')}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('setup.projectId')}</label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder={t('setup.projectIdPlaceholder')}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Step 3: Verify & Save */}
          {step === 'verify' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="space-y-2 bg-zinc-700/50 rounded p-3">
                <div className="text-xs">
                  <span className="text-zinc-500">{t('setup.host')}:</span>{' '}
                  <span className="text-zinc-200">{host}</span>
                </div>
                <div className="text-xs">
                  <span className="text-zinc-500">{t('setup.environment')}:</span>{' '}
                  <span className="text-zinc-200">{environment}</span>
                </div>
                <div className="text-xs">
                  <span className="text-zinc-500">{t('setup.clientId')}:</span>{' '}
                  <span className="text-zinc-200 font-mono">{clientId.slice(0, 8)}...</span>
                </div>
                <div className="text-xs">
                  <span className="text-zinc-500">{t('setup.projectId')}:</span>{' '}
                  <span className="text-zinc-200 font-mono">{projectId.slice(0, 8)}...</span>
                </div>
              </div>

              {!validated && !savedPath && (
                <button
                  onClick={handleValidate}
                  disabled={loading}
                  className="w-full px-4 py-2 text-xs bg-zinc-600 hover:bg-zinc-500 disabled:opacity-50 text-white rounded transition-colors"
                >
                  {loading ? t('setup.validating') : t('setup.validate')}
                </button>
              )}

              {validated && !savedPath && (
                <div className="px-3 py-2 bg-green-900/30 border border-green-700/50 rounded text-xs text-green-400">
                  {t('setup.validationSuccess')}
                </div>
              )}

              {savedPath && (
                <div className="px-3 py-2 bg-green-900/30 border border-green-700/50 rounded text-xs text-green-400">
                  {t('setup.saveSuccess', { path: savedPath })}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-700">
          <button
            onClick={handleBack}
            disabled={step === 'connection' || loading || !!savedPath}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-colors"
          >
            {t('setup.back')}
          </button>

          <div className="flex items-center gap-2">
            {step !== 'verify' && (
              <button
                onClick={handleNext}
                disabled={
                  loading ||
                  (step === 'connection' && !host.trim()) ||
                  (step === 'credentials' && (!clientId.trim() || !clientSecret.trim() || !projectId.trim()))
                }
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {t('setup.next')}
              </button>
            )}

            {step === 'verify' && validated && !savedPath && (
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {loading ? t('setup.saving') : t('setup.save')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
