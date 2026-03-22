import type {
  TerpsichoreConfig,
  ServerStatus,
  CommandRequest,
  CommandResult,
  CompileStatus,
  BuildRequest,
  BuildStatus,
  GameStatus,
} from '../types';

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(command, args);
}

// Server management via Tauri commands
export async function getServerConfig(): Promise<TerpsichoreConfig> {
  return invoke<TerpsichoreConfig>('get_server_config');
}

export async function updateServerConfig(config: TerpsichoreConfig): Promise<void> {
  return invoke<void>('update_server_config', { config });
}

export async function getServerStatus(): Promise<ServerStatus> {
  return invoke<ServerStatus>('get_server_status');
}

export async function startServer(): Promise<void> {
  return invoke<void>('start_server');
}

export async function stopServer(): Promise<void> {
  return invoke<void>('stop_server');
}

// Direct HTTP API calls to the command server
export class TerpsichoreClient {
  private baseUrl: string;
  private token: string;

  constructor(host = '127.0.0.1', port = 8686, token = '') {
    this.baseUrl = `http://${host}:${port}`;
    this.token = token;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`;
    }
    return h;
  }

  async health(): Promise<{ status: string }> {
    const resp = await fetch(`${this.baseUrl}/api/health`);
    return resp.json();
  }

  async status(): Promise<ServerStatus> {
    const resp = await fetch(`${this.baseUrl}/api/status`);
    return resp.json();
  }

  async compileStatus(): Promise<CompileStatus> {
    const resp = await fetch(`${this.baseUrl}/api/compile-status`);
    return resp.json();
  }

  async buildStatus(): Promise<BuildStatus> {
    const resp = await fetch(`${this.baseUrl}/api/build-status`);
    return resp.json();
  }

  async gameStatus(): Promise<GameStatus> {
    const resp = await fetch(`${this.baseUrl}/api/game-status`);
    return resp.json();
  }

  async executeCommand(request: CommandRequest): Promise<CommandResult> {
    const resp = await fetch(`${this.baseUrl}/api/execute-command`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(request),
    });
    return resp.json();
  }

  async recompile(): Promise<CommandResult> {
    const resp = await fetch(`${this.baseUrl}/api/recompile`, {
      method: 'POST',
      headers: this.headers(),
    });
    return resp.json();
  }

  async build(request: BuildRequest): Promise<CommandResult> {
    const resp = await fetch(`${this.baseUrl}/api/build`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(request),
    });
    return resp.json();
  }

  async playStart(): Promise<CommandResult> {
    const resp = await fetch(`${this.baseUrl}/api/play-start`, {
      method: 'POST',
      headers: this.headers(),
    });
    return resp.json();
  }

  async playStop(): Promise<CommandResult> {
    const resp = await fetch(`${this.baseUrl}/api/play-stop`, {
      method: 'POST',
      headers: this.headers(),
    });
    return resp.json();
  }

  async playStatus(): Promise<GameStatus> {
    const resp = await fetch(`${this.baseUrl}/api/play-status`);
    return resp.json();
  }
}
