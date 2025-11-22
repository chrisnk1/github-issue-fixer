import type { AIClient } from './ai-client.js';
import type { Resource } from './types.js';

export interface DocumentationFinderConfig {
    exaApiKey?: string;
}

/**
 * Finds official documentation for detected libraries and frameworks
 */
export class DocumentationFinder {
    constructor(
        private ai: AIClient,
        private config: DocumentationFinderConfig = {}
    ) { }

    /**
     * Detects libraries/frameworks from package files and finds their documentation
     */
    async findDocumentation(packageFileContent: string, fileType: 'package.json' | 'cargo.toml' | 'go.mod' | 'requirements.txt'): Promise<Resource[]> {
        const libraries = this.extractLibraries(packageFileContent, fileType);

        const resources: Resource[] = [];

        for (const lib of libraries.slice(0, 10)) {
            const docs = await this.findLibraryDocs(lib, fileType);
            if (docs) {
                resources.push(docs);
            }
        }

        return resources;
    }

    /**
     * Finds documentation for a specific library
     */
    async findLibraryDocs(libraryName: string, ecosystem: string): Promise<Resource | null> {
        // Known documentation patterns
        const docPatterns: Record<string, (lib: string) => string> = {
            // JavaScript/TypeScript
            'react': () => 'https://react.dev',
            'next': () => 'https://nextjs.org/docs',
            'vue': () => 'https://vuejs.org/guide',
            'svelte': () => 'https://svelte.dev/docs',
            'express': () => 'https://expressjs.com',
            'fastify': () => 'https://fastify.dev',
            'typescript': () => 'https://www.typescriptlang.org/docs',

            // Python
            'django': () => 'https://docs.djangoproject.com',
            'flask': () => 'https://flask.palletsprojects.com',
            'fastapi': () => 'https://fastapi.tiangolo.com',
            'numpy': () => 'https://numpy.org/doc',
            'pandas': () => 'https://pandas.pydata.org/docs',

            // Rust
            'tokio': () => 'https://tokio.rs',
            'serde': () => 'https://serde.rs',
            'actix-web': () => 'https://actix.rs',

            // Go
            'gin': () => 'https://gin-gonic.com/docs',
            'echo': () => 'https://echo.labstack.com/docs',
        };

        const normalizedLib = libraryName.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Check known patterns first
        for (const [key, urlFn] of Object.entries(docPatterns)) {
            if (normalizedLib.includes(key) || key.includes(normalizedLib)) {
                return {
                    title: `${libraryName} Documentation`,
                    url: urlFn(libraryName),
                    type: 'documentation',
                    relevance: 1.0,
                };
            }
        }

        // Use AI to find documentation URL
        const prompt = `Find the official documentation URL for the library "${libraryName}" in the ${ecosystem} ecosystem.

Respond with ONLY the URL, nothing else. If you're not sure, respond with "UNKNOWN".`;

        try {
            const response = await this.ai.generate([
                { role: 'system', content: 'You are a helpful assistant that finds official documentation URLs.' },
                { role: 'user', content: prompt },
            ], { temperature: 0.1 });

            const url = response.content.trim();

            if (url === 'UNKNOWN' || !url.startsWith('http')) {
                return null;
            }

            return {
                title: `${libraryName} Documentation`,
                url,
                type: 'documentation',
                relevance: 0.8,
            };
        } catch {
            return null;
        }
    }

    /**
     * Extracts library names from package files
     */
    private extractLibraries(content: string, fileType: string): string[] {
        switch (fileType) {
            case 'package.json':
                try {
                    const pkg = JSON.parse(content);
                    return [
                        ...Object.keys(pkg.dependencies || {}),
                        ...Object.keys(pkg.devDependencies || {}),
                    ];
                } catch {
                    return [];
                }

            case 'cargo.toml':
                const cargoMatches = content.match(/^\s*(\w+)\s*=/gm);
                return cargoMatches ? cargoMatches.map(m => m.trim().split('=')[0].trim()) : [];

            case 'go.mod':
                const goMatches = content.match(/^\s+([a-z0-9\-\.\/]+)/gm);
                return goMatches ? goMatches.map(m => m.trim().split('/').pop() || '') : [];

            case 'requirements.txt':
                return content
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'))
                    .map(line => line.split(/[=<>]/)[0].trim());

            default:
                return [];
        }
    }

    /**
     * Finds API reference documentation for specific functions/classes
     */
    async findAPIReference(libraryName: string, symbolName: string): Promise<Resource | null> {
        const prompt = `Find the API reference URL for "${symbolName}" in the "${libraryName}" library.

Respond with ONLY the direct URL to the API reference, or "UNKNOWN" if not found.`;

        try {
            const response = await this.ai.generate([
                { role: 'system', content: 'You are a helpful assistant that finds API documentation.' },
                { role: 'user', content: prompt },
            ], { temperature: 0.1 });

            const url = response.content.trim();

            if (url === 'UNKNOWN' || !url.startsWith('http')) {
                return null;
            }

            return {
                title: `${libraryName}.${symbolName} API Reference`,
                url,
                type: 'api-reference',
                relevance: 0.9,
            };
        } catch {
            return null;
        }
    }
}
