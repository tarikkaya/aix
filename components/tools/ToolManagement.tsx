
import React, { useState } from 'react';
import type { Room, Tool } from '../../types';
import Icon from '../ui/Icon';
import ToolCard from './ToolCard';
import AddScriptModal from './AddScriptModal';

interface ToolManagementProps {
    activeRoom: Room;
    tools: Tool[];
    onAddTool: (tool: Omit<Tool, 'id'>) => void;
    onDeleteTool: (toolId: string) => void;
}

const ToolManagement: React.FC<ToolManagementProps> = ({ activeRoom, tools, onAddTool, onDeleteTool }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="p-4 w-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-text-primary">{activeRoom.name}</h3>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center space-x-2 bg-primary text-white px-3 py-1.5 text-sm font-semibold rounded-lg hover:bg-primary/80 transition-colors"
                >
                    <Icon name="plus" className="w-4 h-4" />
                    <span>Add Script</span>
                </button>
            </div>
            <p className="text-text-secondary mb-6">A central repository for scripts that can be assigned to any unit in the coalition.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tools.map(tool => (
                    <ToolCard key={tool.id} tool={tool} onDelete={() => onDeleteTool(tool.id)} />
                ))}
                {tools.length === 0 && (
                    <div className="col-span-full text-center py-16 text-text-secondary">
                        <Icon name="trash" className="w-12 h-12 mx-auto mb-4" />
                        <h4 className="text-lg font-semibold">No Scripts Found</h4>
                        <p>Add a new script to make it available to your units.</p>
                    </div>
                )}
            </div>
            <AddScriptModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={onAddTool}
            />
        </div>
    );
};
export default ToolManagement;