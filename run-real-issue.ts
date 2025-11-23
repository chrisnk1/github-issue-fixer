import {
    SandboxManager,
    AIClient,
    createMCPConfig,
    getMCPCredentials,
    FixPlanner
} from './packages/core/src/index.js';
import type { SystemOverview } from './packages/core/src/types.js';
import 'dotenv/config';

async function runRealIssueWorkflow() {
    console.log('🚀 Starting Real Issue Workflow with Fix Suggestions\n');

    if (!process.env.E2B_API_KEY || !process.env.GROQ_API_KEY || !process.env.EXA_API_KEY) {
        console.error('❌ Missing required environment variables: E2B_API_KEY, GROQ_API_KEY, or EXA_API_KEY');
        console.log('   Please ensure .env file contains these keys.');
        process.exit(1);
    }

    try {
        // 1. Initialize Sandbox with MCP
        console.log('📦 Initializing Sandbox with MCP...');
        const sandbox = new SandboxManager({
            apiKey: process.env.E2B_API_KEY!,
            timeout: 600000,
            mcp: createMCPConfig({
                exaApiKey: process.env.EXA_API_KEY,
                enableFilesystem: true,
            }),
        });
        await sandbox.create();
        console.log('✅ Sandbox created');

        // 2. Get MCP Credentials
        const mcpCreds = await getMCPCredentials(sandbox);
        console.log(`✅ MCP Gateway ready at ${mcpCreds.mcpUrl}`);

        // 3. Initialize AI Client
        console.log('🤖 Initializing AI Client...');
        const ai = new AIClient({
            provider: 'groq',
            apiKey: process.env.GROQ_API_KEY!,
            model: 'moonshotai/kimi-k2-instruct-0905',
        });

        // 4. Initialize Fix Planner
        const planner = new FixPlanner(ai);

        // 5. Fetch Real GitHub Issue using Exa
        console.log('\n🔍 Fetching real GitHub issue...');

        const repo = process.env.GITHUB_REPO || 'e2b-dev/E2B';

        // Use AI to fetch issue via MCP Exa
        const issuePrompt = `Search for recent open issues in the ${repo} GitHub repository. Find one issue with good detail and return: issue number, title, and full description.`;

        const issueResponse = await ai.generateWithMCP(
            [{ role: 'user', content: issuePrompt }],
            mcpCreds,
            { temperature: 0.7 }
        );

        console.log(`📝 Found issue:\n${issueResponse.content}\n`);

        // 6. Create mock system overview (in real scenario, would analyze the repo)
        const mockSystemOverview: SystemOverview = {
            summary: `GitHub repository: ${repo}`,
            architecture: {
                type: 'ascii',
                content: 'Repository architecture to be analyzed'
            },
            keyFiles: [],
            callGraph: [],
            testResults: {
                success: false,
                output: 'Issue analysis in progress',
                duration: 0,
                failedTests: []
            }
        };

        // 7. Generate Fix Plan with AI + MCP resources
        console.log('🧠 Generating Fix Plan with suggestions and resources...\n');
        const plan = await planner.createPlan(
            issueResponse.content,
            mockSystemOverview
        );

        // 8. Output Results
        console.log('='.repeat(80));
        console.log('📋 FIX PLAN GENERATED');
        console.log('='.repeat(80));

        console.log('\n🔹 Steps:');
        plan.steps.forEach((step, i) => {
            console.log(`${i + 1}. ${step.description}`);
            console.log(`   Reasoning: ${step.reasoning}`);
            if (step.files.length > 0) {
                console.log(`   Files: ${step.files.join(', ')}`);
            }
            console.log('');
        });

        console.log('🔹 Clarifying Questions:');
        if (plan.questions.length > 0) {
            plan.questions.forEach((q, i) => {
                console.log(`${i + 1}. ${q.text}`);
            });
        } else {
            console.log('   No clarifying questions needed');
        }

        console.log('\n🔹 Recommended Resources (via Exa MCP):');
        if (plan.resources && plan.resources.length > 0) {
            plan.resources.forEach((r, i) => {
                console.log(`${i + 1}. ${r.title}`);
                console.log(`   URL: ${r.url}`);
                if (r.snippet) {
                    console.log(`   Snippet: ${r.snippet.slice(0, 100)}...`);
                }
                console.log('');
            });
        } else {
            console.log('   No specific resources found');
        }

        console.log('🔹 Implementation Suggestions:');
        if (plan.suggestions.length > 0) {
            plan.suggestions.forEach((s, i) => {
                console.log(`${i + 1}. ${s.text || (s as any).description || JSON.stringify(s)}`);
            });
        } else {
            console.log('   See steps above for implementation details');
        }

        // Cleanup
        await sandbox.cleanup();
        console.log('\n✅ Workflow completed successfully');

    } catch (error) {
        console.error('❌ Workflow failed:', error);
        process.exit(1);
    }
}

runRealIssueWorkflow();
