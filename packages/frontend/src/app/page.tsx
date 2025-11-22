'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './home.css';

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
    <div className="home-container">
      <main className="hero-section">
        <div className="hero-content">
          {/* Brand */}
          <div className="brand">
            <div className="brand-icon"></div>
            <h1 className="brand-title">Fix Together</h1>
          </div>

          {/* Tagline */}
          <p className="tagline">
            Collaborative AI-powered issue resolution. Analyze, plan, execute, and ship fixes with E2B Sandboxes and Google AI.
          </p>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="input-form">
            <div className="input-wrapper">
              <input
                type="text"
                className="input"
                placeholder="github.com/owner/repo/issues/123"
                value={issueUrl}
                onChange={(e) => setIssueUrl(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !issueUrl.trim()}
              >
                {loading ? (
                  <span className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                ) : (
                  <>
                    <span>Start</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Process Steps */}
          <div className="process-grid">
            {[
              {
                number: '01',
                title: 'Analyze',
                description: 'Repository structure, dependencies, and issue context',
                icon: '→'
              },
              {
                number: '02',
                title: 'Plan',
                description: 'AI generates fix strategy with your collaboration',
                icon: '⊕'
              },
              {
                number: '03',
                title: 'Execute',
                description: 'Apply changes step-by-step in isolated sandbox',
                icon: '⊞'
              },
              {
                number: '04',
                title: 'Ship',
                description: 'Create pull request or export patch file',
                icon: '↗'
              }
            ].map((step, index) => (
              <div key={index} className="process-step">
                <div className="step-number">{step.number}</div>
                <div className="step-icon">{step.icon}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="features-grid">
            {[
              { icon: '◻', title: 'Isolated Sandboxes', description: 'Safe execution' },
              { icon: '◉', title: 'AI-Powered', description: 'Gemini intelligence' },
              { icon: '◈', title: 'Real-time', description: 'Live progress' },
              { icon: '◇', title: 'Open Source', description: 'MIT License' }
            ].map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h4 className="feature-title">{feature.title}</h4>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>E2B Sandboxes × Google AI × MCP Servers</p>
        <p className="footer-secondary">Open Source</p>
      </footer>
    </div>
  );
}
