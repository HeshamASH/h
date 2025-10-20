import React from 'react';
import { Source } from '../types';

interface EditedFileRecord {
  file: Source;
  originalContent: string;
  currentContent: string;
}

interface DiffLine {
    type: 'add' | 'remove' | 'same';
    text: string;
}

const createDiff = (original: string, suggested: string): DiffLine[] => {
    if (original === suggested) {
        return [];
    }
    const originalLines = original.split('\n');
    const suggestedLines = suggested.split('\n');
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
    const fullDiff: DiffLine[] = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && originalLines[i - 1] === suggestedLines[j - 1]) {
            fullDiff.unshift({ type: 'same', text: `  ${originalLines[i - 1]}` });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            fullDiff.unshift({ type: 'add', text: `+ ${suggestedLines[j - 1]}` });
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            fullDiff.unshift({ type: 'remove', text: `- ${originalLines[i - 1]}` });
            i--;
        } else { break; }
    }
    return fullDiff;
};

interface DiffViewerModalProps {
  record: EditedFileRecord;
  onClose: () => void;
}

const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);


const DiffViewerModal: React.FC<DiffViewerModalProps> = ({ record, onClose }) => {
    const diff = createDiff(record.originalContent, record.currentContent);
    
    const getLineClass = (type: DiffLine['type']) => {
        switch (type) {
            case 'add': return 'bg-green-900/40 text-green-300';
            case 'remove': return 'bg-red-900/40 text-red-300';
            default: return 'text-slate-400';
        }
    };

    return (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-4 border-b border-slate-700/50 flex-shrink-0">
              <div>
                <h3 className="font-bold text-lg text-cyan-400">{record.file.fileName}</h3>
                <p className="text-sm text-slate-400 font-mono">{record.file.path}</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Close diff viewer">
                <CloseIcon />
              </button>
            </header>
            <main className="overflow-auto">
                <pre className="p-4 text-sm font-mono bg-slate-950 h-full">
                    <code>
                        {diff.length > 0 ? (
                            diff.map((line, index) => (
                                <div key={index} className={`whitespace-pre-wrap ${getLineClass(line.type)}`}>
                                    {line.text}
                                </div>
                            ))
                        ) : (
                           <div className="text-slate-500">No changes detected in this file.</div>
                        )}
                    </code>
                </pre>
            </main>
          </div>
        </div>
    );
};

export default DiffViewerModal;