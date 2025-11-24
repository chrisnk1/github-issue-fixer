'use client';

import { useEffect, useState } from 'react';
import './session.css';
import { FixPanelSlide } from './components/FixPanelSlide';
import { PRDraftPanel } from './components/PRDraftPanel';

interface SessionData {
    id: string;
    issueUrl: string;
    status: 'analyzing' | 'planning' | 'executing' | 'complete' | 'error';
    progress: number;
    currentStep?: string;
    overview?: {
        summary: string;
        architecture?: { type: string; content: string };
        keyFiles: string[];
    };
    plan?: {
        steps: Array<{
            description: string;
            reasoning: string;
            files: string[];
            status?: 'pending' | 'running' | 'complete' | 'error';
        }>;
        questions: Array<{ text: string }>;
        resources?: Array<{ title: string; url: string; snippet?: string }>;
    };
    fixes?: Array<{
        file: string;
        language: string;
        code: string;
    }>;
    prDraft?: {
        title: string;
        body: string;
    };
    changes?: Array<{
        file: string;
        diff: string;
        status: 'pending' | 'applied' | 'error';
    }>;
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const [sessionId, setSessionId] = useState<string>('');
    const [session, setSession] = useState<SessionData | null>(null);
    const [isGeneratingFixes, setIsGeneratingFixes] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [userClosedPanel, setUserClosedPanel] = useState(false);
    const [hasAutoOpened, setHasAutoOpened] = useState(false);

    // Open panel when fixes are available (only once, and only if user hasn't closed it)
    useEffect(() => {
        if (session?.fixes && session.fixes.length > 0 && !hasAutoOpened && !userClosedPanel) {
            setIsPanelOpen(true);
            setHasAutoOpened(true);
        }
    }, [session?.fixes, hasAutoOpened, userClosedPanel]);

    const handleGenerateFixes = async () => {
        if (!sessionId || isGeneratingFixes) return;

        setIsGeneratingFixes(true);
        try {
            const response = await fetch(`/api/session/${sessionId}/generate-fixes`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to start fix generation');
            }

            // Force a fetch to update UI immediately
            fetch(`/api/session/${sessionId}`)
                .then(res => res.json())
                .then(data => setSession(data))
                .catch(console.error);

        } catch (error) {
            console.error('Error generating fixes:', error);
            alert('Failed to generate fixes. Please try again.');
        } finally {
            setIsGeneratingFixes(false);
        }
    };

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        params.then(({ id }) => {
            setSessionId(id);

            // Fetch session data immediately
            const fetchSession = () => {
                fetch(`/api/session/${id}`)
                    .then(res => res.json())
                    .then(data => {
                        setSession(data);

                        // Only stop polling if there's an error
                        // Keep polling to catch fix generation updates
                        if (data.status === 'error') {
                            if (intervalId) {
                                clearInterval(intervalId);
                            }
                        }
                    })
                    .catch(console.error);
            };

            fetchSession();

            // Poll every 2 seconds for updates
            intervalId = setInterval(fetchSession, 2000);
        });

        // Cleanup interval on unmount
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [params]);

    if (!session || !sessionId) {
        return (
            <div className="session-container">
                <div className="session-loading">
                    <div className="loading-spinner"></div>
                    <p>Initializing session...</p>
                </div>
            </div>
        );
    }

    const statusConfig = {
        analyzing: { color: '#000', label: 'Analyzing' },
        planning: { color: '#000', label: 'Planning' },
        executing: { color: '#000', label: 'Executing' },
        complete: { color: '#000', label: 'Complete' },
        error: { color: '#000', label: 'Error' }
    };

    const currentStatus = statusConfig[session.status] || { color: '#000', label: 'Unknown' };

    return (
        <div className="session-container">
            {/* Header */}
            <header className="session-header">
                <div className="session-header-content">
                    <div className="session-title-row">
                        <div className="session-id-badge">
                            <span className="session-id-label">Session</span>
                            <span className="session-id-value">{sessionId.slice(0, 8)}</span>
                        </div>
                        {session.issueUrl && (
                            <a
                                href={session.issueUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="issue-link"
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                                </svg>
                                {session.issueUrl.split('/').slice(-2).join('/')}
                            </a>
                        )}
                    </div>

                    <div className="status-bar">
                        <div className="status-indicator">
                            <div className="status-dot" style={{ backgroundColor: currentStatus.color }}></div>
                            <span className="status-text">{currentStatus.label}</span>
                        </div>
                        {session.currentStep && (
                            <>
                                <span className="status-separator">•</span>
                                <span className="current-step">{session.currentStep}</span>
                            </>
                        )}
                    </div>

                    <div className="progress-bar-container">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${session.progress * 100}%` }}
                        ></div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="session-main">
                {/* Analysis Phase */}
                {session.status === 'analyzing' && (
                    <section className="session-section">
                        <div className="section-header">
                            <div className="section-icon">→</div>
                            <h2 className="section-title">Analyzing Repository</h2>
                        </div>
                        <div className="analysis-steps">
                            {['Fetching issue details', 'Initializing sandbox', 'Configuring MCP', 'Generating overview'].map((step, i) => (
                                <div key={i} className="analysis-step">
                                    <div className="step-marker"></div>
                                    <span>{step}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Overview */}
                {session.overview && (
                    <section className="session-section">
                        <div className="section-header">
                            <div className="section-icon">◻</div>
                            <h2 className="section-title">System Overview</h2>
                        </div>
                        <p className="overview-summary">{session.overview.summary}</p>

                        {session.overview.keyFiles && session.overview.keyFiles.length > 0 && (
                            <div className="key-files">
                                <h3 className="subsection-title">Key Files</h3>
                                <div className="file-list">
                                    {session.overview.keyFiles.map((file, i) => (
                                        <div key={i} className="file-item">
                                            <code>{file}</code>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Plan */}
                {session.plan && (
                    <section id="fix-plan-section" className="session-section">
                        <div className="section-header">
                            <div className="section-icon">⊕</div>
                            <h2 className="section-title">Fix Plan</h2>
                        </div>
                        <div className="plan-steps">
                            {session.plan.steps.map((step, i) => (
                                <div key={i} className={`plan-step ${step.status || 'pending'}`}>
                                    <div className="plan-step-header">
                                        <div className="plan-step-number">{String(i + 1).padStart(2, '0')}</div>
                                        <h3 className="plan-step-title">{step.description}</h3>
                                    </div>
                                    <p className="plan-step-reasoning">{step.reasoning}</p>
                                    {step.files.length > 0 && (
                                        <div className="plan-step-files">
                                            {step.files.map((file, j) => (
                                                <code key={j} className="file-badge">{file}</code>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Clarifying Questions */}
                {session.plan && session.plan.questions && session.plan.questions.length > 0 && (
                    <section className="session-section">
                        <div className="section-header">
                            <div className="section-icon">?</div>
                            <h2 className="section-title">Clarifying Questions</h2>
                        </div>
                        <div className="question-list">
                            {session.plan.questions.map((q, i) => (
                                <div key={i} className="question-item">
                                    <div className="question-number">{String(i + 1).padStart(2, '0')}</div>
                                    <p className="question-text">{q.text}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Recommended Resources */}
                {session.plan && session.plan.resources && session.plan.resources.length > 0 && (
                    <section className="session-section">
                        <div className="section-header">
                            <div className="section-icon">📚</div>
                            <h2 className="section-title">Recommended Resources</h2>
                        </div>
                        <div className="resource-list">
                            {session.plan.resources.map((resource, i) => (
                                <div key={i} className="resource-item">
                                    <a
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="resource-title"
                                    >
                                        {resource.title}
                                    </a>
                                    <a
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="resource-url"
                                    >
                                        {resource.url}
                                    </a>
                                    {resource.snippet && (
                                        <p className="resource-snippet">{resource.snippet}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Complete State */}
                {session.status === 'complete' && (
                    <section className="session-section complete">
                        <div className="section-header">
                            <div className="section-icon">✓</div>
                            <h2 className="section-title">Complete</h2>
                        </div>
                        <p className="completion-message">Fix plan has been generated successfully.</p>
                        <div className="completion-actions">
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    document.getElementById('fix-plan-section')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                            >
                                View Plan
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    const blob = new Blob([JSON.stringify(session.plan, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `fix-plan-${sessionId}.json`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                }}
                            >
                                Export JSON
                            </button>
                            {!session.fixes && (
                                <button
                                    className="btn btn-accent"
                                    onClick={handleGenerateFixes}
                                    disabled={isGeneratingFixes}
                                >
                                    {isGeneratingFixes ? '⏳ Generating Potential Fixes...' : '🔧 Generate Potential Fixes'}
                                </button>
                            )}
                        </div>
                    </section>
                )}

                {/* Sliding Fix Panel */}
                {session.fixes && session.fixes.length > 0 && (
                    <>
                        <FixPanelSlide
                            fixes={session.fixes}
                            isOpen={isPanelOpen}
                            onClose={() => {
                                console.log('Panel onClose called, setting isPanelOpen to false');
                                setIsPanelOpen(false);
                                setUserClosedPanel(true);
                            }}
                        />
                        {!isPanelOpen && (
                            <button
                                className="floating-view-fixes-btn"
                                onClick={() => {
                                    console.log('Opening panel, setting isPanelOpen to true');
                                    setIsPanelOpen(true);
                                    setUserClosedPanel(false);
                                }}
                                title="View potential fixes"
                            >
                                💡 View Fixes ({session.fixes.length})
                            </button>
                        )}
                    </>
                )}

                {/* PR Draft */}
                {session.prDraft && (
                    <PRDraftPanel prDraft={session.prDraft} issueUrl={session.issueUrl} />
                )}

                {/* Error State */}
                {session.status === 'error' && (
                    <section className="session-section error">
                        <div className="section-header">
                            <div className="section-icon">×</div>
                            <h2 className="section-title">Error</h2>
                        </div>
                        <p className="error-message">An error occurred during execution. Please check the logs.</p>
                    </section>
                )}
            </main>
        </div>
    );
}
