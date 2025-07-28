
import React from 'react';
import type { Tool } from '../../types';
import Icon from '../ui/Icon';
import { PROTECTED_TOOLS } from '../../constants';

interface ToolCardProps {
    tool: Tool;
    onDelete: () => void;
}

const LANGUAGE_STYLES: { [key: string]: string } = {
    javascript: 'bg-yellow-500/20 text-yellow-400',
    python: 'bg-blue-500/20 text-blue-400',
    powershell: 'bg-indigo-500/20 text-indigo-400',
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, onDelete }) => {
    const isProtected = PROTECTED_TOOLS.includes(tool.name);

    return (
        <div className="bg-surface p-4 rounded-lg border border-border-color flex flex-col justify-between h-56">
            <div className="flex-grow overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-text-primary pr-2 truncate">{tool.name}</h4>
                    {!isProtected && (
                        <button onClick={onDelete} className="p-1 text-text-secondary hover:text-red-500 transition-colors flex-shrink-0">
                           <Icon name="trash" className="w-4 h-4" />
                       </button>
                    )}
                </div>
                <pre className="text-xs text-text-secondary bg-surface-light p-3 rounded-md overflow-hidden h-24 whitespace-pre-wrap font-mono">
                    <code>{tool.content}</code>
                </pre>
            </div>
            <div className="mt-4 flex justify-end flex-shrink-0">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${LANGUAGE_STYLES[tool.language] || 'bg-gray-500/20 text-gray-400'}`}>
                    {tool.language.toUpperCase()}
                </span>
            </div>
        </div>
    );
}

export default ToolCard;