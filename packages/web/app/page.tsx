'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../styles/globals.css';

export default function Home() {
    const [issueUrl, setIssueUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!issueUrl.trim()) return;

        setLoading(true);

        try {
            const response = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issueUrl }),
            });

            const data = await response.json();

            if (data.sessionId) {
                router.push(`/session/${data.sessionId}`);
            }
        } catch (error) {
            console.error('Failed to create session:', error);
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-6)',
        }}>
            <div style={{ maxWidth: '600px', width: '100%' }}>
                <h1 style={{ marginBottom: 'var(--space-12)' }}>
                    Fix Together
                </h1>

                <p className="text-secondary" style={{ marginBottom: 'var(--space-8)' }}>
                    Collaborative AI-powered GitHub issue fixer. Paste an issue URL to begin.
                </p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        className="input"
                        placeholder="https://github.com/owner/repo/issues/123"
                        value={issueUrl}
                        onChange={(e) => setIssueUrl(e.target.value)}
                        disabled={loading}
                        style={{ marginBottom: 'var(--space-4)' }}
                    />

                    <button
                        type="submit"
                        className="button"
                        disabled={loading || !issueUrl.trim()}
                        style={{ width: '100%' }}
                    >
                        {loading ? 'Starting...' : 'Start Fixing'}
                    </button>
                </form>

                <div style={{
                    marginTop: 'var(--space-12)',
                    paddingTop: 'var(--space-8)',
                    borderTop: '1px solid var(--color-border)',
                }}>
                    <h4 className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
                        How it works
                    </h4>

                    <ol style={{
                        listStyle: 'decimal',
                        paddingLeft: 'var(--space-6)',
                        color: 'var(--color-text-secondary)',
                    }}>
                        <li style={{ marginBottom: 'var(--space-2)' }}>
                            Analyzes repository and generates system overview
                        </li>
                        <li style={{ marginBottom: 'var(--space-2)' }}>
                            Creates collaborative fix plan with your input
                        </li>
                        <li style={{ marginBottom: 'var(--space-2)' }}>
                            Applies changes step-by-step with your approval
                        </li>
                        <li>
                            Creates PR or exports patch file
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
