import { CodeFixCard } from './CodeFixCard';
import './fix-panel.css';

interface Fix {
    file: string;
    language: string;
    code: string;
}

interface FixPanelProps {
    fixes: Fix[];
}

export function FixPanel({ fixes }: FixPanelProps) {
    if (!fixes || fixes.length === 0) {
        return null;
    }

    return (
        <section className="fix-panel">
            <div className="section-header">
                <h2>🔧 Generated Fixes</h2>
                <span className="fix-count">{fixes.length} file{fixes.length !== 1 ? 's' : ''}</span>
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
        </section>
    );
}
