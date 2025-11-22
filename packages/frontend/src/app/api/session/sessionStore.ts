// Shared session store for in-memory session management
// In production, this should be replaced with Redis or a database

import type { SandboxManager } from '@fix-together/core';

export interface SessionData {
    id: string;
    issueUrl: string;
    status: 'analyzing' | 'planning' | 'executing' | 'complete' | 'error';
    progress: number;
    currentStep?: string;
    sandbox?: SandboxManager;
    overview?: any;
    plan?: any;
    error?: string;
}

// Use globalThis to ensure the map persists across module reloads in dev
const globalForSessions = globalThis as unknown as {
    sessions: Map<string, SessionData> | undefined;
};

export const sessions = globalForSessions.sessions ?? new Map<string, SessionData>();

if (process.env.NODE_ENV !== 'production') {
    globalForSessions.sessions = sessions;
}
