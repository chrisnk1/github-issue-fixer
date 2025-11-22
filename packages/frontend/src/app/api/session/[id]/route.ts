import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = params;

    // TODO: Fetch actual session data from storage/database
    // For now, return mock data
    return NextResponse.json({
        id,
        issueUrl: 'https://github.com/example/repo/issues/123',
        status: 'analyzing',
        progress: 0.3,
        currentStep: 'Cloning repository',
        overview: {
            summary: 'Analyzing repository structure and dependencies...',
            keyFiles: []
        }
    });
}
