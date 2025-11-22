import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export interface AIConfig {
    provider: 'google' | 'groq';
    apiKey: string;
    model?: string;
}

export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AIResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * Unified AI client supporting Google Gemini and Groq
 */
export class AIClient {
    private config: AIConfig;
    private googleClient?: GoogleGenerativeAI;
    private groqClient?: Groq;

    constructor(config: AIConfig) {
        this.config = config;

        if (config.provider === 'google') {
            this.googleClient = new GoogleGenerativeAI(config.apiKey);
        } else {
            this.groqClient = new Groq({ apiKey: config.apiKey });
        }
    }

    /**
     * Generates a completion from the AI model
     */
    async generate(messages: AIMessage[], options?: { temperature?: number }): Promise<AIResponse> {
        if (this.config.provider === 'google') {
            return this.generateGoogle(messages, options);
        } else {
            return this.generateGroq(messages, options);
        }
    }

    private async generateGoogle(
        messages: AIMessage[],
        options?: { temperature?: number }
    ): Promise<AIResponse> {
        if (!this.googleClient) {
            throw new Error('Google AI client not initialized');
        }

        const model = this.googleClient.getGenerativeModel({
            model: this.config.model || 'gemini-2.0-flash-exp',
        });

        // Convert messages to Gemini format
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');

        const parts = conversationMessages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

        const result = await model.generateContent({
            contents: parts,
            systemInstruction: systemMessage?.content,
            generationConfig: {
                temperature: options?.temperature ?? 0.7,
            },
        });

        const response = result.response;
        const text = response.text();

        return {
            content: text,
            usage: {
                promptTokens: response.usageMetadata?.promptTokenCount || 0,
                completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0,
            },
        };
    }

    private async generateGroq(
        messages: AIMessage[],
        options?: { temperature?: number }
    ): Promise<AIResponse> {
        if (!this.groqClient) {
            throw new Error('Groq client not initialized');
        }

        const completion = await this.groqClient.chat.completions.create({
            model: this.config.model || 'llama-3.3-70b-versatile',
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
            temperature: options?.temperature ?? 0.7,
        });

        const choice = completion.choices[0];
        if (!choice?.message?.content) {
            throw new Error('No response from Groq');
        }

        return {
            content: choice.message.content,
            usage: {
                promptTokens: completion.usage?.prompt_tokens || 0,
                completionTokens: completion.usage?.completion_tokens || 0,
                totalTokens: completion.usage?.total_tokens || 0,
            },
        };
    }

    /**
     * Generates structured JSON output
     */
    async generateJSON<T>(
        messages: AIMessage[],
        schema: string,
        options?: { temperature?: number }
    ): Promise<T> {
        const enhancedMessages: AIMessage[] = [
            ...messages,
            {
                role: 'user',
                content: `Please respond with valid JSON matching this schema:\n${schema}\n\nRespond ONLY with the JSON, no markdown formatting or explanation.`,
            },
        ];

        const response = await this.generate(enhancedMessages, options);

        // Clean up response (remove markdown code blocks if present)
        let jsonText = response.content.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.slice(7);
        }
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.slice(3);
        }
        if (jsonText.endsWith('```')) {
            jsonText = jsonText.slice(0, -3);
        }

        return JSON.parse(jsonText.trim()) as T;
    }
}
