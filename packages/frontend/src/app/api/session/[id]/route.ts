import { NextRequest, NextResponse } from 'next/server';
import { sessions } from '../route';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const session = sessions.get(id);

    if (!session) {
        return NextResponse.json(
            { error: 'Session not found' },
            { status: 404 }
        );
    }

    // Return session data without the sandbox instance
    const { sandbox, ...sessionData } = session;

    return NextResponse.json(sessionData);
}
