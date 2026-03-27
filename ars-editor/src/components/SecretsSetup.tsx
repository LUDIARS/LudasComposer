import { useState, useCallback } from 'react';
import { useI18n } from '@/hooks/useI18n';
import * as setupApi from '@/lib/setup-api';
import type { SecretsProvider, SetupConfig } from '@/lib/setup-api';

type Step = 'provider' | 'config' | 'verify';

const STEP_ORDER: Step[] = ['provider', 'config', 'verify'];

export function SecretsSetup() {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('provider');
  const [provider, setProvider] = useState<SecretsProvider>('aws-ssm');

  // Infisical fields
  const [host, setHost] = useState('https://app.infisical.com');
  const [environment, setEnvironment] = useState('dev');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [projectId, setProjectId] = useState('');

  // AWS SSM fields
  const [region, setRegion] = useState('');
  const [pathPrefix, setPathPrefix] = useState('/ars');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(false);
  const [savedPath, setSavedPath] = useState('');

  const stepIndex = STEP_ORDER.indexOf(step);

  const buildConfig = useCallback((): SetupConfig => {
    if (provider === 'infisical') {
      return {
        provider: 'infisical',
        host: host.trim(),
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        project_id: projectId.trim(),
        environment: environment.trim(),
      };
    }
    return {
      provider: 'aws-ssm',
      region: region.trim() || null,
      path_prefix: pathPrefix.trim() || null,
    };
  }, [provider, host, environment, clientId, clientSecret, projectId, region, pathPrefix]);

  const canProceedConfig = useCallback((): boolean => {
    if (provider === 'infisical') {
      return !!(host.trim() && clientId.trim() && clientSecret.trim() && projectId.trim());
    }
    // AWS SSM: region optional (can come from env), path_prefix has default
    return true;
  }, [provider, host, clientId, clientSecret, projectId]);

  const handleNext = useCallback(() => {
    setError('');
    setValidated(false);
    if (step === 'provider') {
      setStep('config');
    } else if (step === 'config') {
      if (!canProceedConfig()) return;
      setStep('verify');
    }
  }, [step, canProceedConfig]);

  const handleBack = useCallback(() => {
    setError('');
    setValidated(false);
    if (step === 'config') setStep('provider');
    else if (step === 'verify') setStep('config');
  }, [step]);

  const handleValidate = useCallback(async () => {
    setLoading(true);
    setError('');
    setValidated(false);
    try {
      const result = await setupApi.validateConfig(buildConfig());
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
  }, [buildConfig, t]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await setupApi.saveConfig(buildConfig());
      if (result.success) {
        setSavedPath(result.path);
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [buildConfig]);

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
            const labelKey = `setup.steps.${s}`;
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
        <div className="flex-1 px-5 py-4 min-h-[300px]">
          {/* Step 1: Provider Selection */}
          {step === 'provider' && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">{t('setup.providerDescription')}</p>

              <button
                onClick={() => setProvider('aws-ssm')}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  provider === 'aws-ssm'
                    ? 'border-blue-500 bg-blue-600/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <div>
                    <div className="text-sm text-zinc-200 font-medium">AWS SSM Parameter Store</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{t('setup.awsSsmDescription')}</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setProvider('infisical')}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  provider === 'infisical'
                    ? 'border-blue-500 bg-blue-600/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div>
                    <div className="text-sm text-zinc-200 font-medium">Infisical</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{t('setup.infisicalDescription')}</div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Step 2: Provider-specific Config */}
          {step === 'config' && provider === 'aws-ssm' && (
            <div className="space-y-4">
              {/* Environment variables guide */}
              <div className="bg-zinc-700/50 rounded p-3 space-y-2">
                <p className="text-xs text-zinc-300 font-medium">{t('setup.awsEnvVarsTitle')}</p>
                <p className="text-[10px] text-zinc-400">{t('setup.awsEnvVarsDescription')}</p>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400">AWS_ACCESS_KEY_ID</span>
                    <span className="text-zinc-500">= &lt;your-access-key&gt;</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400">AWS_SECRET_ACCESS_KEY</span>
                    <span className="text-zinc-500">= &lt;your-secret-key&gt;</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400">AWS_REGION</span>
                    <span className="text-zinc-500">= ap-northeast-1</span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500">{t('setup.awsEnvVarsAlt')}</p>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('setup.awsRegion')}</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder={t('setup.awsRegionPlaceholder')}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">{t('setup.awsRegionHelp')}</p>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('setup.awsPathPrefix')}</label>
                <input
                  type="text"
                  value={pathPrefix}
                  onChange={(e) => setPathPrefix(e.target.value)}
                  placeholder="/ars"
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
                <p className="text-[10px] text-zinc-500 mt-1">{t('setup.awsPathPrefixHelp')}</p>
              </div>

              {/* SSM parameter naming guide */}
              <div className="bg-zinc-700/30 rounded p-3">
                <p className="text-[10px] text-zinc-400 font-medium mb-1">{t('setup.awsParamGuideTitle')}</p>
                <div className="font-mono text-[10px] text-zinc-500 space-y-0.5">
                  <div>{pathPrefix || '/ars'}/shared/GITHUB_CLIENT_ID</div>
                  <div>{pathPrefix || '/ars'}/shared/GITHUB_CLIENT_SECRET</div>
                  <div>{pathPrefix || '/ars'}/shared/GITHUB_REDIRECT_URI</div>
                  <div>{pathPrefix || '/ars'}/shared/REDIS_URL</div>
                  <div>{pathPrefix || '/ars'}/shared/SURREALDB_DATA_DIR</div>
                </div>
              </div>
            </div>
          )}

          {step === 'config' && provider === 'infisical' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">{t('setup.infisicalCredentialsHelp')}</p>
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('setup.clientId')}</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder={t('setup.clientIdPlaceholder')}
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
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('setup.environment')}</label>
                  <input
                    type="text"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    placeholder={t('setup.environmentPlaceholder')}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Verify & Save */}
          {step === 'verify' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="space-y-2 bg-zinc-700/50 rounded p-3">
                <div className="text-xs">
                  <span className="text-zinc-500">{t('setup.steps.provider')}:</span>{' '}
                  <span className="text-zinc-200 font-medium">
                    {provider === 'aws-ssm' ? 'AWS SSM Parameter Store' : 'Infisical'}
                  </span>
                </div>
                {provider === 'aws-ssm' && (
                  <>
                    <div className="text-xs">
                      <span className="text-zinc-500">{t('setup.awsRegion')}:</span>{' '}
                      <span className="text-zinc-200 font-mono">{region || t('setup.awsRegionFromEnv')}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-zinc-500">{t('setup.awsPathPrefix')}:</span>{' '}
                      <span className="text-zinc-200 font-mono">{pathPrefix || '/ars'}</span>
                    </div>
                  </>
                )}
                {provider === 'infisical' && (
                  <>
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
                  </>
                )}
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
            disabled={step === 'provider' || loading || !!savedPath}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-colors"
          >
            {t('setup.back')}
          </button>

          <div className="flex items-center gap-2">
            {step !== 'verify' && (
              <button
                onClick={handleNext}
                disabled={loading || (step === 'config' && !canProceedConfig())}
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
