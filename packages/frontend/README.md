# Frontend

Next.js 16 frontend with Swiss-Japanese minimalist design for the Fix Together application.

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure environment variables**:
   Create a `.env.local` file in this directory with:
   ```bash
   E2B_API_KEY=your_e2b_api_key_here
   GOOGLE_AI_API_KEY=your_google_ai_api_key_here
   EXA_API_KEY=your_exa_api_key_here
   ```

3. **Run development server**:
   ```bash
   pnpm dev
   ```

   The app will be available at `http://localhost:3000`

## Features

- **Swiss-Japanese Minimalist Design**: Clean, functional interface with thin borders and generous whitespace
- **Real-time Session Tracking**: Watch as the AI analyzes repos and generates fix plans
- **E2B Sandbox Integration**: Safe code execution in isolated environments
- **MCP Support**: Access to documentation search and GitHub integration

## How It Works

1. Enter a GitHub issue URL (e.g., `https://github.com/owner/repo/issues/123`)
2. The backend creates an E2B sandbox with MCP support
3. AI analyzes the repository structure
4. Fix plan is generated with steps, resources, and suggestions
5. View real-time progress in the session page

## API Routes

- `POST /api/session` - Create a new fix session
- `GET /api/session/[id]` - Get session status and data
