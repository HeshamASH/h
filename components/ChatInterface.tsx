import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Source, AppMode, ModelId } from '../types';
import Message from './Message';
import ModelSwitcher from './ModelSwitcher';

// --- Welcome Block Data ---

const promptsByMode = {
    [AppMode.CODEBASE]: [
        "How is user authentication handled?",
        "Add a logout function to auth.ts",
        "Where are session options configured?",
        "Refactor the UserSchema to include a 'lastLogin' date",
    ],
    [AppMode.RESEARCH]: [
        "Summarize the main contribution of the 'Attention Is All You Need' paper",
        "What is BERT and how does it differ from previous models?",
        "Compare the Transformer architecture to RNNs based on the context",
        "What are the key benefits of the Transformer model?",
    ],
    [AppMode.SUPPORT]: [
        "A user can't log in and says their reset link expired. What should I do?",
        "How do I handle a duplicate billing charge for a customer?",
        "What is the standard procedure for an invalid credentials error?",
        "Find the resolution for a billing discrepancy.",
    ],
    [AppMode.CUSTOM]: [
        "Summarize the main points of the uploaded documents.",
        "What are the key takeaways from the provided text?",
        "Based on the documents, what can you tell me about [topic]?",
        "Extract the most important entities or names mentioned.",
    ]
};

const titlesByMode = {
    [AppMode.CODEBASE]: "Welcome to Elastic CodeMind",
    [AppMode.RESEARCH]: "AI Research Assistant",
    [AppMode.SUPPORT]: "AI Support Assistant",
    [AppMode.CUSTOM]: "Chat With Your Documents"
};

const WelcomeBlock: React.FC<{
  mode: AppMode;
  onSendMessage: (query: string) => void;
  isCustomDatasetEmpty: boolean;
  onFileUpload: (fileList: FileList) => void;
}> = ({ mode, onSendMessage, isCustomDatasetEmpty, onFileUpload }) => {
    const examplePrompts = promptsByMode[mode];
    const title = titlesByMode[mode];
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (mode === AppMode.CUSTOM && isCustomDatasetEmpty) {
        return (
             <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                 <div className="max-w-xl">
                    <div className="mx-auto bg-gradient-to-r from-cyan-500 to-blue-500 p-3 rounded-xl inline-block mb-6">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                       </svg>
                    </div>
                    <h2 className="text-4xl font-bold text-gray-100 mb-2">Chat With Your Documents</h2>
                    <p className="text-lg text-gray-400 mb-8">
                       Upload your text files or a project folder to begin.
                    </p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-cyan-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-cyan-500 transition-colors duration-200"
                    >
                        Upload Files or Folder
                    </button>
                     <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files && onFileUpload(e.target.files)}
                        className="hidden"
                        multiple
                        {...{ webkitdirectory: "true", mozdirectory: "true" }}
                    />
                 </div>
             </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="max-w-3xl">
                <h2 className="text-4xl font-bold text-gray-100 mb-4">{title}</h2>
                <p className="text-lg text-gray-400 mb-10">
                    Select an example or type your question below to get started.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    {examplePrompts.map((prompt, index) => (
                        <button
                            key={index}
                            onClick={() => onSendMessage(prompt)}
                            className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 hover:bg-slate-700/80 hover:border-cyan-600 transition-all duration-200 cursor-pointer text-gray-300"
                        >
                            <p className="font-semibold">{prompt}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};


// --- Main Chat Interface ---

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (query: string) => void;
  onSelectSource: (source: Source) => void;
  mode: AppMode;
  isCustomDatasetEmpty: boolean;
  onFileUpload: (fileList: FileList) => void;
  onSuggestionAction: (messageIndex: number, action: 'accepted' | 'rejected') => void;
  selectedModel: ModelId;
  onModelChange: (modelId: ModelId) => void;
}

const SendIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
    </svg>
);

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, onSendMessage, onSelectSource, mode, isCustomDatasetEmpty, onFileUpload, onSuggestionAction, selectedModel, onModelChange }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
            <WelcomeBlock 
              mode={mode} 
              onSendMessage={onSendMessage} 
              isCustomDatasetEmpty={isCustomDatasetEmpty}
              onFileUpload={onFileUpload}
            />
        ) : (
          <div className="space-y-6">
            {messages.map((msg, index) => (
              <Message key={index} message={msg} onSelectSource={onSelectSource} onSuggestionAction={(action) => onSuggestionAction(index, action)} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-6 py-4 border-t border-slate-700/50 bg-slate-900">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-4 pr-32 py-3 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition duration-200"
              disabled={isLoading || (mode === AppMode.CUSTOM && isCustomDatasetEmpty)}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <ModelSwitcher
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || (mode === AppMode.CUSTOM && isCustomDatasetEmpty)}
                className="bg-cyan-600 text-white rounded-lg p-2 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 transition-colors duration-200"
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;