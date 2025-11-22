'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import '../../styles/globals.css';

interface SessionData {
    id: string;
    status: 'analyzing' | 'planning' | 'executing' | 'complete';
    progress: number;
    overview?: {
        summary: string;
        architecture?: { content: string };
    };
}

export default function SessionPage() {
    const params = useParams();
    const sessionId = params.id as string;
    const [session, setSession] = useState<SessionData | null>(null);

    useEffect(() => {
        // Fetch session data
        fetch(`/api/session/${sessionId}`)
            .then(res => res.json())
            .then(setSession);

        // TODO: Connect to WebSocket for real-time updates
    }, [sessionId]);

    if (!session) {
        return (
            <div className="container" style={{ paddingTop: 'var(--space-16)' }}>
                <p className="text-secondary">Loading session...</p>
            </div>
        );
    }

    return (
        <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)' }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-12)' }}>
                <h1 style={{ marginBottom: 'var(--space-4)' }}>
                    Session {sessionId.slice(0, 8)}
                </h1>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                }}>
                    <span className="text-secondary">Status:</span>
                    <span style={{ textTransform: 'capitalize' }}>{session.status}</span>
                    <span className="text-tertiary">•</span>
                    <span className="text-secondary">{Math.round(session.progress * 100)}%</span>
                </div>
            </div>

            {/* Progress bar */}
            <div style={{
                height: '2px',
                backgroundColor: 'var(--color-border)',
                marginBottom: 'var(--space-12)',
            }}>
                <div style={{
                    height: '100%',
                    width: `${session.progress * 100}%`,
                    backgroundColor: 'var(--color-accent)',
                    transition: 'width 0.3s ease',
                }} />
            </div>

            {/* Content */}
            {session.status === 'analyzing' && (
                <div className="card">
                    <h3 style={{ marginBottom: 'var(--space-4)' }}>
                        Analyzing Repository
                    </h3>
                    <p className="text-secondary mb-0">
                        Cloning repository, installing dependencies, and running tests...
                    </p>
                </div>
            )}

            {session.overview && (
                <div className="card" style={{ marginTop: 'var(--space-8)' }}>
                    <h3 style={{ marginBottom: 'var(--space-6)' }}>
                        System Overview
                    </h3>
                    <p style={{ lineHeight: 'var(--line-height-relaxed)' }}>
                        {session.overview.summary}
                    </p>

                    {session.overview.architecture && (
                        <div style={{ marginTop: 'var(--space-8)' }}>
                            <h4 className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
                                Architecture
                            </h4>
                            <pre className="text-mono" style={{ fontSize: 'var(--text-sm)' }}>
                                {session.overview.architecture.content}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
