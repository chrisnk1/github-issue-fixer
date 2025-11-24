export interface AutoPauseConfig {
  /** Kill all processes when auto-pausing (default: true) */
  killOnPause?: boolean;
  /** Timeout for graceful shutdown in seconds (default: 30) */
  gracefulTimeoutSecs?: number;
}

export interface SandboxConfig {
  /** Enable auto-pause functionality */
  autoPause?: boolean;
  /** Auto-pause configuration */
  autoPauseConfig?: AutoPauseConfig;
  /** Sandbox timeout in seconds */
  timeout?: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cmd: string;
  startTime: string;
  state: 'running' | 'suspended' | 'terminated';
}

export class Sandbox {
  private sandboxId: string;
  private config: SandboxConfig;

  constructor(sandboxId: string, config: SandboxConfig) {
    this.sandboxId = sandboxId;
    this.config = config;
  }

  /**
   * Create a new sandbox with beta features
   * 
   * @param options - Sandbox creation options
   * @returns Promise resolving to Sandbox instance
   * 
   * @example
   * ```typescript
   * // Kill processes on auto-pause (default behavior)
   * const sandbox = await Sandbox.betaCreate({
   *   autoPause: true,
   *   killOnPause: true
   * });
   * 
   * // Keep processes for resume
   * const sandbox = await Sandbox.betaCreate({
   *   autoPause: true,
   *   killOnPause: false
   * });
   * ```
   */
  static async betaCreate(options: {
    autoPause?: boolean;
    autoPaused?: boolean; // Legacy parameter for backward compatibility
    timeout?: number;
    killOnPause?: boolean;
    gracefulTimeoutSecs?: number;
  } = {}): Promise<Sandbox> {
    // Handle legacy parameter
    if (options.autoPaused && !options.autoPause) {
      options.autoPause = true;
      console.warn('autoPaused parameter is deprecated, use autoPause instead');
    }

    const config: SandboxConfig = {
      autoPause: options.autoPause,
      autoPauseConfig: options.autoPause ? {
        killOnPause: options.killOnPause ?? true,
        gracefulTimeoutSecs: options.gracefulTimeoutSecs ?? 30
      } : undefined,
      timeout: options.timeout
    };

    // Create sandbox via API
    const response = await this.createSandboxApi(config);
    return new Sandbox(response.sandboxId, config);
  }

  /**
   * Connect to an existing sandbox
   * 
   * @param sandboxId - The sandbox ID to connect to
   * @returns Promise resolving to Sandbox instance
   */
  static async connect(sandboxId: string): Promise<Sandbox> {
    // Get sandbox info from API
    const info = await this.getSandboxInfo(sandboxId);
    const config: SandboxConfig = {
      autoPause: info.autoPause || false,
      autoPauseConfig: info.autoPauseConfig,
      timeout: info.timeout
    };
    return new Sandbox(sandboxId, config);
  }

  /**
   * Get the command manager for this sandbox
   */
  get commands(): CommandManager {
    return new CommandManager(this);
  }

  private static async createSandboxApi(config: SandboxConfig): Promise<{ sandboxId: string }> {
    // Implementation would make HTTP request to sandbox API
    throw new Error('Not implemented');
  }

  private static async getSandboxInfo(sandboxId: string): Promise<any> {
    // Implementation would make HTTP request to sandbox API
    throw new Error('Not implemented');
  }
}

export class CommandManager {
  constructor(private sandbox: Sandbox) {}

  /**
   * List all running commands in the sandbox
   * 
   * @returns Promise resolving to array of process information
   * 
   * @remarks
   * After auto-resume, this will return the same processes that were
   * running before pause if killOnPause=false, or an empty list
   * if killOnPause=true (default).
   */
  async list(): Promise<ProcessInfo[]> {
    const response = await this.listCommandsApi();
    return response.processes || [];
  }

  /**
   * Run a command in the sandbox
   * 
   * @param cmd - Command to run
   * @param timeout - Command timeout in seconds
   * @returns Promise resolving to command result
   */
  async run(cmd: string, timeout?: number): Promise<any> {
    return await this.runCommandApi(cmd, timeout);
  }

  private async listCommandsApi(): Promise<{ processes: ProcessInfo[] }> {
    // Implementation would make HTTP request to command API
    throw new Error('Not implemented');
  }

  private async runCommandApi(cmd: string, timeout?: number): Promise<any> {
    // Implementation would make HTTP request to command API
    throw new Error('Not implemented');
  }
}