import { useState } from 'react';
import './code-fix-card.css';

interface CodeFixCardProps {
    file: string;
    language: string;
    code: string;
}

export function CodeFixCard({ file, language, code }: CodeFixCardProps) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Extract file name from path
    const fileName = file.split('/').pop() || file;
    const filePath = file.includes('/') ? file.substring(0, file.lastIndexOf('/')) : '';

    return (
        <div className="code-fix-card">
            <div className="code-fix-header">
                <div className="file-info">
                    <span className="file-icon">📄</span>
                    <div className="file-details">
                        <span className="file-name">{fileName}</span>
                        {filePath && <span className="file-path">{filePath}/</span>}
                    </div>
                    <span className="language-badge">{language}</span>
                </div>
                <button
                    className={`copy-button ${copied ? 'copied' : ''}`}
                    onClick={copyToClipboard}
                    title="Copy to clipboard"
                >
                    {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
            </div>
            <div className="code-wrapper">
                <pre className="code-content">
                    <code className={`language-${language}`}>{code}</code>
                </pre>
            </div>
        </div>
    );
}
