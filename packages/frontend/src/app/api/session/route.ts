import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { issueUrl } = await request.json();

        if (!issueUrl) {
            return NextResponse.json(
                { error: 'issueUrl is required' },
                { status: 400 }
            );
        }

        // Validate GitHub issue URL format
        const githubIssueRegex = /^https?:\/\/github\.com\/[\w-]+\/[\w-]+\/issues\/\d+/;
        if (!githubIssueRegex.test(issueUrl)) {
            return NextResponse.json(
                { error: 'Invalid GitHub issue URL format' },
                { status: 400 }
            );
        }

        // Generate session ID
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // TODO: Initialize sandbox and start analysis
        // This will be connected to the core package later
        // For now, just return the session ID

        return NextResponse.json({
            sessionId,
            status: 'created',
            issueUrl
        });
    } catch (error) {
        console.error('Error creating session:', error);
        return NextResponse.json(
            { error: 'Failed to create session' },
            { status: 500 }
        );
    }
}
