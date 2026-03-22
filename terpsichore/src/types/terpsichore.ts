export type ServerRole = 'worker' | 'watcher' | 'debugger';

export interface TerpsichoreConfig {
  port: number;
  enabled: boolean;
  token: string;
  role: ServerRole;
  host: string;
}

export interface CommandRequest {
  command: string;
  args: string[];
  payload?: unknown;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface ServerStatus {
  running: boolean;
  port: number;
  role: string;
  uptime_seconds: number;
  request_count: number;
}

export interface CompileStatus {
  compiling: boolean;
  errors: CompileMessage[];
  warnings: CompileMessage[];
}

export interface CompileMessage {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: string;
}

export interface BuildRequest {
  target: string;
  output_path?: string;
  development: boolean;
}

export interface BuildStatus {
  building: boolean;
  success?: boolean;
  output_path?: string;
  errors: string[];
}

export interface GameStatus {
  playing: boolean;
  scene?: string;
  custom_data?: unknown;
}
