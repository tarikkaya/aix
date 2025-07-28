import React, { useState, useRef } from 'react';
import type { Tool } from '../../types';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';

interface AddScriptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (tool: Omit<Tool, 'id'>) => void;
}

const AddScriptModal: React.FC<AddScriptModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [name, setName] = useState('');
    const [language, setLanguage] = useState<'javascript' | 'python' | 'powershell'>('javascript');
    const [content, setContent] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            setContent(e.target?.result as string);
        };
        reader.readAsText(file);

        if (!name) {
            setName(file.name);
        }
    };

    const handleAddScript = () => {
        if (!name.trim() || !content.trim()) {
            alert('Please provide a name and content for the script.');
            return;
        }
        onAdd({ name, language, content });
        setName('');
        setLanguage('javascript');
        setContent('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Script">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Script Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Get Current Time" className="w-full p-2 bg-surface border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Language</label>
                    <select value={language} onChange={e => setLanguage(e.target.value as any)} className="w-full p-2 bg-surface border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="powershell">PowerShell</option>
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Script Content</label>
                    <div className="flex items-center justify-end mb-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".js,.py,.ps1,.txt" className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2 text-xs text-primary font-medium hover:text-primary/80">
                           <Icon name="upload" className="w-4 h-4" />
                           <span>Upload from file</span>
                        </button>
                    </div>
                    <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="function hello() { console.log('world'); }" className="w-full p-2 bg-surface border border-border-color rounded-md h-40 focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm" />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md bg-surface hover:bg-surface-light transition-colors">Cancel</button>
                    <button onClick={handleAddScript} className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/80 transition-colors">Add Script</button>
                </div>
            </div>
        </Modal>
    );
};

export default AddScriptModal;
