import { Sandbox } from 'e2b';
import { Sandbox as CodeInterpreterSandbox } from '@e2b/code-interpreter';
import type {
    SandboxConfig,
    RepositoryInfo,
    CommandResult,
    TestResult,
} from './types.js';

export class SandboxManager {
    private sandbox: Sandbox | CodeInterpreterSandbox | null = null;
    private config: SandboxConfig;

    constructor(config: SandboxConfig) {
        this.config = config;
    }

    /**
     * Creates and initializes a new E2B sandbox with MCP support
     */
    async create(): Promise<void> {
        // Build MCP configuration using the correct e2b types
        const mcpConfig: any = {};

        // Configure MCP servers if provided
        if (this.config.mcp?.exa) {
            mcpConfig.exa = { apiKey: this.config.mcp.exa.apiKey };
        }
        if (this.config.mcp?.github) {
            mcpConfig.githubOfficial = { apiKey: this.config.mcp.github.apiKey };
        }
        if (this.config.mcp?.filesystem) {
            mcpConfig.filesystem = {};
        }

        // Use CodeInterpreter if possible, otherwise fallback to Sandbox
        try {
            // @ts-ignore - Check if CodeInterpreter supports MCP via create
            this.sandbox = await CodeInterpreterSandbox.create({
                apiKey: this.config.apiKey,
                timeoutMs: this.config.timeout || 300000,
                // @ts-ignore - MCP support might be in beta or different signature
                mcp: Object.keys(mcpConfig).length > 0 ? mcpConfig : undefined,
            });
        } catch (error) {
            console.warn('Failed to create CodeInterpreter, falling back to Sandbox:', error);
            this.sandbox = await Sandbox.betaCreate({
                apiKey: this.config.apiKey,
                timeoutMs: this.config.timeout || 300000,
                mcp: Object.keys(mcpConfig).length > 0 ? mcpConfig : undefined,
            });
        }
    }

    /**
     * Clones a GitHub repository into the sandbox
     */
    async cloneRepository(repo: RepositoryInfo): Promise<CommandResult> {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized. Call create() first.');
        }

        const branch = repo.branch || 'main';
        const cloneCmd = `git clone --depth 1 --branch ${branch} ${repo.url} /home/user/repo`;

        const startTime = Date.now();
        const result = await this.sandbox.commands.run(cloneCmd);
        const duration = Date.now() - startTime;

        return {
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            duration,
        };
    }

    /**
     * Installs dependencies based on detected package manager
     */
    async installDependencies(): Promise<CommandResult> {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized');
        }

        // Detect package manager
        const detectCmd = `
      cd /home/user/repo && \\
      if [ -f "pnpm-lock.yaml" ]; then echo "pnpm"; \\
      elif [ -f "yarn.lock" ]; then echo "yarn"; \\
      elif [ -f "package-lock.json" ]; then echo "npm"; \\
      elif [ -f "Cargo.toml" ]; then echo "cargo"; \\
      elif [ -f "go.mod" ]; then echo "go"; \\
      elif [ -f "requirements.txt" ]; then echo "pip"; \\
      else echo "unknown"; fi
    `;

        const detectResult = await this.sandbox.commands.run(detectCmd);
        const packageManager = detectResult.stdout.trim() || 'unknown';

        if (packageManager === 'unknown') {
            return {
                exitCode: 0,
                stdout: 'No package manager detected, skipping dependency installation',
                stderr: '',
                duration: 0,
            };
        }

        // Install dependencies based on package manager
        const installCommands: Record<string, string> = {
            pnpm: 'cd /home/user/repo && pnpm install',
            npm: 'cd /home/user/repo && npm install',
            yarn: 'cd /home/user/repo && yarn install',
            cargo: 'cd /home/user/repo && cargo build',
            go: 'cd /home/user/repo && go mod download',
            pip: 'cd /home/user/repo && pip install -r requirements.txt',
        };

        const installCmd = installCommands[packageManager];
        const startTime = Date.now();
        const result = await this.sandbox.commands.run(installCmd);
        const duration = Date.now() - startTime;

        return {
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            duration,
        };
    }

    /**
     * Runs tests in the repository
     */
    async runTests(): Promise<TestResult> {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized');
        }

        // Detect test command
        const detectCmd = `
      cd /home/user/repo && \\
      if [ -f "package.json" ]; then \\
        if grep -q '"test":' package.json; then echo "npm test"; \\
        else echo "none"; fi; \\
      elif [ -f "Cargo.toml" ]; then echo "cargo test"; \\
      elif [ -f "go.mod" ]; then echo "go test ./..."; \\
      elif [ -f "pytest.ini" ] || [ -f "setup.py" ]; then echo "pytest"; \\
      else echo "none"; fi
    `;

        const detectResult = await this.sandbox.commands.run(detectCmd);
        const testCmd = detectResult.stdout.trim();

        if (!testCmd || testCmd === 'none') {
            return {
                success: true,
                output: 'No tests found',
                duration: 0,
            };
        }

        const startTime = Date.now();
        const result = await this.sandbox.commands.run(`cd /home/user/repo && ${testCmd}`);
        const duration = Date.now() - startTime;

        const output = result.stdout || '';
        const success = result.exitCode === 0;

        // Parse failed tests (basic implementation)
        const failedTests: string[] = [];
        if (!success && output) {
            const failedMatches = output.match(/FAILED (.*?)(?:\n|$)/g);
            if (failedMatches) {
                failedTests.push(...failedMatches.map(m => m.replace('FAILED ', '').trim()));
            }
        }

        return {
            success,
            output,
            failedTests: failedTests.length > 0 ? failedTests : undefined,
            duration,
        };
    }

    /**
     * Executes an arbitrary command in the sandbox
     */
    async executeCommand(command: string, cwd?: string): Promise<CommandResult> {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized');
        }

        const fullCmd = cwd ? `cd ${cwd} && ${command}` : command;
        const startTime = Date.now();
        const result = await this.sandbox.commands.run(fullCmd);
        const duration = Date.now() - startTime;

        return {
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            duration,
        };
    }

    /**
     * Reads a file from the sandbox
     */
    async readFile(path: string): Promise<string> {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized');
        }

        const result = await this.sandbox.commands.run(`cat ${path}`);
        if (result.exitCode !== 0) {
            throw new Error(`Failed to read file: ${result.stderr}`);
        }

        return result.stdout || '';
    }

    /**
     * Writes content to a file in the sandbox
     */
    async writeFile(path: string, content: string): Promise<void> {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized');
        }

        // Escape content for shell
        const escapedContent = content.replace(/'/g, "'\\''");
        const result = await this.sandbox.commands.run(
            `echo '${escapedContent}' > ${path}`
        );

        if (result.exitCode !== 0) {
            throw new Error(`Failed to write file: ${result.stderr}`);
        }
    }

    /**
     * Lists files in a directory
     */
    async listFiles(directory: string): Promise<string[]> {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized');
        }

        try {
            const result = await this.sandbox.commands.run(`find ${directory} -type f 2>/dev/null`);
            return result.stdout.split('\n').filter(Boolean);
        } catch (error: any) {
            // find may return non-zero if it hits permission denied, but still output files
            if (error.result && error.result.stdout) {
                return error.result.stdout.split('\n').filter(Boolean);
            }
            throw new Error(`Failed to list files: ${error.message}`);
        }
    }

    /**
     * Runs code using the Code Interpreter if available
     */
    async runCode(code: string, language: 'python' | 'javascript' = 'python'): Promise<any> {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized');
        }

        if (this.sandbox instanceof CodeInterpreterSandbox) {
            try {
                // Use CodeInterpreter's runCode
                if (language === 'python') {
                    const exec = await this.sandbox.runCode(code);
                    return {
                        text: exec.text,
                        results: exec.results,
                        logs: exec.logs,
                        error: exec.error
                    };
                } else {
                    // Try running JS via runCode if supported
                    const exec = await this.sandbox.runCode(code, { language: 'javascript' });
                    return {
                        text: exec.text,
                        results: exec.results,
                        logs: exec.logs,
                        error: exec.error
                    };
                }
            } catch (e: any) {
                console.error('CodeInterpreter runCode failed:', e);
                console.error('Error details:', e.message, e.stack);
                // Fallback to node command if javascript kernel not available or other error
                if (language === 'javascript') {
                    const result = await this.sandbox.commands.run(`node -e "${code.replace(/"/g, '\\"')}"`);
                    return {
                        text: result.stdout,
                        logs: { stdout: [result.stdout], stderr: [result.stderr] },
                        error: result.exitCode !== 0 ? result.stderr : undefined
                    };
                }
                throw e;
            }
        } else {
            // Fallback for standard Sandbox
            const cmd = language === 'python'
                ? `python3 -c "${code.replace(/"/g, '\\"')}"`
                : `node -e "${code.replace(/"/g, '\\"')}"`;

            const result = await this.sandbox.commands.run(cmd);
            return {
                text: result.stdout,
                logs: { stdout: [result.stdout], stderr: [result.stderr] },
                error: result.exitCode !== 0 ? result.stderr : undefined
            };
        }
    }

    /**
     * Cleans up and closes the sandbox
     */
    async cleanup(): Promise<void> {
        if (this.sandbox) {
            await this.sandbox.kill();
            this.sandbox = null;
        }
    }

    /**
     * Gets the sandbox instance (for advanced usage)
     */
    getSandbox(): Sandbox | CodeInterpreterSandbox | null {
        return this.sandbox;
    }

    /**
     * Gets the MCP gateway URL for AI client integration
     */
    getMcpUrl(): string {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized');
        }
        // @ts-ignore - getMcpUrl exists on Sandbox but might be missing in CodeInterpreter types if not updated
        return this.sandbox.getMcpUrl();
    }

    /**
     * Gets the MCP authentication token
     */
    async getMcpToken(): Promise<string> {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized');
        }
        // @ts-ignore
        const token = await this.sandbox.getMcpToken();
        if (!token) {
            throw new Error('MCP not enabled for this sandbox');
        }
        return token;
    }
}
