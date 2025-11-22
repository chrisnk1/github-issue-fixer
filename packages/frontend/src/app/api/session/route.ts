import { NextRequest, NextResponse } from 'next/server';
import {
    SandboxManager,
    AIClient,
    createMCPConfig,
    getMCPCredentials,
    FixPlanner
} from '@fix-together/core';
import type { SystemOverview } from '@fix-together/core';
import { sessions } from './sessionStore';

export async function POST(request: NextRequest) {
    try {
        const { issueUrl } = await request.json();
        console.log('\n📥 Received session creation request');
        console.log(`🔗 Issue URL: ${issueUrl}`);

        if (!issueUrl) {
            console.log('❌ Missing issueUrl');
            return NextResponse.json(
                { error: 'issueUrl is required' },
                { status: 400 }
            );
        }

        // Validate GitHub issue URL format
        const githubIssueRegex = /^https?:\/\/github\.com\/([\w-]+)\/([\w-]+)\/issues\/(\d+)/;
        const match = issueUrl.match(githubIssueRegex);

        if (!match) {
            console.log('❌ Invalid GitHub URL format');
            return NextResponse.json(
                { error: 'Invalid GitHub issue URL format. Expected: https://github.com/owner/repo/issues/123' },
                { status: 400 }
            );
        }

        const [, owner, repo, issueNumber] = match;
        console.log(`✅ Parsed: ${owner}/${repo}#${issueNumber}`);

        // Check for required environment variables
        if (!process.env.E2B_API_KEY || !process.env.GOOGLE_AI_API_KEY) {
            console.error('❌ Missing required environment variables');
            return NextResponse.json(
                { error: 'Server configuration error: Missing E2B_API_KEY or GOOGLE_AI_API_KEY' },
                { status: 500 }
            );
        }

        // Generate session ID
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        console.log(`🆔 Generated session ID: ${sessionId}`);

        // Initialize session
        const session = {
            id: sessionId,
            issueUrl,
            status: 'analyzing' as const,
            progress: 0,
            currentStep: 'Initializing sandbox...'
        };

        sessions.set(sessionId, session);
        console.log(`💾 Session stored in memory`);

        // Start async workflow (don't await - let it run in background)
        console.log(`🚀 Starting background workflow...`);
        runWorkflow(sessionId, issueUrl, owner, repo, issueNumber).catch(error => {
            console.error(`❌ Workflow error for session ${sessionId}:`, error);
            const session = sessions.get(sessionId);
            if (session) {
                session.status = 'error';
                session.error = error.message;
            }
        });

        console.log(`✅ Session created successfully\n`);
        return NextResponse.json({
            sessionId,
            status: 'created',
            issueUrl
        });
    } catch (error) {
        console.error('❌ Error creating session:', error);
        return NextResponse.json(
            { error: 'Failed to create session' },
            { status: 500 }
        );
    }
}

async function runWorkflow(
    sessionId: string,
    issueUrl: string,
    owner: string,
    repo: string,
    issueNumber: string
) {
    const session = sessions.get(sessionId);
    if (!session) return;

    console.log(`\n🚀 Starting workflow for session ${sessionId}`);
    console.log(`📝 Issue: ${issueUrl}`);

    try {
        // 1. Initialize Sandbox with MCP
        console.log(`[${sessionId}] 📦 Creating E2B sandbox with MCP...`);
        session.currentStep = 'Creating E2B sandbox with MCP...';
        session.progress = 0.1;

        const sandbox = new SandboxManager({
            apiKey: process.env.E2B_API_KEY!,
            timeout: 600000,
            mcp: createMCPConfig({
                exaApiKey: process.env.EXA_API_KEY,
                enableFilesystem: true,
            }),
        });

        await sandbox.create();
        console.log(`[${sessionId}] ✅ Sandbox created successfully`);
        session.sandbox = sandbox;
        session.progress = 0.2;

        // 2. Get MCP Credentials
        console.log(`[${sessionId}] 🔑 Getting MCP credentials...`);
        session.currentStep = 'Configuring MCP gateway...';
        const mcpCreds = await getMCPCredentials(sandbox);
        console.log(`[${sessionId}] ✅ MCP gateway ready at ${mcpCreds.mcpUrl}`);
        session.progress = 0.25;

        // 3. Initialize AI Client
        console.log(`[${sessionId}] 🤖 Initializing AI client (Gemini)...`);
        session.currentStep = 'Initializing AI client...';
        const ai = new AIClient({
            provider: 'google',
            apiKey: process.env.GOOGLE_AI_API_KEY!,
            model: 'gemini-2.0-flash-exp',
        });
        console.log(`[${sessionId}] ✅ AI client initialized`);
        session.progress = 0.3;

        // 4. Fetch issue details via MCP
        console.log(`[${sessionId}] 🔍 Fetching issue #${issueNumber} from ${owner}/${repo}...`);
        session.currentStep = 'Fetching GitHub issue details...';
        const issuePrompt = `Fetch details for GitHub issue #${issueNumber} from ${owner}/${repo}. Return the issue title, description, and any relevant context.`;

        const issueResponse = await ai.generateWithMCP(
            [{ role: 'user', content: issuePrompt }],
            mcpCreds,
            { temperature: 0.7 }
        );
        console.log(`[${sessionId}] ✅ Issue details fetched`);
        console.log(`[${sessionId}] 📄 Issue content preview: ${issueResponse.content.substring(0, 100)}...`);
        session.progress = 0.5;

        // 5. Create mock system overview (real analysis would happen later if needed)
        console.log(`[${sessionId}] 📊 Creating system overview...`);
        const mockOverview: SystemOverview = {
            summary: `GitHub repository: ${owner}/${repo}\nIssue #${issueNumber}: ${issueResponse.content.split('\n')[0]}`,
            architecture: {
                type: 'ascii',
                content: 'Repository analysis pending'
            },
            keyFiles: [],
            callGraph: [],
            testResults: {
                success: false,
                output: 'Tests not run yet',
                duration: 0,
                failedTests: []
            }
        };
        session.overview = mockOverview;
        session.progress = 0.6;

        // 6. Generate fix plan
        console.log(`[${sessionId}] 🧠 Generating fix plan with AI...`);
        session.status = 'planning';
        session.currentStep = 'Generating fix plan with AI...';
        const planner = new FixPlanner(ai);
        const plan = await planner.createPlan(issueResponse.content, mockOverview);
        console.log(`[${sessionId}] ✅ Fix plan generated with ${plan.steps.length} steps`);
        console.log(`[${sessionId}] 💡 Questions: ${plan.questions.length}, Resources: ${plan.resources?.length || 0}`);
        session.plan = plan;
        session.progress = 0.9;

        // 7. Complete
        console.log(`[${sessionId}] ✅ Workflow completed successfully!`);
        session.status = 'complete';
        session.currentStep = 'Fix plan generated';
        session.progress = 1.0;

        // Cleanup sandbox
        console.log(`[${sessionId}] 🧹 Cleaning up sandbox...`);
        await sandbox.cleanup();
        console.log(`[${sessionId}] ✅ Sandbox cleaned up\n`);

    } catch (error: any) {
        console.error(`[${sessionId}] ❌ Workflow error:`, error);
        console.error(`[${sessionId}] Error stack:`, error.stack);
        session.status = 'error';
        session.error = error.message;
        session.currentStep = 'Error occurred';

        // Cleanup sandbox on error
        if (session.sandbox) {
            console.log(`[${sessionId}] 🧹 Cleaning up sandbox after error...`);
            await session.sandbox.cleanup().catch(err => {
                console.error(`[${sessionId}] Failed to cleanup sandbox:`, err);
            });
        }
    }
}
