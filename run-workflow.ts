import {
    SandboxManager,
    AIClient,
    createMCPConfig,
    getMCPCredentials,
    FixPlanner
} from './packages/core/src/index.js';
import type { SystemOverview } from './packages/core/src/types.js';
import 'dotenv/config';

async function runWorkflow() {
    console.log('🚀 Starting Pair Issue Fixer Workflow Test\n');

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
            provider: 'google',
            apiKey: process.env.GOOGLE_AI_API_KEY!,
            model: 'gemini-2.0-flash-exp', // Using a capable Google model
        });

        // 4. Initialize Fix Planner
        const planner = new FixPlanner(ai);

        // 5. Simulate a System Overview (mocking analysis phase)
        const mockSystemOverview: SystemOverview = {
            summary: "A simple Express.js API with a login endpoint.",
            architecture: {
                type: 'mermaid',
                content: 'graph TD; A[Client] --> B[Server];'
            },
            keyFiles: [
                { path: "src/index.js", purpose: "Main server file", exports: ["app"], dependencies: ["express"] },
                { path: "src/auth.js", purpose: "Authentication logic", exports: ["login"], dependencies: [] }
            ],
            callGraph: [],
            testResults: {
                success: false,
                output: "Tests failed",
                duration: 1000,
                failedTests: ["POST /login should return 400 for invalid email"]
            }
        };

        // 6. Define the Issue
        const issueDescription = "The login endpoint crashes when an invalid email format is sent. We need to add proper input validation for the email field.";
        console.log(`\n📝 Issue: ${issueDescription}\n`);

        // 7. Create Fix Plan (This uses AI + MCP for resources)
        console.log('🧠 Generating Fix Plan (this uses AI and MCP for research)...');
        const plan = await planner.createPlan(
            issueDescription,
            mockSystemOverview
        );

        // 8. Output Results
        console.log('\n' + '='.repeat(60));
        console.log('📋 FIX PLAN GENERATED');
        console.log('='.repeat(60));

        console.log('\n🔹 Steps:');
        plan.steps.forEach((step, i) => {
            console.log(`${i + 1}. ${step.description}`);
            console.log(`   Reasoning: ${step.reasoning}`);
            console.log(`   Files: ${step.files.join(', ')}`);
            console.log('');
        });

        console.log('🔹 Clarifying Questions:');
        plan.questions.forEach((q, i) => {
            console.log(`${i + 1}. ${q.text}`);
        });

        console.log('\n🔹 Recommended Resources (via Exa MCP):');
        if (plan.resources && plan.resources.length > 0) {
            plan.resources.forEach((r, i) => {
                console.log(`${i + 1}. ${r.title} - ${r.url}`);
            });
        } else {
            console.log('   No resources found (check MCP configuration if this is unexpected)');
        }

        console.log('\n🔹 Suggestions:');
        plan.suggestions.forEach((s, i) => {
            console.log(`${i + 1}. ${s.text || (s as any).description || JSON.stringify(s)}`);
        });

        // Cleanup
        await sandbox.cleanup();
        console.log('\n✅ Workflow completed successfully');

    } catch (error) {
        console.error('❌ Workflow failed:', error);
        process.exit(1);
    }
}

runWorkflow();
