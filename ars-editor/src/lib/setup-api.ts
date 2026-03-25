/// Infisical setup API client.

export interface SetupStatus {
  needs_setup: boolean;
}

export interface ValidateResult {
  valid: boolean;
  error: string | null;
}

export interface SaveResult {
  success: boolean;
  path: string;
}

export interface SetupConfig {
  host: string;
  client_id: string;
  client_secret: string;
  project_id: string;
  environment: string;
}

async function setupFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/setup${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function getSetupStatus(): Promise<SetupStatus> {
  return setupFetch<SetupStatus>('/status');
}

export async function validateConfig(config: SetupConfig): Promise<ValidateResult> {
  return setupFetch<ValidateResult>('/validate', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function saveConfig(config: SetupConfig): Promise<SaveResult> {
  return setupFetch<SaveResult>('/save', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}
