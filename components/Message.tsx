import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage, MessageRole, Source, ResponseType, ModelId, MODELS } from '../types';
import SourcePill from './SourcePill';
import CodeSuggestionViewer from './CodeSuggestionViewer';

declare var hljs: any;
declare var marked: any;

interface MessageProps {
  message: ChatMessage;
  onSelectSource: (source: Source) => void;
  onSuggestionAction: (action: 'accepted' | 'rejected') => void;
}

const UserIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
    </svg>
);

const ModelIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M9.315 7.585c.932-1.003 2.443-1.003 3.375 0l1.453 1.559c.466.502.706 1.168.706 1.846 0 .678-.24 1.344-.706 1.846l-1.453 1.559c-.932 1.003-2.443 1.003-3.375 0l-1.453-1.559a2.983 2.983 0 0 1-.706-1.846c0-.678.24-1.344.706-1.846l1.453-1.559Z" clipRule="evenodd" />
        <path d="M21.565 4.435a.75.75 0 0 0-1.06 0l-2.5 2.5a.75.75 0 0 0 1.06 1.06l2.5-2.5a.75.75 0 0 0 0-1.06Z" />
        <path d="M3.5 6.995a.75.75 0 0 1 1.06 0l2.5 2.5a.75.75 0 0 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1 0-1.06Z" />
        <path d="M17.005 20.5a.75.75 0 0 0 0-1.06l-2.5-2.5a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0Z" />
        <path d="M6.995 3.5a.75.75 0 0 0-1.06 0l-2.5 2.5a.75.75 0 0 0 1.06 1.06l2.5-2.5a.75.75 0 0 0 0-1.06Z" />
    </svg>
);

const ChevronDownIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
);

const ChevronUpIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M11.78 9.78a.75.75 0 0 1-1.06 0L8 7.06 5.28 9.78a.75.75 0 0 1-1.06-1.06l3.25-3.25a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
    </svg>
);


const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (contentRef.current && typeof marked !== 'undefined') {
        const rawHtml = marked.parse(text, { breaks: true, gfm: true });
        
        // Basic sanitization to prevent XSS. In a real app, use a more robust library like DOMPurify.
        const sanitizedHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        contentRef.current.innerHTML = sanitizedHtml;

        // After setting HTML, find and highlight code blocks
        contentRef.current.querySelectorAll('pre code').forEach((block) => {
            if (typeof hljs !== 'undefined') {
              hljs.highlightElement(block as HTMLElement);
            }
        });
    }
  }, [text]);

  return <div ref={contentRef} className="prose prose-sm prose-invert text-slate-300 max-w-none prose-pre:bg-slate-800 prose-pre:p-4 prose-code:text-cyan-400 prose-code:bg-slate-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:font-mono prose-code:text-sm" />;
};

const MessageMetadata: React.FC<{ responseType?: ResponseType, modelId?: ModelId }> = ({ responseType, modelId }) => {
    if (!responseType || !modelId) return null;

    const model = MODELS.find(m => m.id === modelId);
    if (!model) return null;

    return (
        <div className="text-xs text-gray-400 mb-1.5 flex items-center gap-2">
            <span>{responseType}</span>
            <span className="text-gray-500">•</span>
            <span>{model.name}</span>
        </div>
    );
};


const Message: React.FC<MessageProps> = ({ message, onSelectSource, onSuggestionAction }) => {
  const isModel = message.role === MessageRole.MODEL;
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);

  const sources = message.sources || [];
  const hasManySources = sources.length > 5;
  const sourcesToShow = (hasManySources && !isSourcesExpanded)
      ? sources.slice(0, 5)
      : sources;

  return (
    <div className={`flex items-start gap-4 ${!isModel && 'flex-row-reverse'}`}>
      <div className={`rounded-full p-2 flex-shrink-0 ${isModel ? 'bg-slate-700 text-cyan-400' : 'bg-slate-600 text-slate-300'}`}>
        {isModel ? <ModelIcon /> : <UserIcon />}
      </div>
      <div className={`max-w-2xl w-full flex flex-col ${!isModel && 'items-end'}`}>
        {isModel && <MessageMetadata responseType={message.responseType} modelId={message.modelId} />}
        <div className={`rounded-lg px-5 py-3 ${isModel ? 'bg-slate-800' : 'bg-cyan-600 text-white'}`}>
          <div className={isModel ? '' : 'prose prose-sm prose-invert text-white max-w-none'}>
             {message.content ? (
                isModel ? <MarkdownRenderer text={message.content} /> : message.content
             ) : (
                isModel && <span className="w-2.5 h-2.5 bg-slate-400 rounded-full inline-block animate-pulse"></span>
             )}
          </div>
        </div>
        {isModel && message.suggestion && (
            <div className="mt-3 w-full">
                <CodeSuggestionViewer 
                    suggestion={message.suggestion} 
                    onAction={onSuggestionAction}
                />
            </div>
        )}
        {isModel && message.editedFile && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 font-medium mr-2 self-center">Edited File:</span>
            <SourcePill 
              key={message.editedFile.id} 
              source={message.editedFile} 
              onClick={() => onSelectSource(message.editedFile)}
              isEdited={true} 
            />
          </div>
        )}
        {isModel && sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500 font-medium mr-2 self-center">Sources:</span>
            {sourcesToShow.map((source) => (
              <SourcePill key={source.id} source={source} onClick={() => onSelectSource(source)} />
            ))}
            {hasManySources && (
                <button 
                    onClick={() => setIsSourcesExpanded(prev => !prev)}
                    className="flex items-center gap-1 text-xs font-semibold text-cyan-500 hover:text-cyan-400 transition-colors"
                >
                    {isSourcesExpanded ? (
                        <>
                            <span>Show less</span>
                            <ChevronUpIcon />
                        </>
                    ) : (
                        <>
                            <span>... and {sources.length - 5} more</span>
                            <ChevronDownIcon />
                        </>
                    )}
                </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;