export interface SandboxConfig {
    apiKey: string;
    timeout?: number;
}

export interface RepositoryInfo {
    url: string;
    owner: string;
    repo: string;
    branch?: string;
}

export interface TestResult {
    success: boolean;
    output: string;
    failedTests?: string[];
    duration: number;
}

export interface CommandResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
}

export interface ArchitectureDiagram {
    type: 'mermaid' | 'ascii';
    content: string;
}

export interface FileResponsibility {
    path: string;
    purpose: string;
    dependencies: string[];
    exports: string[];
}

export interface CallGraphNode {
    name: string;
    file: string;
    callers: string[];
    callees: string[];
}

export interface SystemOverview {
    architecture: ArchitectureDiagram;
    keyFiles: FileResponsibility[];
    callGraph: CallGraphNode[];
    testResults: TestResult;
    summary: string;
}

export interface Question {
    id: string;
    text: string;
    type: 'text' | 'choice' | 'confirm';
    options?: string[];
    context?: string;
}

export interface Resource {
    title: string;
    url: string;
    type: 'documentation' | 'issue' | 'stackoverflow' | 'blog' | 'api-reference';
    relevance: number;
    snippet?: string;
}

export interface Suggestion {
    text: string;
    category: 'best-practice' | 'alternative' | 'testing' | 'performance';
    priority: 'high' | 'medium' | 'low';
}

export interface FixStep {
    id: string;
    description: string;
    reasoning: string;
    files: string[];
    codePreview?: string;
    estimatedImpact: 'low' | 'medium' | 'high';
}

export interface FixPlan {
    id: string;
    steps: FixStep[];
    questions: Question[];
    resources: Resource[];
    suggestions: Suggestion[];
    version: number;
}

export interface CodeChange {
    file: string;
    diff: string;
    before: string;
    after: string;
}

export interface ValidationResult {
    tests: TestResult;
    lint?: CommandResult;
    typeCheck?: CommandResult;
    passed: boolean;
}

export interface ExecutionStep {
    stepId: string;
    change: CodeChange;
    validation: ValidationResult;
    approved: boolean;
}
