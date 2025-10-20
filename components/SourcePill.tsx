import React from 'react';
import { Source } from '../types';

interface SourcePillProps {
  source: Source;
  onClick: () => void;
  isEdited?: boolean;
}

const FileIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h6.89a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061v5.758A1.5 1.5 0 0 1 12.5 13H3.5A1.5 1.5 0 0 1 2 11.5v-8Z" />
    </svg>
);

const EditIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.213.213-.46.394-.724.534l-2.651.982a.75.75 0 0 1-.925-.925l.982-2.651c.14-.264.321-.51.534-.724l8.61-8.61Zm.176 2.053-6.646 6.647-.328 1.12.328.328 1.12-.328 6.647-6.646-1.12-1.12Z" />
    </svg>
);


const SourcePill: React.FC<SourcePillProps> = ({ source, onClick, isEdited = false }) => {
  const baseClasses = "flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full cursor-pointer transition-colors duration-200";
  const colorClasses = isEdited 
    ? "bg-green-900/50 hover:bg-green-800/60 text-green-300" 
    : "bg-slate-700/50 hover:bg-slate-700 text-slate-300";

  return (
    <button 
      onClick={onClick}
      className={`${baseClasses} ${colorClasses}`}
      title={source.path}
    >
      {isEdited ? <EditIcon /> : <FileIcon />}
      <span>{source.fileName}</span>
    </button>
  );
};

export default SourcePill;