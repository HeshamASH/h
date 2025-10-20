

import React, { useRef } from 'react';
import { AppMode } from '../types';

const NewChatIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const SearchIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
);

const UploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
);

const EditIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
);


interface HeaderProps {
    mode: AppMode;
    onModeChange: (mode: AppMode) => void;
    onNewChat: () => void;
    onToggleFileSearch: () => void;
    onFilesUploaded: (fileList: FileList) => void;
    onToggleEditedFiles: () => void;
}

const Header: React.FC<HeaderProps> = ({ mode, onModeChange, onNewChat, onToggleFileSearch, onFilesUploaded, onToggleEditedFiles }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      onFilesUploaded(event.target.files);
      // Reset input value to allow re-uploading the same files
      event.target.value = '';
    }
  };

  return (
    <header className="px-6 py-4 border-b border-slate-700/50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Elastic CodeMind</h1>
          <p className="text-sm text-gray-400">AI-Powered RAG with Gemini & Elastic</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
         <select 
            value={mode} 
            onChange={(e) => onModeChange(e.target.value as AppMode)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm font-semibold focus:ring-2 focus:ring-cyan-500 focus:outline-none transition duration-200 appearance-none"
            aria-label="Select application mode"
          >
            {/* FIX: Use Object.entries for type-safe iteration over the enum */}
            {Object.entries(AppMode).map(([key, value]) => <option key={key} value={value}>{value}</option>)}
         </select>
         <button 
            onClick={onToggleFileSearch}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg border border-slate-700 transition-colors duration-200"
            aria-label="Search files"
        >
            <SearchIcon />
            <span className="hidden sm:inline">Search</span>
        </button>
        <button 
            onClick={handleUploadClick}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg border border-slate-700 transition-colors duration-200"
            aria-label="Upload files"
        >
            <UploadIcon />
            <span className="hidden sm:inline">Upload</span>
        </button>
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            {...{ webkitdirectory: "true", mozdirectory: "true" }}
        />
         <button 
            onClick={onToggleEditedFiles}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg border border-slate-700 transition-colors duration-200"
            aria-label="View edited files"
        >
            <EditIcon />
            <span className="hidden sm:inline">Edits</span>
        </button>
        <button 
            onClick={onNewChat}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg border border-slate-700 transition-colors duration-200"
            aria-label="New chat"
        >
            <NewChatIcon />
            <span className="hidden sm:inline">New Chat</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
