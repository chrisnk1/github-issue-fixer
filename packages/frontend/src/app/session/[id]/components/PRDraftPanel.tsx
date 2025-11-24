import './pr-draft-panel.css';

interface PRDraft {
    title: string;
    body: string;
}

interface PRDraftPanelProps {
    prDraft: PRDraft;
    issueUrl: string;
}

export function PRDraftPanel({ prDraft, issueUrl }: PRDraftPanelProps) {
    if (!prDraft) {
        return null;
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const copyFullPR = () => {
        const fullPR = `# ${prDraft.title}\n\n${prDraft.body}`;
        navigator.clipboard.writeText(fullPR);
    };

    return (
        <section className="pr-draft-panel">
            <div className="section-header">
                <h2>📝 Pull Request Draft</h2>
                <button
                    className="copy-button"
                    onClick={copyFullPR}
                    title="Copy full PR"
                >
                    📋 Copy PR
                </button>
            </div>

            <div className="pr-content">
                <div className="pr-title-section">
                    <label>Title</label>
                    <div className="pr-title">
                        <span>{prDraft.title}</span>
                        <button
                            className="copy-icon-button"
                            onClick={() => copyToClipboard(prDraft.title)}
                            title="Copy title"
                        >
                            📋
                        </button>
                    </div>
                </div>

                <div className="pr-body-section">
                    <label>Description</label>
                    <div className="pr-body">
                        <pre>{prDraft.body}</pre>
                        <button
                            className="copy-icon-button"
                            onClick={() => copyToClipboard(prDraft.body)}
                            title="Copy description"
                        >
                            📋
                        </button>
                    </div>
                </div>

                <div className="pr-actions">
                    <a
                        href={issueUrl.replace('/issues/', '/compare')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="create-pr-button"
                    >
                        🚀 Create Pull Request on GitHub
                    </a>
                </div>
            </div>
        </section>
    );
}
