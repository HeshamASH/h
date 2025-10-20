import React from 'react';
import { ModelId, MODELS } from '../types';

const ModelIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M15.988 3.012A2.25 2.25 0 0 0 15 2.25H5A2.25 2.25 0 0 0 3 4.5v11A2.25 2.25 0 0 0 5 17.75h10a2.25 2.25 0 0 0 2.25-2.25V4.5a2.25 2.25 0 0 0-1.262-2.122l-.001-.001ZM10 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-2 1a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2 2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm2-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-4-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
    </svg>
);


interface ModelSwitcherProps {
    selectedModel: ModelId;
    onModelChange: (modelId: ModelId) => void;
    disabled?: boolean;
}

const ModelSwitcher: React.FC<ModelSwitcherProps> = ({ selectedModel, onModelChange, disabled }) => {
    return (
        <div className="relative">
            <select
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value as ModelId)}
                disabled={disabled}
                className="appearance-none bg-slate-700/80 border border-slate-600 rounded-md pl-8 pr-4 py-1.5 text-xs font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/80 disabled:opacity-50"
                aria-label="Select AI Model"
            >
                {MODELS.map(model => (
                    <option key={model.id} value={model.id}>
                        {model.name}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400">
                <ModelIcon />
            </div>
        </div>
    );
};

export default ModelSwitcher;