import React from 'react';
import { Source } from '../types';

interface EditedFileRecord {
  file: Source;
  originalContent: string;
  currentContent: string;
}

interface EditedFilesViewerProps {
  editedFiles: EditedFileRecord[];
  onClose: () => void;
  onSelectFile: (record: EditedFileRecord) => void;
}

const FileIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-slate-400">
        <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h6.89a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061v5.758A1.5 1.5 0 0 1 12.5 13H3.5A1.5 1.5 0 0 1 2 11.5v-8Z" />
    </svg>
);

const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const EditedFilesViewer: React.FC<EditedFilesViewerProps> = ({ editedFiles, onClose, onSelectFile }) => {
    return (
        <aside className="bg-slate-950/70 backdrop-blur-sm border-l border-slate-700/50 flex flex-col h-full w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-200">Edited Files</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Close edited files viewer">
                    <CloseIcon />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
                {editedFiles.length > 0 ? (
                    <ul className="space-y-1">
                        {editedFiles.map((record) => (
                            <li key={record.file.id}>
                                <button onClick={() => onSelectFile(record)} className="w-full text-left p-2.5 rounded-md hover:bg-slate-800 cursor-pointer transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <FileIcon />
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-medium text-slate-200 truncate group-hover:text-cyan-400">{record.file.fileName}</p>
                                            <p className="text-xs text-slate-400 truncate">{record.file.path}</p>
                                        </div>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-slate-500 pt-8">No files have been edited in this session yet.</p>
                )}
            </div>
        </aside>
    );
};

export default EditedFilesViewer;