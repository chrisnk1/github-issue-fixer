import type { AIClient } from './ai-client.js';
import type { Resource, SystemOverview } from './types.js';
import { DocumentationFinder } from './documentation-finder.js';

/**
 * Finds and links relevant resources for fixing issues
 */
export class ResourceLinker {
    private docFinder: DocumentationFinder;

    constructor(private ai: AIClient) {
        this.docFinder = new DocumentationFinder(ai);
    }

    /**
     * Finds all relevant resources for an issue
     */
    async findResources(
        issueDescription: string,
        systemOverview: SystemOverview,
        packageFileContent?: string
    ): Promise<Resource[]> {
        const resources: Resource[] = [];

        // Find documentation for detected libraries
        if (packageFileContent) {
            const docs = await this.docFinder.findDocumentation(packageFileContent, 'package.json');
            resources.push(...docs);
        }

        // Find similar GitHub issues
        const similarIssues = await this.findSimilarIssues(issueDescription);
        resources.push(...similarIssues);

        // Find Stack Overflow discussions
        const stackOverflow = await this.findStackOverflow(issueDescription);
        resources.push(...stackOverflow);

        // Find relevant blog posts
        const blogPosts = await this.findBlogPosts(issueDescription, systemOverview);
        resources.push(...blogPosts);

        // Sort by relevance
        return resources.sort((a, b) => b.relevance - a.relevance);
    }

    /**
     * Finds similar GitHub issues
     */
    private async findSimilarIssues(issueDescription: string): Promise<Resource[]> {
        const prompt = `Given this issue description, suggest 3-5 search queries to find similar GitHub issues:

${issueDescription}

Respond with JSON array of search query strings.`;

        try {
            const queries = await this.ai.generateJSON<string[]>(
                [
                    { role: 'system', content: 'You are an expert at finding relevant GitHub issues.' },
                    { role: 'user', content: prompt },
                ],
                'Array<string>'
            );

            // In a real implementation, this would use GitHub API or Exa
            // For now, we'll generate example URLs
            return queries.slice(0, 3).map((query, i) => ({
                title: `Similar issue: ${query}`,
                url: `https://github.com/search?q=${encodeURIComponent(query)}&type=issues`,
                type: 'issue' as const,
                relevance: 0.8 - i * 0.1,
                snippet: `Search results for: ${query}`,
            }));
        } catch {
            return [];
        }
    }

    /**
     * Finds relevant Stack Overflow discussions
     */
    private async findStackOverflow(issueDescription: string): Promise<Resource[]> {
        const prompt = `Given this issue, create 2-3 Stack Overflow search queries:

${issueDescription}

Respond with JSON array of search query strings.`;

        try {
            const queries = await this.ai.generateJSON<string[]>(
                [
                    { role: 'system', content: 'You are an expert at finding Stack Overflow solutions.' },
                    { role: 'user', content: prompt },
                ],
                'Array<string>'
            );

            return queries.slice(0, 2).map((query, i) => ({
                title: `Stack Overflow: ${query}`,
                url: `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`,
                type: 'stackoverflow' as const,
                relevance: 0.7 - i * 0.1,
            }));
        } catch {
            return [];
        }
    }

    /**
     * Finds relevant blog posts and tutorials
     */
    private async findBlogPosts(issueDescription: string, systemOverview: SystemOverview): Promise<Resource[]> {
        const technologies = this.extractTechnologies(systemOverview);

        const prompt = `Given this issue and technologies, suggest 2-3 blog post search queries:

Issue: ${issueDescription}

Technologies: ${technologies.join(', ')}

Respond with JSON array of search query strings.`;

        try {
            const queries = await this.ai.generateJSON<string[]>(
                [
                    { role: 'system', content: 'You are an expert at finding technical blog posts.' },
                    { role: 'user', content: prompt },
                ],
                'Array<string>'
            );

            return queries.slice(0, 2).map((query, i) => ({
                title: `Blog: ${query}`,
                url: `https://www.google.com/search?q=${encodeURIComponent(query + ' tutorial')}`,
                type: 'blog' as const,
                relevance: 0.6 - i * 0.1,
            }));
        } catch {
            return [];
        }
    }

    /**
     * Extracts technology names from system overview
     */
    private extractTechnologies(systemOverview: SystemOverview): string[] {
        const technologies = new Set<string>();

        // Extract from file paths
        systemOverview.keyFiles.forEach(file => {
            if (file.path.includes('.tsx') || file.path.includes('.jsx')) {
                technologies.add('React');
            }
            if (file.path.includes('.vue')) {
                technologies.add('Vue');
            }
            if (file.path.includes('.svelte')) {
                technologies.add('Svelte');
            }
            if (file.path.includes('.py')) {
                technologies.add('Python');
            }
            if (file.path.includes('.rs')) {
                technologies.add('Rust');
            }
            if (file.path.includes('.go')) {
                technologies.add('Go');
            }
        });

        // Extract from dependencies
        systemOverview.keyFiles.forEach(file => {
            file.dependencies.forEach(dep => {
                if (dep.includes('next')) technologies.add('Next.js');
                if (dep.includes('express')) technologies.add('Express');
                if (dep.includes('fastify')) technologies.add('Fastify');
                if (dep.includes('django')) technologies.add('Django');
                if (dep.includes('flask')) technologies.add('Flask');
            });
        });

        return Array.from(technologies);
    }
}
