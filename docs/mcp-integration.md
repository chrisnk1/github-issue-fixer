# MCP Integration Guide

This guide explains how to use Model Context Protocol (MCP) servers with the E2B sandbox in Fix Together.

## Overview

Fix Together integrates MCP servers directly into the E2B sandbox, enabling AI models to access external tools and services like:

- **Exa**: Semantic search for documentation and web content
- **GitHub**: Repository and issue management
- **Filesystem**: File operations within the sandbox

## Configuration

### Setting Up MCP Servers

Configure MCP servers when creating a sandbox:

```typescript
import { SandboxManager, createMCPConfig } from '@fix-together/core';

const sandboxManager = new SandboxManager({
    apiKey: process.env.E2B_API_KEY!,
    timeout: 600000, // 10 minutes
    mcp: createMCPConfig({
        exaApiKey: process.env.EXA_API_KEY,
        githubApiKey: process.env.GITHUB_TOKEN,
        enableFilesystem: true,
    }),
});

await sandboxManager.create();
```

### Manual Configuration

You can also configure MCP servers manually:

```typescript
const sandboxManager = new SandboxManager({
    apiKey: process.env.E2B_API_KEY!,
    mcp: {
        exa: {
            apiKey: process.env.EXA_API_KEY!,
        },
        github: {
            apiKey: process.env.GITHUB_TOKEN!,
        },
        filesystem: true,
    },
});
```

## Using MCP with AI Models

### With Groq

Groq supports MCP through the OpenAI-compatible responses API:

```typescript
import { AIClient, getMCPCredentials } from '@fix-together/core';

const aiClient = new AIClient({
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY!,
    model: 'llama-3.3-70b-versatile',
});

// Get MCP credentials from sandbox
const mcpCredentials = await getMCPCredentials(sandboxManager);

// Generate response with MCP tool access
const response = await aiClient.generateWithMCP(
    [
        {
            role: 'user',
            content: 'Search for recent developments in TypeScript using Exa',
        },
    ],
    mcpCredentials
);

console.log(response.content);
```

### With Google Gemini

For Google Gemini, MCP integration requires a different approach. Currently, the `generateWithMCP` method falls back to regular generation for Google:

```typescript
const aiClient = new AIClient({
    provider: 'google',
    apiKey: process.env.GOOGLE_AI_API_KEY!,
});

// Falls back to regular generation
const response = await aiClient.generateWithMCP(
    messages,
    mcpCredentials
);
```

## Available MCP Tools

### Exa Tools

When Exa is configured, the AI can:
- Search the web semantically
- Find relevant documentation
- Discover related resources

Example prompt:
```
"Use Exa to find the latest best practices for React Server Components"
```

### GitHub Tools

When GitHub is configured, the AI can:
- Fetch repository information
- Read issues and pull requests
- Access file contents

Example prompt:
```
"Use GitHub to analyze the issues in facebook/react repository"
```

### Filesystem Tools

When filesystem is enabled, the AI can:
- Read files from the sandbox
- Write files to the sandbox
- List directory contents

Example prompt:
```
"Read the package.json file and suggest dependency updates"
```

## MCP Gateway

The E2B sandbox exposes an MCP gateway that AI models can connect to:

```typescript
// Get gateway URL and token
const mcpUrl = sandboxManager.getMcpUrl();
const mcpToken = await sandboxManager.getMcpToken();

console.log('MCP Gateway:', mcpUrl);
console.log('Token:', mcpToken);
```

### Health Check

Verify the MCP gateway is accessible:

```typescript
import { checkMCPHealth } from '@fix-together/core';

const isHealthy = await checkMCPHealth(mcpUrl, mcpToken);
console.log('MCP Gateway healthy:', isHealthy);
```

## Complete Example

Here's a complete example that uses MCP to research AI developments:

```typescript
import { 
    SandboxManager, 
    AIClient, 
    createMCPConfig,
    getMCPCredentials 
} from '@fix-together/core';

async function researchAI() {
    // Create MCP-enabled sandbox
    const sandbox = new SandboxManager({
        apiKey: process.env.E2B_API_KEY!,
        mcp: createMCPConfig({
            exaApiKey: process.env.EXA_API_KEY,
        }),
    });

    await sandbox.create();

    // Create AI client
    const ai = new AIClient({
        provider: 'groq',
        apiKey: process.env.GROQ_API_KEY!,
    });

    // Get MCP credentials
    const mcpCreds = await getMCPCredentials(sandbox);

    // Research with MCP tools
    const response = await ai.generateWithMCP(
        [
            {
                role: 'user',
                content: 'What happened last week in AI? Use Exa to search for recent developments.',
            },
        ],
        mcpCreds
    );

    console.log('Research Results:');
    console.log(response.content);

    // Cleanup
    await sandbox.cleanup();
}

researchAI().catch(console.error);
```

## Environment Variables

Make sure these environment variables are set:

```bash
# Required
E2B_API_KEY=your_e2b_api_key

# For AI
GROQ_API_KEY=your_groq_api_key
# OR
GOOGLE_AI_API_KEY=your_google_ai_api_key

# For MCP servers (optional)
EXA_API_KEY=your_exa_api_key
GITHUB_TOKEN=your_github_token
```

## Best Practices

1. **Always cleanup**: Call `sandbox.cleanup()` when done to avoid resource leaks
2. **Use timeouts**: Set appropriate timeouts for long-running operations
3. **Error handling**: Wrap MCP calls in try-catch blocks
4. **Token management**: MCP tokens are temporary and tied to the sandbox lifecycle
5. **Rate limiting**: Be mindful of API rate limits for MCP services

## Troubleshooting

### MCP Gateway Not Accessible

If the MCP gateway is not accessible:

```typescript
const isHealthy = await checkMCPHealth(mcpUrl, mcpToken);
if (!isHealthy) {
    console.error('MCP gateway is not accessible');
    // Recreate sandbox or check configuration
}
```

### Missing API Keys

Ensure all required API keys are set in your environment:

```typescript
if (!process.env.EXA_API_KEY) {
    throw new Error('EXA_API_KEY is required for Exa MCP server');
}
```

### Tool Not Available

If a tool is not available, check your MCP configuration:

```typescript
// Verify MCP servers are configured
const mcpUrl = sandbox.getMcpUrl();
console.log('MCP Gateway URL:', mcpUrl);
```

## Additional Resources

- [E2B MCP Documentation](https://e2b.dev/docs/mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Docker MCP Catalog](https://hub.docker.com/mcp)
- [Exa API Documentation](https://docs.exa.ai/)
