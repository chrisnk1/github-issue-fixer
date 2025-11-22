# Fix Together

A collaborative AI-powered tool for fixing GitHub issues with confidence. Built with E2B sandboxes for safe code execution and testing.

## Features

- 🔍 **Instant System Overview** - Analyzes repos, generates architecture diagrams, identifies bug areas
- 🤝 **Collaborative Fix Planning** - AI proposes fixes, you refine them together
- ✅ **Step-by-Step Execution** - Apply changes one at a time with full control
- 🚀 **Ship or Export** - Create PRs, patches, or push to your fork

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Run CLI
pnpm --filter @fix-together/cli dev fix <issue-url>

# Run Web UI
pnpm --filter @fix-together/web dev
```

## Requirements

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- E2B API key ([sign up](https://e2b.dev))
- GitHub personal access token
- Google AI API key or Groq API key

## Architecture

- `packages/core` - Core engine with E2B integration
- `packages/mcp-client` - MCP server integrations
- `packages/cli` - Command-line interface
- `packages/web` - Fastify backend + Next.js frontend

## License

MIT
