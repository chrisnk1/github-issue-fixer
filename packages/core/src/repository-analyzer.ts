import type { SandboxManager } from './sandbox-manager.js';
import type { AIClient } from './ai-client.js';
import type {
    ArchitectureDiagram,
    FileResponsibility,
    CallGraphNode,
    SystemOverview,
} from './types.js';

/**
 * Analyzes repository structure and generates system overview
 */
export class RepositoryAnalyzer {
    constructor(
        private sandbox: SandboxManager,
        private ai: AIClient
    ) { }

    /**
     * Generates a complete system overview
     */
    async analyze(issueDescription: string): Promise<SystemOverview> {
        const [architecture, keyFiles, callGraph, testResults] = await Promise.all([
            this.generateArchitectureDiagram(),
            this.identifyKeyFiles(),
            this.generateCallGraph(issueDescription),
            this.sandbox.runTests(),
        ]);

        const summary = await this.generateSummary({
            architecture,
            keyFiles,
            callGraph,
            testResults,
            issueDescription,
        });

        return {
            architecture,
            keyFiles,
            callGraph,
            testResults,
            summary,
        };
    }

    /**
     * Generates architecture diagram using AI
     */
    private async generateArchitectureDiagram(): Promise<ArchitectureDiagram> {
        // Get file structure
        const files = await this.sandbox.listFiles('/home/user/repo');
        const structure = this.buildFileTree(files);

        // Read key configuration files
        const configFiles = files.filter(f =>
            f.match(/package\.json|Cargo\.toml|go\.mod|setup\.py|tsconfig\.json|README/)
        );

        const configContents = await Promise.all(
            configFiles.slice(0, 5).map(async f => ({
                file: f,
                content: await this.sandbox.readFile(f).catch(() => ''),
            }))
        );

        const prompt = `Analyze this codebase structure and create a Mermaid architecture diagram.

File structure:
${structure}

Configuration files:
${configContents.map(c => `${c.file}:\n${c.content.slice(0, 500)}`).join('\n\n')}

Create a clear, hierarchical Mermaid diagram showing:
1. Main components/modules
2. Data flow
3. External dependencies
4. Key relationships

Respond with ONLY the Mermaid code, no explanation.`;

        const response = await this.ai.generate([
            { role: 'system', content: 'You are an expert software architect.' },
            { role: 'user', content: prompt },
        ]);

        let content = response.content.trim();
        // Remove markdown code blocks
        if (content.startsWith('```mermaid')) {
            content = content.slice(10);
        }
        if (content.startsWith('```')) {
            content = content.slice(3);
        }
        if (content.endsWith('```')) {
            content = content.slice(0, -3);
        }

        return {
            type: 'mermaid',
            content: content.trim(),
        };
    }

    /**
     * Identifies key files and their responsibilities
     */
    private async identifyKeyFiles(): Promise<FileResponsibility[]> {
        const files = await this.sandbox.listFiles('/home/user/repo');

        // Filter to source files
        const sourceFiles = files.filter(f =>
            f.match(/\.(ts|tsx|js|jsx|py|rs|go)$/) &&
            !f.includes('node_modules') &&
            !f.includes('dist') &&
            !f.includes('build') &&
            !f.includes('__pycache__')
        );

        // Read top-level and important files
        const importantFiles = sourceFiles
            .filter(f => {
                const depth = f.split('/').length;
                return depth <= 6 || f.includes('index') || f.includes('main') || f.includes('app');
            })
            .slice(0, 20);

        const fileContents = await Promise.all(
            importantFiles.map(async f => ({
                path: f,
                content: await this.sandbox.readFile(f).catch(() => ''),
            }))
        );

        const prompt = `Analyze these source files and identify the key files with their responsibilities.

${fileContents.map(f => `${f.path}:\n${f.content.slice(0, 1000)}`).join('\n\n---\n\n')}

For each key file, provide:
1. path: file path
2. purpose: what this file does (1-2 sentences)
3. dependencies: imported modules/files
4. exports: main exports (functions, classes, components)

Respond with JSON array of objects with these fields.`;

        const response = await this.ai.generateJSON<FileResponsibility[]>(
            [
                { role: 'system', content: 'You are an expert code analyst.' },
                { role: 'user', content: prompt },
            ],
            'Array<{ path: string, purpose: string, dependencies: string[], exports: string[] }>'
        );

        return response;
    }

    /**
     * Generates call graph focused on buggy area
     */
    private async generateCallGraph(issueDescription: string): Promise<CallGraphNode[]> {
        const keyFiles = await this.identifyKeyFiles();

        const prompt = `Given this issue description and key files, create a call graph for the buggy area.

Issue: ${issueDescription}

Key files:
${keyFiles.map(f => `${f.path}: ${f.purpose}`).join('\n')}

Identify the 5-10 most relevant functions/methods and their call relationships.

Respond with JSON array of: { name: string, file: string, callers: string[], callees: string[] }`;

        const response = await this.ai.generateJSON<CallGraphNode[]>(
            [
                { role: 'system', content: 'You are an expert at code analysis and debugging.' },
                { role: 'user', content: prompt },
            ],
            'Array<{ name: string, file: string, callers: string[], callees: string[] }>'
        );

        return response;
    }

    /**
     * Generates summary of the system
     */
    private async generateSummary(data: {
        architecture: ArchitectureDiagram;
        keyFiles: FileResponsibility[];
        callGraph: CallGraphNode[];
        testResults: any;
        issueDescription: string;
    }): Promise<string> {
        const prompt = `Summarize this codebase analysis in 2-3 paragraphs for a developer.

Issue: ${data.issueDescription}

Architecture:
${data.architecture.content}

Key files (${data.keyFiles.length}):
${data.keyFiles.slice(0, 5).map(f => `- ${f.path}: ${f.purpose}`).join('\n')}

Test results: ${data.testResults.success ? 'PASSING' : 'FAILING'}
${data.testResults.failedTests ? `Failed tests:\n${data.testResults.failedTests.join('\n')}` : ''}

Call graph: ${data.callGraph.length} key functions identified

Provide a clear, concise summary covering:
1. Overall architecture and tech stack
2. How the buggy area fits into the system
3. Current test status and what's failing`;

        const response = await this.ai.generate([
            { role: 'system', content: 'You are a senior software engineer explaining a codebase.' },
            { role: 'user', content: prompt },
        ]);

        return response.content;
    }

    /**
     * Builds a tree representation of files
     */
    private buildFileTree(files: string[]): string {
        const tree: Record<string, any> = {};

        files.forEach(file => {
            const parts = file.split('/').filter(Boolean);
            let current = tree;

            parts.forEach((part, i) => {
                if (i === parts.length - 1) {
                    current[part] = null; // File
                } else {
                    current[part] = current[part] || {};
                    current = current[part];
                }
            });
        });

        return this.formatTree(tree, 0);
    }

    private formatTree(node: Record<string, any>, depth: number): string {
        const indent = '  '.repeat(depth);
        let result = '';

        Object.keys(node).forEach(key => {
            if (node[key] === null) {
                result += `${indent}${key}\n`;
            } else {
                result += `${indent}${key}/\n`;
                result += this.formatTree(node[key], depth + 1);
            }
        });

        return result;
    }
}
