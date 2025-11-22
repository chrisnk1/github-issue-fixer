import { Sandbox } from 'e2b';
import 'dotenv/config';

async function runRealIssueWorkflow() {
    console.log('🚀 Starting Real Issue Workflow with Gemini + Exa (Inside Sandbox)\n');

    if (!process.env.E2B_API_KEY || !process.env.GOOGLE_AI_API_KEY || !process.env.EXA_API_KEY) {
        console.error('❌ Missing required environment variables: E2B_API_KEY, GOOGLE_AI_API_KEY, or EXA_API_KEY');
        console.log('   Please ensure .env file contains these keys.');
        process.exit(1);
    }

    // 1. Create Sandbox (using base template)
    console.log('📦 Creating E2B sandbox...');
    const sbx = await Sandbox.create('base', {
        apiKey: process.env.E2B_API_KEY,
        timeoutMs: 300_000, // 5 minutes
    });

    console.log('✅ Sandbox created');

    try {
        // 2. Setup workspace
        console.log('\n📦 Setting up workspace...');
        await sbx.commands.run('mkdir -p /home/user/agent');

        // Install dependencies
        console.log('📦 Installing dependencies...');
        const pkgJson = {
            name: "agent",
            version: "1.0.0",
            type: "module",
            dependencies: {
                "@google/generative-ai": "^0.21.0",
                "exa-js": "^1.0.15"
            }
        };

        await sbx.files.write('/home/user/agent/package.json', JSON.stringify(pkgJson, null, 2));

        const installResult = await sbx.commands.run('cd /home/user/agent && npm install', {
            timeoutMs: 120_000
        });

        if (installResult.exitCode !== 0) {
            throw new Error(`Failed to install dependencies: ${installResult.stderr}`);
        }

        console.log('✅ Dependencies installed');

        // 3. Create the Agent Script
        console.log('\n📝 Creating agent script inside sandbox...');

        const agentScript = `import { GoogleGenerativeAI } from '@google/generative-ai';
import Exa from 'exa-js';

// Initialize clients with env vars
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const exa = new Exa(process.env.EXA_API_KEY!);

async function fetchGitHubIssues(repo: string, numIssues: number = 5): Promise<any[]> {
    const query = \`open issues in \${repo} repo\`;
    console.log(\`🔍 Searching Exa for: "\${query}"...\`);
    
    // Use Exa to find issues
    const results = await exa.search(query, {
        numResults: numIssues * 2,
        includeDomains: ['github.com'],
        type: 'semantic',
        useAutoprompt: true,
        contents: true,
    });

    // Filter and map results
    const issues = results.results
        .filter((r: any) => r.url.includes('/issues/') && !r.url.includes('/pull/') && r.score > 0.15)
        .slice(0, numIssues)
        .map((r: any) => ({
            number: r.url.split('/issues/')[1]?.split('#')[0] || 'N/A',
            title: r.title,
            url: r.url,
            snippet: r.text?.slice(0, 300) || 'No description',
        }));

    return issues;
}

async function runAgent() {
    const repo = process.env.GITHUB_REPO || 'e2b-dev/E2B';
    const prompt = \`You are a helpful AI. Fetch the top 5 open issues from \${repo} using the provided data. Summarize each with number, title, and brief description. Output as JSON array.\`;

    try {
        const issues = await fetchGitHubIssues(repo, 5);
        console.log(\`✅ Fetched \${issues.length} issues via Exa\`);

        // Using gemini-2.0-flash-exp as configured in this project
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        
        const result = await model.generateContent([
            prompt,
            JSON.stringify(issues),
        ]);
        
        const response = result.response;
        const text = response.text();
        
        // Clean output to ensure just JSON
        let jsonStr = text;
        if (text.includes('\`\`\`json')) {
             jsonStr = text.split('\`\`\`json')[1].split('\`\`\`')[0].trim();
        } else if (text.includes('\`\`\`')) {
             jsonStr = text.split('\`\`\`')[1].split('\`\`\`')[0].trim();
        }
        
        console.log('--- AGENT JSON OUTPUT ---');
        console.log(jsonStr);
        console.log('--- END AGENT OUTPUT ---');

    } catch (error) {
        console.error('Agent Error:', error);
        process.exit(1);
    }
}

runAgent();
`;

        // Upload agent script
        await sbx.files.write('/home/user/agent/agent.mjs', agentScript);

        // 4. Run the Agent
        console.log('\n🚀 Running Agent inside sandbox...');
        console.log(`   Repo: ${process.env.GITHUB_REPO || 'e2b-dev/E2B'}`);

        const proc = await sbx.commands.run('cd /home/user/agent && node agent.mjs', {
            envs: {
                GOOGLE_API_KEY: process.env.GOOGLE_AI_API_KEY!,
                EXA_API_KEY: process.env.EXA_API_KEY!,
                GITHUB_REPO: process.env.GITHUB_REPO || 'e2b-dev/E2B'
            },
            onStdout: (data) => process.stdout.write(data),
            onStderr: (data) => process.stderr.write(data),
        });

        await proc.wait();

        console.log('\n✅ Agent completed successfully');

    } catch (err) {
        console.error('❌ Workflow failed:', err instanceof Error ? err.message : err);
        if (err instanceof Error && err.stack) {
            console.error('Stack:', err.stack);
        }
    } finally {
        await sbx.kill();
        console.log('\n✅ Sandbox destroyed');
    }
}

runRealIssueWorkflow();
