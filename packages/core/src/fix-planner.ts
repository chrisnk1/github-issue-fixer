import type { AIClient } from './ai-client.js';
import type { SystemOverview, FixPlan, FixStep, Question, Resource, Suggestion } from './types.js';
import { QuestionGenerator } from './question-generator.js';
import { ResourceLinker } from './resource-linker.js';
import { SuggestionEngine } from './suggestion-engine.js';

/**
 * Generates and refines fix plans collaboratively
 */
export class FixPlanner {
    private questionGen: QuestionGenerator;
    private resourceLinker: ResourceLinker;
    private suggestionEngine: SuggestionEngine;

    constructor(private ai: AIClient, config?: { exaApiKey?: string }) {
        this.questionGen = new QuestionGenerator(ai);
        this.resourceLinker = new ResourceLinker(ai, config);
        this.suggestionEngine = new SuggestionEngine(ai);
    }

    /**
     * Creates an initial fix plan
     */
    async createPlan(
        issueDescription: string,
        systemOverview: SystemOverview,
        packageFileContent?: string
    ): Promise<FixPlan> {
        // Generate fix steps
        const steps = await this.generateSteps(issueDescription, systemOverview);

        // Generate questions for ambiguous parts
        const questions = await this.questionGen.generateQuestions(issueDescription, {
            keyFiles: systemOverview.keyFiles.map(f => f.path),
            failedTests: systemOverview.testResults.failedTests,
            multipleApproaches: steps.length > 1,
        });

        // Find relevant resources
        const resources = await this.resourceLinker.findResources(
            issueDescription,
            systemOverview,
            packageFileContent
        );

        // Generate suggestions
        const proposedApproach = steps.map(s => s.description).join('\n');
        const suggestions = await this.suggestionEngine.generateSuggestions(
            issueDescription,
            systemOverview,
            proposedApproach
        );

        return {
            id: this.generateId(),
            steps,
            questions,
            resources,
            suggestions,
            version: 1,
        };
    }

    /**
     * Generates fix steps
     */
    private async generateSteps(
        issueDescription: string,
        systemOverview: SystemOverview
    ): Promise<FixStep[]> {
        const prompt = `Create a step-by-step fix plan for this issue.

Issue: ${issueDescription}

System overview:
${systemOverview.summary}

Key files:
${systemOverview.keyFiles.map(f => `- ${f.path}: ${f.purpose}`).join('\n')}

Failed tests:
${systemOverview.testResults.failedTests?.join('\n') || 'None'}

Create 4-7 clear, actionable steps. Each step should:
1. Describe what to change
2. Explain why (reasoning)
3. List affected files
4. Estimate impact (low/medium/high)

Respond with JSON array: { id: string, description: string, reasoning: string, files: string[], estimatedImpact: "low" | "medium" | "high" }`;

        const steps = await this.ai.generateJSON<FixStep[]>(
            [
                { role: 'system', content: 'You are an expert software engineer creating fix plans.' },
                { role: 'user', content: prompt },
            ],
            'Array<{ id: string, description: string, reasoning: string, files: string[], estimatedImpact: "low" | "medium" | "high" }>'
        );

        return steps;
    }

    /**
     * Refines the plan based on user feedback
     */
    async refinePlan(
        currentPlan: FixPlan,
        feedback: string,
        issueDescription: string,
        systemOverview: SystemOverview
    ): Promise<FixPlan> {
        const prompt = `Refine this fix plan based on user feedback.

Issue: ${issueDescription}

Current plan:
${currentPlan.steps.map((s, i) => `${i + 1}. ${s.description}\n   Reasoning: ${s.reasoning}`).join('\n\n')}

User feedback: ${feedback}

Create an updated plan incorporating the feedback. Keep good parts, modify as needed.

Respond with JSON array of steps.`;

        const steps = await this.ai.generateJSON<FixStep[]>(
            [
                { role: 'system', content: 'You are an expert software engineer refining fix plans.' },
                { role: 'user', content: prompt },
            ],
            'Array<{ id: string, description: string, reasoning: string, files: string[], estimatedImpact: "low" | "medium" | "high" }>'
        );

        // Regenerate suggestions for new approach
        const proposedApproach = steps.map(s => s.description).join('\n');
        const suggestions = await this.suggestionEngine.generateSuggestions(
            issueDescription,
            systemOverview,
            proposedApproach
        );

        return {
            ...currentPlan,
            steps,
            suggestions,
            version: currentPlan.version + 1,
        };
    }

    /**
     * Adds code preview to a step
     */
    async addCodePreview(step: FixStep, systemOverview: SystemOverview): Promise<FixStep> {
        if (step.files.length === 0) {
            return step;
        }

        const relevantFiles = systemOverview.keyFiles.filter(f =>
            step.files.some(sf => f.path.includes(sf) || sf.includes(f.path))
        );

        const prompt = `Generate a code preview for this fix step.

Step: ${step.description}
Reasoning: ${step.reasoning}

Relevant files:
${relevantFiles.map(f => `${f.path}:\nPurpose: ${f.purpose}\nExports: ${f.exports.join(', ')}`).join('\n\n')}

Generate a small code snippet (10-20 lines) showing the key changes. Use comments to explain.

Respond with ONLY the code, no markdown formatting.`;

        const response = await this.ai.generate([
            { role: 'system', content: 'You are an expert software engineer.' },
            { role: 'user', content: prompt },
        ], { temperature: 0.3 });

        return {
            ...step,
            codePreview: response.content.trim(),
        };
    }

    private generateId(): string {
        return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
