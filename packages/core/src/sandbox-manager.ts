import { CodeInterpreter } from '@e2b/code-interpreter';
import type {
    SandboxConfig,
    RepositoryInfo,
    CommandResult,
    TestResult,
} from './types.js';

export class SandboxManager {
    private sandbox: CodeInterpreter | null = null;
    private config: SandboxConfig;

    constructor(config: SandboxConfig) {
        this.config = config;
    }

    /**
     * Creates and initializes a new E2B sandbox
     */
    async create(): Promise<void> {
        this.sandbox = await CodeInterpreter.create({
            apiKey: this.config.apiKey,
            timeout: this.config.timeout || 300000, // 5 minutes default
        });
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
        const result = await this.sandbox.notebook.execCell(cloneCmd);
        const duration = Date.now() - startTime;

        return {
            exitCode: result.error ? 1 : 0,
            stdout: result.text || '',
            stderr: result.error?.value || '',
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
      cd /home/user/repo && \
      if [ -f "pnpm-lock.yaml" ]; then echo "pnpm"; \
      elif [ -f "yarn.lock" ]; then echo "yarn"; \
      elif [ -f "package-lock.json" ]; then echo "npm"; \
      elif [ -f "Cargo.toml" ]; then echo "cargo"; \
      elif [ -f "go.mod" ]; then echo "go"; \
      elif [ -f "requirements.txt" ]; then echo "pip"; \
      else echo "unknown"; fi
    `;

        const detectResult = await this.sandbox.notebook.execCell(detectCmd);
        const packageManager = detectResult.text?.trim() || 'unknown';

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
        const result = await this.sandbox.notebook.execCell(installCmd);
        const duration = Date.now() - startTime;

        return {
            exitCode: result.error ? 1 : 0,
            stdout: result.text || '',
            stderr: result.error?.value || '',
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
      cd /home/user/repo && \
      if [ -f "package.json" ]; then \
        if grep -q '"test":' package.json; then echo "npm test"; \
        else echo "none"; fi; \
      elif [ -f "Cargo.toml" ]; then echo "cargo test"; \
      elif [ -f "go.mod" ]; then echo "go test ./..."; \
      elif [ -f "pytest.ini" ] || [ -f "setup.py" ]; then echo "pytest"; \
      else echo "none"; fi
    `;

        const detectResult = await this.sandbox.notebook.execCell(detectCmd);
        const testCmd = detectResult.text?.trim();

        if (!testCmd || testCmd === 'none') {
            return {
                success: true,
                output: 'No tests found',
                duration: 0,
            };
        }

        const startTime = Date.now();
        const result = await this.sandbox.notebook.execCell(`cd /home/user/repo && ${testCmd}`);
        const duration = Date.now() - startTime;

        const output = result.text || '';
        const success = !result.error;

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
        const result = await this.sandbox.notebook.execCell(fullCmd);
        const duration = Date.now() - startTime;

        return {
            exitCode: result.error ? 1 : 0,
            stdout: result.text || '',
            stderr: result.error?.value || '',
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

        const result = await this.sandbox.notebook.execCell(`cat ${path}`);
        if (result.error) {
            throw new Error(`Failed to read file: ${result.error.value}`);
        }

        return result.text || '';
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
        const result = await this.sandbox.notebook.execCell(
            `echo '${escapedContent}' > ${path}`
        );

        if (result.error) {
            throw new Error(`Failed to write file: ${result.error.value}`);
        }
    }

    /**
     * Lists files in a directory
     */
    async listFiles(directory: string): Promise<string[]> {
        if (!this.sandbox) {
            throw new Error('Sandbox not initialized');
        }

        const result = await this.sandbox.notebook.execCell(`find ${directory} -type f`);
        if (result.error) {
            throw new Error(`Failed to list files: ${result.error.value}`);
        }

        return (result.text || '').split('\n').filter(Boolean);
    }

    /**
     * Cleans up and closes the sandbox
     */
    async cleanup(): Promise<void> {
        if (this.sandbox) {
            await this.sandbox.close();
            this.sandbox = null;
        }
    }

    /**
     * Gets the sandbox instance (for advanced usage)
     */
    getSandbox(): CodeInterpreter | null {
        return this.sandbox;
    }
}
