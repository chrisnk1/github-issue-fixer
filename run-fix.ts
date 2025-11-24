import {
    SandboxManager,
    AIClient,
    createMCPConfig,
    getMCPCredentials,
} from './packages/core/src/index.js';
import 'dotenv/config';
import fs from 'fs/promises';
import readline from 'readline';

async function askUserConfirmation(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

async function runExecutionWorkflow() {
    console.log('🚀 Starting Execution Workflow\n');

    if (!process.env.E2B_API_KEY || !process.env.GROQ_API_KEY) {
        console.error('❌ Missing required environment variables: E2B_API_KEY, GROQ_API_KEY');
        process.exit(1);
    }

    let sandbox: SandboxManager | null = null;

    try {
        // 1. Load Plan
        console.log('📖 Loading Fix Plan...');
        const planData = JSON.parse(await fs.readFile('fix-plan.json', 'utf-8'));
        console.log(`✅ Loaded plan for issue in ${planData.issue.repo}`);

        // 2. Initialize Sandbox with MCP
        console.log('\n📦 Initializing Sandbox with MCP...');
        sandbox = new SandboxManager({
            apiKey: process.env.E2B_API_KEY!,
            timeout: 600000, // 10 minutes
            mcp: createMCPConfig({
                exaApiKey: process.env.EXA_API_KEY,
                githubApiKey: process.env.GITHUB_TOKEN,
                enableFilesystem: true,
            }),
        });
        await sandbox.create();
        console.log('✅ Sandbox created');

        // 3. Get MCP Credentials
        const mcpCreds = await getMCPCredentials(sandbox);
        console.log(`✅ MCP Gateway ready at ${mcpCreds.mcpUrl}`);

        // 4. Initialize AI Client
        console.log('\n🤖 Initializing AI Client...');
        const ai = new AIClient({
            provider: 'groq',
            apiKey: process.env.GROQ_API_KEY!,
            model: 'moonshotai/kimi-k2-instruct-0905',
        });

        // 5. Generate Code Fixes with MCP Research
        console.log('\n💻 Generating Code Fixes with AI + MCP Research...');

        const fixPrompt = `You are an expert software engineer fixing a GitHub issue.

Repository: ${planData.issue.repo}

Issue:
${planData.issue.content}

Fix Plan:
${planData.plan.steps.map((s: any, i: number) => `${i + 1}. ${s.description}\n   Files: ${s.files.join(', ')}\n   Reasoning: ${s.reasoning}`).join('\n\n')}

Recommended Resources:
${planData.plan.resources?.map((r: any) => `- ${r.title}: ${r.url}`).join('\n') || 'None'}

Clarifying Questions (for context):
${planData.plan.questions?.map((q: any, i: number) => `${i + 1}. ${q.text}`).join('\n') || 'None'}

Task:
1. Use the Exa search tool to research best practices for this type of fix
2. Generate actual code fixes for the files mentioned in the plan
3. For each file, provide the complete fixed code in the appropriate language
4. Include detailed comments explaining the changes

Return your response in this format:

## Research Findings
[Your Exa search findings and best practices]

## Code Fixes

### File: [filename]
\`\`\`[language]
[complete fixed code with comments]
\`\`\`

**Changes Made:**
- [List of specific changes]

**Rationale:**
[Why these changes fix the issue]

Repeat for each file that needs changes.`;

        const fixResponse = await ai.generateWithMCP(
            [{ role: 'user', content: fixPrompt }],
            mcpCreds,
            { temperature: 0.3 }
        );

        console.log('\n📝 Generated Fix Response:');
        console.log('═'.repeat(60));
        console.log(fixResponse.content);
        console.log('═'.repeat(60));

        // 6. Extract and save code fixes
        console.log('\n💾 Extracting code fixes...');
        const codeBlocks = fixResponse.content.matchAll(/### File: (.+?)\n```(\w+)\n([\s\S]*?)\n```/g);
        const fixes: Array<{ file: string; language: string; code: string }> = [];

        for (const match of codeBlocks) {
            const [, file, language, code] = match;
            fixes.push({ file: file.trim(), language, code });
            console.log(`   ✓ ${file} (${language})`);
        }

        if (fixes.length === 0) {
            console.log('⚠️  No code fixes extracted from response');
        } else {
            // Save fixes to files
            console.log(`\n📁 Saving ${fixes.length} file(s)...`);
            for (const fix of fixes) {
                const filename = `fix-${fix.file.replace(/\//g, '-')}`;
                await fs.writeFile(filename, fix.code);
                console.log(`   ✓ Saved ${filename}`);
            }
        }

        // 7. Create PR Draft
        console.log('\n' + '='.repeat(60));
        const prTitle = `Fix: ${planData.issue.content.split('\n')[0].slice(0, 60)}`;
        const prBody = `## Issue
${planData.issue.url || planData.issue.repo}

${planData.issue.content.split('\n')[0]}

## Changes
${planData.plan.steps.map((s: any, i: number) => `${i + 1}. ${s.description}`).join('\n')}

## Files Modified
${fixes.map(f => `- \`${f.file}\``).join('\n')}

## Implementation Details

${fixes.map(f => {
            // Extract rationale from the AI response
            const fileSection = fixResponse.content.match(new RegExp(`### File: ${f.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?\\*\\*Rationale:\\*\\*\\s*([^#]*?)(?=###|$)`, 'i'));
            const rationale = fileSection ? fileSection[1].trim() : 'See code comments for details';
            return `### ${f.file}\n${rationale}`;
        }).join('\n\n')}

## AI-Generated Fix
This PR was generated using AI analysis with the following resources:
${planData.plan.resources?.slice(0, 3).map((r: any) => `- [${r.title}](${r.url})`).join('\n') || 'None'}

---
*Generated by AI-powered GitHub Issue Fixer*
`;

        // Save PR draft
        await fs.writeFile('pr-draft.md', `# ${prTitle}\n\n${prBody}`);
        console.log('✅ PR draft saved to pr-draft.md');

        console.log('\n📋 Proposed Pull Request:');
        console.log(`Title: ${prTitle}`);
        console.log(`\nBody Preview:\n${prBody.slice(0, 500)}...`);
        console.log('\n' + '='.repeat(60));

        const shouldCreatePR = await askUserConfirmation('\n❓ Do you want to create this Pull Request? (y/n): ');

        if (shouldCreatePR) {
            console.log('\n🚀 Creating Pull Request...');

            // TODO: Implement actual GitHub PR creation via GitHub API
            console.log('✅ Pull Request would be created with:');
            console.log(`   Repository: ${planData.issue.repo}`);
            console.log(`   Title: ${prTitle}`);
            console.log(`   Files: ${fixes.map(f => f.file).join(', ')}`);
            console.log(`   Draft: pr-draft.md`);
            console.log('\n⚠️  Note: Actual PR creation not yet implemented.');
            console.log('   You can manually create the PR using:');
            console.log('   - Generated fix files (fix-*.{ext})');
            console.log('   - PR draft (pr-draft.md)');
        } else {
            console.log('\n⏭️  Skipping PR creation.');
        }

        console.log('\n✅ Execution completed successfully');
        console.log('\n📦 Generated Files:');
        console.log(`   - pr-draft.md (PR description)`);
        fixes.forEach(f => console.log(`   - fix-${f.file.replace(/\//g, '-')} (${f.language})`));

    } catch (error) {
        console.error('❌ Execution failed:', error);
        process.exit(1);
    } finally {
        // Ensure sandbox cleanup happens even if there's an error
        try {
            if (sandbox) {
                await sandbox.cleanup();
                console.log('\n🧹 Sandbox cleaned up');
            }
        } catch (cleanupError) {
            console.error('⚠️ Cleanup error:', cleanupError);
        }
    }
}

runExecutionWorkflow();
