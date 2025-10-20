import React, { useRef, useEffect } from 'react';
import { Source, AppMode, FileViewType } from '../types';

declare var hljs: any;
declare var marked: any;

interface FileViewerProps {
  file: Source;
  content: string;
  onClose: () => void;
  mode: AppMode;
  viewType?: FileViewType | null;
}

const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const FileViewer: React.FC<FileViewerProps> = ({ file, content, onClose, mode, viewType }) => {
  const codeRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const parts = file.fileName.split('.');
  const language = parts.length > 1 ? parts.pop() || 'plaintext' : 'plaintext';
  
  const isCodeView = viewType === 'code' || (mode === AppMode.CODEBASE && !viewType);
  const isTextView = !isCodeView;

  useEffect(() => {
    if (isCodeView && codeRef.current && content !== 'Loading...' && typeof hljs !== 'undefined') {
      hljs.highlightElement(codeRef.current);
    }
    if (isTextView && textRef.current && content !== 'Loading...' && typeof marked !== 'undefined') {
        const rawHtml = marked.parse(content, { breaks: true, gfm: true });
        const sanitizedHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        textRef.current.innerHTML = sanitizedHtml;
        textRef.current.querySelectorAll('pre code').forEach((block) => {
            if (typeof hljs !== 'undefined') {
              hljs.highlightElement(block as HTMLElement);
            }
        });
    }
  }, [content, language, isCodeView, isTextView]);

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
            <h3 className="font-bold text-lg text-cyan-400">{file.fileName}</h3>
            <p className="text-sm text-slate-400 font-mono">{file.path}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Close file viewer">
            <CloseIcon />
          </button>
        </header>
        <main className="p-4 overflow-auto bg-slate-950">
          {isTextView ? (
             <div 
              className="bg-slate-900 rounded-md p-4"
            >
              <div
                ref={textRef}
                className="prose prose-sm prose-invert text-slate-300 max-w-none prose-pre:bg-slate-800 prose-pre:p-4 prose-code:text-cyan-400 prose-code:bg-slate-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:font-mono prose-code:text-sm"
              >
                 {content === 'Loading...' ? <span className="w-2.5 h-2.5 bg-slate-400 rounded-full inline-block animate-pulse"></span> : ''}
              </div>
            </div>
          ) : (
            <pre className="bg-slate-900 rounded-md">
              <code ref={codeRef} className={`text-sm font-mono whitespace-pre-wrap language-${language}`}>
                {content}
              </code>
            </pre>
          )}
        </main>
      </div>
    </div>
  );
};

export default FileViewer;