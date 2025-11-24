import { NextRequest, NextResponse } from 'next/server';
import {
    SandboxManager,
    AIClient,
    createMCPConfig,
    getMCPCredentials,
} from '@fix-together/core';
import { sessions } from '../../sessionStore';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params;
        const session = sessions.get(sessionId);

        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        if (!session.plan) {
            return NextResponse.json(
                { error: 'No plan available. Please complete planning first.' },
                { status: 400 }
            );
        }

        console.log(`\n🚀 Starting fix generation for session ${sessionId}`);

        // Update session status
        session.status = 'executing';
        session.currentStep = 'Generating potential fixes...';
        session.progress = 0.1;

        // Start async fix generation
        generateFixes(sessionId).catch(error => {
            console.error(`❌ Fix generation error for session ${sessionId}:`, error);
            const session = sessions.get(sessionId);
            if (session) {
                session.status = 'error';
                session.error = error.message;
            }
        });

        return NextResponse.json({
            sessionId,
            status: 'generating',
            message: 'Fix generation started'
        });
    } catch (error) {
        console.error('❌ Error starting fix generation:', error);
        return NextResponse.json(
            { error: 'Failed to start fix generation' },
            { status: 500 }
        );
    }
}

async function generateFixes(sessionId: string) {
    const session = sessions.get(sessionId);
    if (!session || !session.plan) return;

    console.log(`[${sessionId}] 💻 Generating code fixes...`);

    try {
        // 1. Initialize Sandbox with MCP
        console.log(`[${sessionId}] 📦 Creating sandbox with MCP...`);
        session.currentStep = 'Initializing sandbox...';
        session.progress = 0.2;

        const sandbox = new SandboxManager({
            apiKey: process.env.E2B_API_KEY!,
            timeout: 600000,
            mcp: createMCPConfig({
                exaApiKey: process.env.EXA_API_KEY,
                githubApiKey: process.env.GITHUB_TOKEN,
                enableFilesystem: true,
            }),
        });

        await sandbox.create();
        console.log(`[${sessionId}] ✅ Sandbox created`);
        session.progress = 0.3;

        // 2. Get MCP Credentials
        const mcpCreds = await getMCPCredentials(sandbox);
        console.log(`[${sessionId}] ✅ MCP Gateway ready`);
        session.progress = 0.4;

        // 3. Initialize AI Client
        console.log(`[${sessionId}] 🤖 Initializing AI client...`);
        session.currentStep = 'Initializing AI...';
        const ai = new AIClient({
            provider: 'groq',
            apiKey: process.env.GROQ_API_KEY!,
            model: 'moonshotai/kimi-k2-instruct-0905',
        });
        session.progress = 0.5;

        // 4. Generate Code Fixes with MCP Research
        console.log(`[${sessionId}] 💻 Generating potential fixes with AI + MCP...`);
        session.currentStep = 'Analyzing issue and generating guidance...';

        const fixPrompt = `You are an expert software engineering mentor helping a developer understand and fix a GitHub issue.

Repository: ${session.issueUrl.match(/github\.com\/([^/]+\/[^/]+)/)?.[1] || 'Unknown'}

Issue:
${session.overview?.summary || 'No issue description available'}

Fix Plan:
${session.plan.steps.map((s: any, i: number) => `${i + 1}. ${s.description}\n   Files: ${s.files.join(', ')}\n   Reasoning: ${s.reasoning}`).join('\n\n')}

Recommended Resources:
${session.plan.resources?.map((r: any) => `- ${r.title}: ${r.url}`).join('\n') || 'None'}

Clarifying Questions (for context):
${session.plan.questions?.map((q: any, i: number) => `${i + 1}. ${q.text}`).join('\n') || 'None'}

Your Task:
1. Use the Exa search tool to research best practices and similar issues
2. For each file that needs changes, provide:
   - A clear explanation of WHY this change is needed
   - What problem it solves and how
   - Potential edge cases to consider
   - Questions the developer should ask themselves
   - The actual code implementation with detailed comments
3. Challenge the developer's thinking by:
   - Pointing out potential pitfalls
   - Suggesting alternative approaches to consider
   - Highlighting trade-offs in the solution
4. Help them understand the root cause, not just the fix

Return your response in this format:

## Research & Context
[Your Exa search findings about similar issues and best practices]

## Understanding the Issue
[Deep dive into the root cause and why this problem exists]

## Potential Fixes

### File: [filename]
**Why This Change?**
[Explain the reasoning and what problem this solves]

**Things to Consider:**
- [Edge case or potential issue 1]
- [Edge case or potential issue 2]
- [Trade-off or alternative approach]

**Questions to Ask Yourself:**
- [Thought-provoking question 1]
- [Thought-provoking question 2]

\`\`\`[language]
[Complete code with extensive comments explaining each part]
\`\`\`

**Alternative Approaches:**
[Brief mention of other ways to solve this, with pros/cons]

Repeat for each file that needs changes.

## Testing Strategy
[How to verify the fix works and doesn't break anything]

## Learning Points
[Key takeaways that will help with similar issues in the future]`;

        const fixResponse = await ai.generateWithMCP(
            [{ role: 'user', content: fixPrompt }],
            mcpCreds,
            { temperature: 0.3 }
        );

        console.log(`[${sessionId}] ✅ Code fixes generated`);
        session.progress = 0.7;

        // 5. Extract code fixes
        console.log(`[${sessionId}] 💾 Extracting code fixes...`);
        session.currentStep = 'Extracting code fixes...';
        const codeBlocks = fixResponse.content.matchAll(/### File: (.+?)\n```(\w+)\n([\s\S]*?)\n```/g);
        const fixes: Array<{ file: string; language: string; code: string }> = [];

        for (const match of codeBlocks) {
            const [, file, language, code] = match;
            fixes.push({ file: file.trim(), language, code });
        }

        console.log(`[${sessionId}] ✅ Extracted ${fixes.length} code fixes`);
        session.progress = 0.8;

        // 6. Create PR Draft
        console.log(`[${sessionId}] 📝 Creating PR draft...`);
        session.currentStep = 'Creating PR draft...';

        const prTitle = `Fix: ${session.overview?.summary.split('\n')[0].slice(0, 60) || 'Issue fix'}`;
        const prBody = `## Issue
${session.issueUrl}

${session.overview?.summary.split('\n')[0] || ''}

## Changes
${session.plan.steps.map((s: any, i: number) => `${i + 1}. ${s.description}`).join('\n')}

## Files Modified
${fixes.map(f => `- \`${f.file}\``).join('\n')}

## Implementation Details

${fixes.map(f => {
            const fileSection = fixResponse.content.match(new RegExp(`### File: ${f.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?\\*\\*Rationale:\\*\\*\\s*([^#]*?)(?=###|$)`, 'i'));
            const rationale = fileSection ? fileSection[1].trim() : 'See code comments for details';
            return `### ${f.file}\n${rationale}`;
        }).join('\n\n')}

## AI-Generated Fix
This PR was generated using AI analysis with the following resources:
${session.plan.resources?.slice(0, 3).map((r: any) => `- [${r.title}](${r.url})`).join('\n') || 'None'}

---
*Generated by AI-powered GitHub Issue Fixer*
`;

        // 7. Store fixes and PR draft in session
        session.fixes = fixes;
        session.prDraft = {
            title: prTitle,
            body: prBody
        };
        session.progress = 0.9;

        // 8. Complete
        console.log(`[${sessionId}] ✅ Fix generation completed!`);
        session.status = 'complete';
        session.currentStep = 'Fixes generated successfully';
        session.progress = 1.0;

        // Cleanup sandbox
        console.log(`[${sessionId}] 🧹 Cleaning up sandbox...`);
        await sandbox.cleanup();
        console.log(`[${sessionId}] ✅ Sandbox cleaned up\n`);

    } catch (error: any) {
        console.error(`[${sessionId}] ❌ Fix generation error:`, error);
        session.status = 'error';
        session.error = error.message;
        session.currentStep = 'Error occurred';
    }
}
