import { useEffect, useState } from 'react';
import { CodeFixCard } from './CodeFixCard';
import './fix-panel-slide.css';

interface Fix {
    file: string;
    language: string;
    code: string;
}

interface FixPanelSlideProps {
    fixes: Fix[];
    isOpen: boolean;
    onClose: () => void;
}

export function FixPanelSlide({ fixes, isOpen, onClose }: FixPanelSlideProps) {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
        }
    }, [isOpen]);

    if (!fixes || fixes.length === 0) {
        return null;
    }

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('Close button clicked');
        onClose();
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('Overlay clicked');
        onClose();
    };

    return (
        <>
            {/* Overlay */}
            <div
                className={`panel-overlay ${isOpen ? 'active' : ''}`}
                onClick={handleOverlayClick}
            />

            {/* Sliding Panel */}
            <aside className={`fix-panel-slide ${isOpen ? 'open' : ''} ${isAnimating ? 'animating' : ''}`}>
                <div className="panel-header">
                    <div className="panel-title-section">
                        <h2>💡 Potential Fixes & Guidance</h2>
                        <span className="fix-count">{fixes.length} file{fixes.length !== 1 ? 's' : ''}</span>
                    </div>
                    <button
                        className="close-button"
                        onClick={handleClose}
                        aria-label="Close panel"
                        type="button"
                    >
                        ✕
                    </button>
                </div>

                <div className="panel-content">
                    <div className="guidance-intro">
                        <p>
                            These are AI-generated potential solutions to help you understand and fix the issue.
                            Review the explanations, consider the trade-offs, and adapt the code to your specific needs.
                        </p>
                    </div>

                    <div className="fixes-container">
                        {fixes.map((fix, index) => (
                            <CodeFixCard
                                key={`${fix.file}-${index}`}
                                file={fix.file}
                                language={fix.language}
                                code={fix.code}
                            />
                        ))}
                    </div>
                </div>
            </aside>
        </>
    );
}
