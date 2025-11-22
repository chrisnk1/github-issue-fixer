import type { AIClient } from './ai-client.js';
import type { Suggestion, SystemOverview } from './types.js';

/**
 * Provides contextual suggestions for best practices and alternatives
 */
export class SuggestionEngine {
    constructor(private ai: AIClient) { }

    /**
     * Generates suggestions based on the fix plan and context
     */
    async generateSuggestions(
        issueDescription: string,
        systemOverview: SystemOverview,
        proposedApproach: string
    ): Promise<Suggestion[]> {
        const prompt = `Given this issue, system overview, and proposed approach, provide 3-5 suggestions.

Issue: ${issueDescription}

System: ${systemOverview.summary}

Proposed approach: ${proposedApproach}

Generate suggestions for:
1. Best practices to follow
2. Alternative approaches to consider
3. Testing strategies
4. Performance considerations

Respond with JSON array: { text: string, category: "best-practice" | "alternative" | "testing" | "performance", priority: "high" | "medium" | "low" }`;

        try {
            const suggestions = await this.ai.generateJSON<Suggestion[]>(
                [
                    { role: 'system', content: 'You are a senior software engineer providing code review suggestions.' },
                    { role: 'user', content: prompt },
                ],
                'Array<{ text: string, category: "best-practice" | "alternative" | "testing" | "performance", priority: "high" | "medium" | "low" }>'
            );

            return suggestions;
        } catch {
            return [];
        }
    }

    /**
     * Generates suggestions for a specific code change
     */
    async suggestImprovements(codeChange: string, context: string): Promise<Suggestion[]> {
        const prompt = `Review this code change and suggest improvements:

Code change:
${codeChange}

Context: ${context}

Provide 2-3 suggestions for improvements, best practices, or potential issues.

Respond with JSON array.`;

        try {
            const suggestions = await this.ai.generateJSON<Suggestion[]>(
                [
                    { role: 'system', content: 'You are an expert code reviewer.' },
                    { role: 'user', content: prompt },
                ],
                'Array<{ text: string, category: "best-practice" | "alternative" | "testing" | "performance", priority: "high" | "medium" | "low" }>'
            );

            return suggestions;
        } catch {
            return [];
        }
    }
}
