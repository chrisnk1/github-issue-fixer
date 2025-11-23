import {
    SandboxManager,
    AIClient,
    createMCPConfig,
    getMCPCredentials
} from '@fix-together/core';
import 'dotenv/config';

/**
 * Example: Using MCP-enabled sandbox with Groq to research AI developments
 * 
 * This demonstrates the pattern from the E2B + Groq + Exa example
 */
async function researchWithMCP() {
    console.log('Creating MCP-enabled E2B sandbox...');

    // Create sandbox with MCP servers configured
    const sandbox = new SandboxManager({
        apiKey: process.env.E2B_API_KEY!,
        timeout: 600000, // 10 minutes
        mcp: createMCPConfig({
            exaApiKey: process.env.EXA_API_KEY,
            githubApiKey: process.env.GITHUB_TOKEN,
            enableFilesystem: true,
        }),
    });

    await sandbox.create();
    console.log('Sandbox created successfully');

    // Get MCP gateway credentials
    const mcpCreds = await getMCPCredentials(sandbox);
    console.log(`MCP Gateway URL: ${mcpCreds.mcpUrl}`);

    // Create AI client (Groq)
    const ai = new AIClient({
        provider: 'groq',
        apiKey: process.env.GROQ_API_KEY!,
        model: 'moonshotai/kimi-k2-instruct-0905',
    });

    console.log('Starting AI research with MCP tools...');

    // Use AI with MCP tool access
    const response = await ai.generateWithMCP(
        [
            {
                role: 'user',
                content: 'What happened last week in AI? Use Exa to search for recent AI developments and provide a comprehensive summary.',
            },
        ],
        mcpCreds
    );

    console.log('\nResearch Results:');
    console.log(response.content);

    // Cleanup
    console.log('\nCleaning up sandbox...');
    await sandbox.cleanup();
    console.log('Done!');
}

// Run the example
researchWithMCP().catch((error) => {
    console.error('Failed to run MCP example:', error);
    process.exit(1);
});
