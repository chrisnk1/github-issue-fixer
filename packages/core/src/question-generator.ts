import type { AIClient } from './ai-client.js';
import type { Question } from './types.js';

/**
 * Generates clarifying questions when requirements are ambiguous
 */
export class QuestionGenerator {
    constructor(private ai: AIClient) { }

    /**
     * Generates questions based on issue description and analysis
     */
    async generateQuestions(
        issueDescription: string,
        context: {
            keyFiles?: string[];
            failedTests?: string[];
            multipleApproaches?: boolean;
        }
    ): Promise<Question[]> {
        const prompt = `Given this issue and context, generate 2-4 clarifying questions that would help create a better fix.

Issue: ${issueDescription}

Context:
- Key files: ${context.keyFiles?.join(', ') || 'unknown'}
- Failed tests: ${context.failedTests?.join(', ') || 'none'}
- Multiple approaches possible: ${context.multipleApproaches ? 'yes' : 'no'}

Generate questions about:
1. Edge cases that aren't clear
2. User preferences (e.g., which library to use)
3. Scope of the fix
4. Testing requirements

Respond with JSON array of objects: { id: string, text: string, type: "text" | "choice" | "confirm", options?: string[], context?: string }`;

        try {
            const questions = await this.ai.generateJSON<Question[]>(
                [
                    { role: 'system', content: 'You are an expert at identifying ambiguities in requirements.' },
                    { role: 'user', content: prompt },
                ],
                'Array<{ id: string, text: string, type: "text" | "choice" | "confirm", options?: string[], context?: string }>'
            );

            return questions;
        } catch {
            return [];
        }
    }

    /**
     * Generates follow-up questions based on user's answer
     */
    async generateFollowUp(
        originalQuestion: Question,
        answer: string,
        issueDescription: string
    ): Promise<Question[]> {
        const prompt = `Based on this question and answer, generate 0-2 follow-up questions if needed.

Original question: ${originalQuestion.text}
User's answer: ${answer}
Issue: ${issueDescription}

Only generate follow-ups if the answer reveals new ambiguities or edge cases.

Respond with JSON array (can be empty).`;

        try {
            const questions = await this.ai.generateJSON<Question[]>(
                [
                    { role: 'system', content: 'You are an expert at identifying ambiguities.' },
                    { role: 'user', content: prompt },
                ],
                'Array<{ id: string, text: string, type: "text" | "choice" | "confirm", options?: string[], context?: string }>'
            );

            return questions;
        } catch {
            return [];
        }
    }
}
