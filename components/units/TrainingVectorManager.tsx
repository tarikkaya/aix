
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { TrainingSource } from '../../types';
import Icon from '../ui/Icon';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set worker path for pdf.js to use the local, version-matched worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface TrainingVectorManagerProps {
    sources: TrainingSource[];
    onUpdateSources: (sources: TrainingSource[]) => void;
}

const TrainingVectorManager: React.FC<TrainingVectorManagerProps> = ({ sources, onUpdateSources }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const updateSource = useCallback((sourceId: string, updates: Partial<Omit<TrainingSource, 'id'>>) => {
        onUpdateSources(
            sources.map(s => s.id === sourceId ? { ...s, ...updates } : s)
        );
    }, [sources, onUpdateSources]);
    
    const chunkText = (text: string, chunkSize: number, overlap: number): string[] => {
        const chunks: string[] = [];
        if (!text) return chunks;

        let i = 0;
        while (i < text.length) {
            const end = i + chunkSize;
            chunks.push(text.slice(i, end));
            i += chunkSize - overlap;
            // Prevent infinite loops for small overlaps
            if (i < 0 || (chunkSize - overlap) <= 0) {
                 i = end;
            }
        }
        return chunks;
    };
    
    const processFile = useCallback(async (sourceId: string, file: File) => {
        try {
            updateSource(sourceId, { status: 'Parsing' });
            await new Promise(res => setTimeout(res, 100)); // Short delay for UI update
            
            let text = '';
            if (file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                let textContent = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textData = await page.getTextContent();
                    textContent += textData.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n';
                }
                text = textContent;
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                text = result.value;
            } else if (file.type === 'text/plain' || file.type.endsWith('csv') || file.type.endsWith('markdown')) {
                text = await file.text();
            } else {
                throw new Error(`Unsupported file type: ${file.type || 'unknown'}`);
            }

            updateSource(sourceId, { status: 'Chunking' });
            await new Promise(res => setTimeout(res, 100));
            
            // For CSVs, treat each line as a document to be chunked.
            const documentsToChunk = file.type.endsWith('csv') ? text.split(/\r?\n/).filter(row => row.trim() !== '') : [text];
            let allChunks: string[] = [];
            
            for(const doc of documentsToChunk) {
                // Use smaller chunks for structured data like CSV rows
                const chunks = chunkText(doc, file.type.endsWith('csv') ? 256 : 512, file.type.endsWith('csv') ? 30 : 50);
                allChunks.push(...chunks);
            }

            updateSource(sourceId, { status: 'Embedding' });
            await new Promise(res => setTimeout(res, 500 + Math.random() * 1000));

            updateSource(sourceId, { status: 'Completed', neuronCount: allChunks.length });

        } catch (error) {
            console.error("Error processing file:", error);
            const message = error instanceof Error ? error.message : 'An unknown error occurred';
            updateSource(sourceId, { status: 'Error', message });
        }
    }, [updateSource]);

    const handleFileSelection = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newSources: TrainingSource[] = Array.from(files).map(file => ({
            id: `ts-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: file.name,
            size: file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : `${(file.size / 1024).toFixed(2)} KB`,
            status: 'Queued',
            neuronCount: 0,
        }));
        
        onUpdateSources([...sources, ...newSources]);

        // Trigger processing after state has updated
        newSources.forEach((source, index) => {
            processFile(source.id, files[index]);
        });
    }, [sources, onUpdateSources, processFile]);

    const handleDragEvents = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    };
    
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };

    const removeSource = (id: string) => {
        onUpdateSources(sources.filter(s => s.id !== id));
    };
    
    const getStatusIcon = (status: TrainingSource['status']) => {
        switch(status) {
            case 'Parsing':
            case 'Chunking':
            case 'Embedding':
                return <Icon name="spinner" className="w-4 h-4 text-yellow-400" />;
            case 'Completed':
                return <Icon name="check-mark" className="w-4 h-4 text-green-400" />;
            case 'Error':
                return <Icon name="x-mark" className="w-4 h-4 text-red-400" />;
            default: // Queued
                return <Icon name="clock" className="w-4 h-4 text-text-secondary" />;
        }
    }

    return (
        <div className="space-y-4 pt-4 border-t border-border-color">
            <h4 className="font-semibold text-text-primary">Training Data Sources</h4>
             <div 
                onDragEnter={handleDragEvents} 
                onDragLeave={handleDragEvents} 
                onDragOver={handleDragEvents} 
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border-color hover:border-primary/50'}`}
            >
                <input ref={fileInputRef} type="file" multiple onChange={e => handleFileSelection(e.target.files)} className="hidden" accept=".pdf,.docx,.txt,.csv,.md"/>
                <Icon name="upload" className="w-8 h-8 mx-auto text-text-secondary mb-2" />
                <p className="text-text-primary font-semibold">Drop files here or click to browse</p>
                <p className="text-xs text-text-secondary">Supported: PDF, DOCX, TXT, CSV, MD</p>
            </div>
            
            <div className="space-y-2">
                {sources.length === 0 && <p className="text-sm text-center text-text-secondary py-4">No data sources added.</p>}
                {sources.map(source => (
                    <div key={source.id} className="grid grid-cols-[auto,1fr,auto,auto] gap-x-3 items-center text-sm p-2 rounded-md bg-surface-light" title={source.message}>
                        <div className="flex-shrink-0">{getStatusIcon(source.status)}</div>
                        <div className='overflow-hidden'>
                           <p className="truncate font-medium">{source.name}</p>
                           <p className="text-xs text-text-secondary">{source.size} - {source.status}</p>
                        </div>
                        <span className="text-text-primary font-mono font-semibold justify-self-end pr-2">{source.status === 'Completed' ? source.neuronCount.toLocaleString() : '-'}</span>
                        <button onClick={() => removeSource(source.id)} className="p-1 text-text-secondary hover:text-red-500"><Icon name="trash" className="w-4 h-4"/></button>
                    </div>
                ))}
            </div>
        </div>
    )
};

export default TrainingVectorManager;
