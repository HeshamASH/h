import React from 'react';
import { CodeSuggestion } from '../types';

interface DiffLine {
    type: 'add' | 'remove' | 'same';
    text: string;
}

// A more robust line-by-line diffing utility based on Longest Common Subsequence,
// with improved logic for showing context around changes.
const createDiff = (original: string, suggested: string): DiffLine[] => {
    if (original === suggested) {
        return [];
    }

    const originalLines = original.split('\n');
    const suggestedLines = suggested.split('\n');
    
    // 1. Create the full diff using LCS algorithm
    const fullDiff: DiffLine[] = [];
    const dp = Array(originalLines.length + 1).fill(null).map(() => Array(suggestedLines.length + 1).fill(0));

    for (let i = 1; i <= originalLines.length; i++) {
        for (let j = 1; j <= suggestedLines.length; j++) {
            if (originalLines[i - 1] === suggestedLines[j - 1]) {
                dp[i][j] = 1 + dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    let i = originalLines.length;
    let j = suggestedLines.length;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && originalLines[i - 1] === suggestedLines[j - 1]) {
            fullDiff.unshift({ type: 'same', text: `  ${originalLines[i - 1]}` });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            fullDiff.unshift({ type: 'add', text: `+ ${suggestedLines[j - 1]}` });
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            fullDiff.unshift({ type: 'remove', text: `- ${originalLines[i - 1]}` });
            i--;
        } else {
            break;
        }
    }
    
    // 2. Filter to show only changes plus some context
    const diffWithContext: DiffLine[] = [];
    const contextLines = 3;

    const changeIndices = new Set<number>();
    fullDiff.forEach((line, index) => {
        if (line.type !== 'same') {
            changeIndices.add(index);
        }
    });

    if (changeIndices.size === 0) {
      return fullDiff;
    }

    let lastAddedIndex = -1;
    fullDiff.forEach((line, index) => {
        let shouldAdd = false;
        // Check if the line itself is a change or is within the context window of any change
        if (changeIndices.has(index)) {
            shouldAdd = true;
        } else {
            for (const changeIndex of changeIndices) {
                if (Math.abs(index - changeIndex) <= contextLines) {
                    shouldAdd = true;
                    break;
                }
            }
        }
        
        if (shouldAdd) {
            // Add an ellipsis if there's a gap between this chunk and the last one
            if (lastAddedIndex !== -1 && index > lastAddedIndex + 1) {
                diffWithContext.push({ type: 'same', text: '...' });
            }
            diffWithContext.push(line);
            lastAddedIndex = index;
        }
    });
    
    return diffWithContext;
};


const CheckIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
    </svg>
);

const XMarkIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
);


interface CodeSuggestionViewerProps {
    suggestion: CodeSuggestion;
    onAction: (action: 'accepted' | 'rejected') => void;
}

const CodeSuggestionViewer: React.FC<CodeSuggestionViewerProps> = ({ suggestion, onAction }) => {
    const diff = createDiff(suggestion.originalContent, suggestion.suggestedContent);

    const getLineClass = (type: DiffLine['type']) => {
        switch (type) {
            case 'add': return 'bg-green-900/40 text-green-300';
            case 'remove': return 'bg-red-900/40 text-red-300';
            default: return 'text-slate-400 opacity-70';
        }
    };
    
    const getStatusChip = () => {
        if (suggestion.status === 'accepted') {
            return (
                <div className="flex items-center gap-1 text-sm font-semibold text-green-400 bg-green-900/50 px-3 py-1 rounded-full">
                    <CheckIcon /> Accepted
                </div>
            )
        }
        if (suggestion.status === 'rejected') {
            return (
                 <div className="flex items-center gap-1 text-sm font-semibold text-red-400 bg-red-900/50 px-3 py-1 rounded-full">
                    <XMarkIcon /> Rejected
                </div>
            )
        }
        return null;
    }

    return (
        <div className="border border-slate-700/80 rounded-lg bg-slate-800/50 w-full overflow-hidden">
            <header className="px-4 py-3 border-b border-slate-700/80 flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-slate-200">Edit Suggestion</h4>
                  <p className="text-sm text-slate-400 italic">"{suggestion.thought}"</p>
                </div>
                {suggestion.status !== 'pending' && getStatusChip()}
            </header>
            <main>
                <pre className="p-4 overflow-x-auto text-sm font-mono max-h-80 bg-slate-950">
                    <code>
                        {diff.length > 0 ? (
                            diff.map((line, index) => (
                                <div key={index} className={`whitespace-pre ${getLineClass(line.type)}`}>
                                    {line.text}
                                </div>
                            ))
                        ) : (
                           <div className="text-slate-500">The model suggested no changes.</div>
                        )}
                    </code>
                </pre>
            </main>
            {suggestion.status === 'pending' && (
                <footer className="p-3 border-t border-slate-700/80 bg-slate-900/30 flex items-center justify-end gap-3">
                    <button 
                        onClick={() => onAction('rejected')}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
                    >
                       <XMarkIcon /> Reject
                    </button>
                    <button 
                        onClick={() => onAction('accepted')}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 rounded-md transition-colors"
                    >
                        <CheckIcon /> Accept
                    </button>
                </footer>
            )}
        </div>
    );
};

export default CodeSuggestionViewer;