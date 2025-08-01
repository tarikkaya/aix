
import React, { useState, useEffect, useRef } from 'react';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import { LLM_PROVIDERS, RERANKER_PROVIDERS, VECTOR_PROVIDERS } from '../../constants';
import type { RAGBase, DataConnector, Provider } from '../../types';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set worker path for pdf.js to use the local, version-matched worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface DocumentState {
    id: string;
    file: File;
    name: string;
    size: string;
    status: 'Queued' | 'Parsing' | 'Indexing' | 'Indexed' | 'Error';
    message?: string;
}

const ProviderConfigInput: React.FC<{
    provider?: Provider;
    value?: string;
    placeholder: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ provider, value, placeholder, onChange }) => {
    if (!provider) return null;
    return (
        <div className="mt-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">
                {provider.type === 'cloud' ? 'API Key' : 'Path / URL'}
            </label>
            <input
                type="text"
                value={value || ''}
                placeholder={placeholder}
                onChange={onChange}
                className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
        </div>
    );
};

const FILE_BASED_VECTOR_PROVIDERS = ['lancedb', 'chromadb', 'faiss'];

const RAGBaseManager: React.FC<{ base: RAGBase; onUpdate: (base: RAGBase) => void }> = ({ base, onUpdate }) => {
    const [documents, setDocuments] = useState<DocumentState[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [lmStudioModels, setLmStudioModels] = useState<{ id: string; name: string; }[]>([]);
    const [isLoadingLmStudioModels, setIsLoadingLmStudioModels] = useState(false);
    const [lmStudioModelError, setLmStudioModelError] = useState<string | null>(null);

    useEffect(() => {
        if (base.embedding.provider !== 'lmstudio' || !base.embedding.path) {
            setLmStudioModels([]);
            setLmStudioModelError(null);
            return;
        }

        const controller = new AbortController();
        const signal = controller.signal;

        const fetchModels = async () => {
            setIsLoadingLmStudioModels(true);
            setLmStudioModelError(null);
            setLmStudioModels([]);

            try {
                let path = base.embedding.path;
                if (!path) throw new Error("Path is not defined.");
                if (!path.startsWith('http://') && !path.startsWith('https://')) path = 'http://' + path;
                
                const url = new URL(`${path}/v1/models`);
                const response = await fetch(url.toString(), { signal });
                
                if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
                const data = await response.json();
                if (!data.data || !Array.isArray(data.data)) throw new Error('Invalid response format from LM Studio server.');

                const models = data.data.map((model: any) => ({ id: model.id, name: model.id }));
                setLmStudioModels(models);

                if (models.length > 0 && !models.find(m => m.id === base.embedding.model)) {
                    handleEmbeddingModelChange(models[0].id);
                } else if (models.length === 0 && base.embedding.model) {
                     handleEmbeddingModelChange('');
                }
            } catch (error) {
                if (error instanceof Error && error.name !== 'AbortError') {
                    setLmStudioModelError('Failed to fetch models. Check URL and server status.');
                }
            } finally {
                setIsLoadingLmStudioModels(false);
            }
        };

        const debounceTimeout = setTimeout(fetchModels, 500);
        return () => { clearTimeout(debounceTimeout); controller.abort(); };
    }, [base.embedding.provider, base.embedding.path]);

    const handleEmbeddingProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProviderId = e.target.value;
        const provider = LLM_PROVIDERS.find(p => p.id === newProviderId);
        const defaultModel = provider?.embeddingModels?.[0]?.id || '';
        onUpdate({ ...base, embedding: { provider: newProviderId, model: defaultModel, apiKey: '', path: '' } });
    };
    
    const handleEmbeddingModelChange = (newModelId: string) => {
        onUpdate({ ...base, embedding: { ...base.embedding, model: newModelId } });
    };
    
    const handleEmbeddingConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const provider = LLM_PROVIDERS.find(p => p.id === base.embedding.provider);
        if (!provider) return;
        const key = provider.type === 'cloud' ? 'apiKey' : 'path';
        onUpdate({ ...base, embedding: { ...base.embedding, [key]: value } });
    };

    const handleVectorStoreProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProviderId = e.target.value;
        const provider = VECTOR_PROVIDERS.find(p => p.id === newProviderId);
        let newPath = '';
        if (provider?.type === 'local' && FILE_BASED_VECTOR_PROVIDERS.includes(newProviderId)) {
            newPath = `./aix_data/rag_bases/${base.id}/vector_store.${newProviderId}`;
        }
        onUpdate({ ...base, vectorStore: { provider: newProviderId, path: newPath, apiKey: '' } });
    };
    
    const handleVectorStoreConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const provider = VECTOR_PROVIDERS.find(p => p.id === base.vectorStore.provider);
        if (!provider) return;
        const key = provider.type === 'cloud' ? 'apiKey' : 'path';
        onUpdate({ ...base, vectorStore: { ...base.vectorStore, [key]: value } });
    };


    const handleChunkingChange = (key: 'chunkSize' | 'overlap', value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) onUpdate({ ...base, chunking: { ...base.chunking, [key]: numValue } });
    };
    
    const handleRetrievalChange = (key: 'topK', value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) onUpdate({ ...base, retrieval: { ...base.retrieval, [key]: numValue } });
    };

    const handleRerankerEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isEnabled = e.target.checked;
        const newRerankerConfig: RAGBase['reranker'] = { ...base.reranker, enabled: isEnabled };
        if (!isEnabled) {
            delete newRerankerConfig.provider;
            delete newRerankerConfig.apiKey;
            delete newRerankerConfig.path;
        } else if (!newRerankerConfig.provider) {
            const defaultProvider = RERANKER_PROVIDERS[0]; // Defaults to 'embedded-rerank'
            newRerankerConfig.provider = defaultProvider.id;
            newRerankerConfig.model = defaultProvider.models?.[0]?.id || '';
        }
        onUpdate({ ...base, reranker: newRerankerConfig });
    };
    
    const handleRerankerProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProviderId = e.target.value;
        const provider = RERANKER_PROVIDERS.find(p => p.id === newProviderId);
        const defaultModel = provider?.models?.[0]?.id || '';
        
        const newConfig: RAGBase['reranker'] = {
            enabled: true,
            provider: newProviderId,
            model: defaultModel,
            apiKey: '',
            path: ''
        };

        if (provider?.id === 'local-rerank-server') {
            newConfig.path = 'http://localhost:8001/rerank';
        }

        onUpdate({ ...base, reranker: newConfig });
    };
    
    const handleRerankerConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const provider = RERANKER_PROVIDERS.find(p => p.id === base.reranker.provider);
        if (!provider) return;
        
        const key = provider.type === 'cloud' ? 'apiKey' : 'path';
        onUpdate({ ...base, reranker: { ...base.reranker, [key]: value } });
    };

    const handleAddConnector = (type: 'notion' | 'github') => {
        const newConnector: DataConnector = { id: `conn-${Date.now()}`, type, name: type === 'notion' ? 'My Notion Workspace' : 'My GitHub Repo', connected: true };
        onUpdate({ ...base, dataConnectors: [...(base.dataConnectors || []), newConnector] });
    };

    const handleRemoveConnector = (id: string) => {
        onUpdate({ ...base, dataConnectors: (base.dataConnectors || []).filter(c => c.id !== id) });
    };

    const parsePdf = async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let textContent = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            textContent += text.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n';
        }
        return textContent;
    };

    const parseDocx = async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer });
        return value;
    };

    const parseTxt = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    };

    const processFile = async (docId: string, file: File) => {
        try {
            setDocuments(docs => docs.map(d => d.id === docId ? { ...d, status: 'Parsing' } : d));
            let text = '';
            if (file.type === 'application/pdf') {
                text = await parsePdf(file);
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                text = await parseDocx(file);
            } else if (file.type === 'text/plain' || file.type.endsWith('markdown')) {
                text = await parseTxt(file);
            } else {
                throw new Error('Unsupported file type');
            }

            setDocuments(docs => docs.map(d => d.id === docId ? { ...d, status: 'Indexing' } : d));
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));
            console.log(`Indexed ${file.name}:`, text.substring(0, 200) + '...');
            setDocuments(docs => docs.map(d => d.id === docId ? { ...d, status: 'Indexed' } : d));
        } catch (error) {
            console.error("Error processing file:", error);
            setDocuments(docs => docs.map(d => d.id === docId ? { ...d, status: 'Error', message: (error as Error).message } : d));
        }
    };
    
    const handleFileSelection = (files: FileList | null) => {
        if (!files) return;
        const newDocs = Array.from(files).map(file => ({
            id: `doc-${Date.now()}-${Math.random()}`, file, name: file.name,
            size: file.size > 1024*1024 ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : `${(file.size / 1024).toFixed(2)} KB`,
            status: 'Queued' as const,
        }));
        setDocuments(prev => [...prev, ...newDocs]);
        newDocs.forEach(doc => processFile(doc.id, doc.file));
    }
    
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

    const removeDocument = (id: string) => {
        setDocuments(docs => docs.filter(d => d.id !== id));
    };

    const selectedEmbeddingProvider = LLM_PROVIDERS.find(p => p.id === base.embedding.provider);
    const staticEmbeddingModels = selectedEmbeddingProvider?.embeddingModels || [];
    const selectedVectorProvider = VECTOR_PROVIDERS.find(p => p.id === base.vectorStore.provider);
    
    const isEmbeddingConfigured = 
        !!selectedEmbeddingProvider &&
        !!base.embedding.model && (
            (selectedEmbeddingProvider.type === 'cloud' && !!base.embedding.apiKey && base.embedding.apiKey !== 'YOUR_API_KEY') ||
            (selectedEmbeddingProvider.type === 'local' && !!base.embedding.path)
        );

    const isVectorStoreConfigured = 
        !!selectedVectorProvider && (
            (selectedVectorProvider.type === 'cloud' && !!base.vectorStore.apiKey && base.vectorStore.apiKey !== 'YOUR_API_KEY') ||
            (selectedVectorProvider.type === 'local' && !!base.vectorStore.path)
        );

    const isConfigured = isEmbeddingConfigured && isVectorStoreConfigured;


    const getStatusIcon = (status: DocumentState['status']) => {
        switch(status) {
            case 'Parsing':
            case 'Indexing':
                return <Icon name="spinner" className="w-4 h-4 text-yellow-400" />;
            case 'Indexed':
                return <Icon name="check-mark" className="w-4 h-4 text-green-400" />;
            case 'Error':
                return <Icon name="x-mark" className="w-4 h-4 text-red-400" />;
            default:
                return <Icon name="clock" className="w-4 h-4 text-text-secondary" />;
        }
    }
    
    const selectedRerankerProvider = RERANKER_PROVIDERS.find(p => p.id === base.reranker.provider);
    const selectedRerankerProviderModels = selectedRerankerProvider?.models || [];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <input type="text" value={base.name} onChange={e => onUpdate({...base, name: e.target.value})} className="bg-transparent font-bold text-text-primary focus:outline-none focus:bg-surface p-1 rounded-md" />
                <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-surface-light">
                    <Icon name="settings" className="w-5 h-5 text-text-secondary" />
                </button>
            </div>

            {isConfigured ? (
                 <div 
                    onDragEnter={handleDragEvents} 
                    onDragLeave={handleDragEvents} 
                    onDragOver={handleDragEvents} 
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border-color hover:border-primary/50'}`}
                >
                    <input ref={fileInputRef} type="file" multiple onChange={e => handleFileSelection(e.target.files)} className="hidden" accept=".pdf,.docx,.txt,.md"/>
                    <Icon name="upload" className="w-8 h-8 mx-auto text-text-secondary mb-2" />
                    <p className="text-text-primary font-semibold">Drop files here or click to browse</p>
                    <p className="text-xs text-text-secondary">Supported: PDF, DOCX, TXT, MD</p>
                </div>
            ) : (
                <div className="p-6 border-2 border-dashed border-border-color rounded-lg text-center bg-surface">
                    <Icon name="settings" className="w-8 h-8 mx-auto text-text-secondary mb-2" />
                    <h5 className="text-text-primary font-semibold">Configuration Required</h5>
                    <p className="text-sm text-text-secondary mt-1">Please configure the embedding provider and vector store in the settings before uploading documents.</p>
                     <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="mt-4 bg-primary text-white px-4 py-2 text-sm font-semibold rounded-lg hover:bg-primary/80 transition-colors"
                    >
                        Open Settings
                    </button>
                </div>
            )}

            <div className="bg-surface p-4 rounded-lg border border-border-color space-y-2">
                <h5 className="font-semibold text-text-primary mb-2">Ingestion Queue</h5>
                {documents.length === 0 && <p className="text-sm text-center text-text-secondary py-4">No documents in queue.</p>}
                {documents.map(doc => (
                    <div key={doc.id} className="grid grid-cols-[auto,1fr,auto,auto] gap-x-3 items-center text-sm p-2 rounded-md hover:bg-surface-light" title={doc.message}>
                        <div className="flex-shrink-0">{getStatusIcon(doc.status)}</div>
                        <span className="truncate">{doc.name}</span>
                        <span className="text-text-secondary whitespace-nowrap">{doc.size}</span>
                        <button onClick={() => removeDocument(doc.id)} className="p-1 text-text-secondary hover:text-red-500"><Icon name="trash" className="w-4 h-4"/></button>
                    </div>
                ))}
            </div>

            <div className="bg-surface p-4 rounded-lg border border-border-color space-y-3">
                 <h5 className="font-semibold text-text-primary mb-2">Data Connectors</h5>
                 {(base.dataConnectors || []).map(conn => (
                     <div key={conn.id} className="flex justify-between items-center p-2 rounded-md hover:bg-surface-light">
                         <div className="flex items-center space-x-2">
                             <Icon name={conn.type} className="w-5 h-5 text-text-secondary" />
                             <span className="text-sm">{conn.name}</span>
                         </div>
                         <button onClick={() => handleRemoveConnector(conn.id)} className="p-1 text-text-secondary hover:text-red-500"><Icon name="trash" className="w-4 h-4"/></button>
                     </div>
                 ))}
                 <div className="flex items-center justify-center space-x-4 pt-2">
                     <button onClick={() => handleAddConnector('notion')} className="flex items-center space-x-2 text-sm text-text-secondary hover:text-text-primary">
                         <Icon name="notion" className="w-5 h-5"/> <span>Connect Notion</span>
                     </button>
                      <button onClick={() => handleAddConnector('github')} className="flex items-center space-x-2 text-sm text-text-secondary hover:text-text-primary">
                         <Icon name="github" className="w-5 h-5"/> <span>Connect GitHub</span>
                     </button>
                 </div>
            </div>

            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title={`Settings for ${base.name}`}>
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                    <div>
                        <h4 className="font-semibold text-lg text-text-primary mb-3">Embedding</h4>
                        <div className="space-y-4 bg-surface p-4 rounded-lg border border-border-color">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Embedding Provider</label>
                                <select value={base.embedding.provider} onChange={handleEmbeddingProviderChange} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                                    {LLM_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                </select>
                                <ProviderConfigInput provider={selectedEmbeddingProvider} value={selectedEmbeddingProvider?.type === 'cloud' ? base.embedding.apiKey : base.embedding.path} placeholder={selectedEmbeddingProvider?.type === 'cloud' ? 'Enter API Key' : 'http://localhost:11434'} onChange={handleEmbeddingConfigChange}/>
                            </div>
                            
                            {selectedEmbeddingProvider?.id === 'lmstudio' ? (
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Embedding Model</label>
                                    <select value={base.embedding.model} onChange={e => handleEmbeddingModelChange(e.target.value)} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" disabled={isLoadingLmStudioModels || !!lmStudioModelError || lmStudioModels.length === 0}>
                                        {isLoadingLmStudioModels && <option>Loading models...</option>}
                                        {!isLoadingLmStudioModels && !lmStudioModelError && lmStudioModels.length === 0 && <option>No models found at this address</option>}
                                        {!isLoadingLmStudioModels && lmStudioModelError && <option>Error fetching models</option>}
                                        {lmStudioModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                    </select>
                                    {lmStudioModelError && <p className="text-xs text-red-400 mt-1">{lmStudioModelError}</p>}
                                </div>
                            ) : (
                               staticEmbeddingModels.length > 0 && (
                                 <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Embedding Model</label>
                                    <select value={base.embedding.model} onChange={e => handleEmbeddingModelChange(e.target.value)} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                                       {staticEmbeddingModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                    </select>
                                 </div>
                               )
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-lg text-text-primary mb-3">Vector Store</h4>
                        <div className="space-y-4 bg-surface p-4 rounded-lg border border-border-color">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Vector Database Provider</label>
                                <select value={base.vectorStore.provider} onChange={handleVectorStoreProviderChange} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                                    {VECTOR_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                </select>
                                {selectedVectorProvider && FILE_BASED_VECTOR_PROVIDERS.includes(selectedVectorProvider.id) ? (
                                     <div className="mt-2 text-sm text-text-secondary p-2 bg-surface-light border border-border-color rounded-md">
                                        Path: <code className="font-mono">{base.vectorStore.path}</code>
                                    </div>
                                ) : (
                                    <ProviderConfigInput 
                                        provider={selectedVectorProvider} 
                                        value={selectedVectorProvider?.type === 'cloud' ? base.vectorStore.apiKey : base.vectorStore.path} 
                                        placeholder={selectedVectorProvider?.type === 'cloud' ? 'Enter API Key' : 'Enter Path/URL...'} 
                                        onChange={handleVectorStoreConfigChange}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                         <h4 className="font-semibold text-lg text-text-primary mb-3">Chunking</h4>
                         <div className="grid grid-cols-2 gap-4 bg-surface p-4 rounded-lg border border-border-color">
                             <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Chunk Size</label>
                                <input type="number" value={base.chunking.chunkSize} onChange={e => handleChunkingChange('chunkSize', e.target.value)} className="w-full p-2 bg-surface-light border border-border-color rounded-md"/>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Overlap</label>
                                <input type="number" value={base.chunking.overlap} onChange={e => handleChunkingChange('overlap', e.target.value)} className="w-full p-2 bg-surface-light border border-border-color rounded-md"/>
                             </div>
                         </div>
                    </div>

                    <div>
                         <h4 className="font-semibold text-lg text-text-primary mb-3">Retrieval & Ranking</h4>
                         <div className="space-y-4 bg-surface p-4 rounded-lg border border-border-color">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Top-K Retrieval</label>
                                <input type="number" value={base.retrieval.topK} onChange={e => handleRetrievalChange('topK', e.target.value)} className="w-full p-2 bg-surface-light border border-border-color rounded-md"/>
                            </div>
                            <div className="border-t border-border-color pt-4">
                                 <div className="flex items-center space-x-2">
                                    <input type="checkbox" id="reranker-toggle" checked={base.reranker.enabled} onChange={handleRerankerEnabledChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                    <label htmlFor="reranker-toggle" className="text-text-primary">Enable Reranker</label>
                                </div>
                                {base.reranker.enabled && (
                                    <div className="mt-4 space-y-2">
                                        <div>
                                            <label className="block text-sm font-medium text-text-secondary mb-1">Reranker Provider</label>
                                            <select onChange={handleRerankerProviderChange} value={base.reranker.provider || ''} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                                {RERANKER_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        
                                        {selectedRerankerProviderModels.length > 0 && (
                                            <div>
                                                <label className="block text-sm font-medium text-text-secondary mb-1">Reranker Model</label>
                                                <select
                                                    onChange={(e) => onUpdate({ ...base, reranker: { ...base.reranker, model: e.target.value } })}
                                                    value={base.reranker.model || ''}
                                                    className="w-full p-2 bg-surface-light border border-border-color rounded-md"
                                                >
                                                    {selectedRerankerProviderModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        
                                        {selectedRerankerProvider?.type === 'local-embedded' && (
                                            <div className="mt-2 text-sm text-text-secondary p-2 bg-surface-light border border-border-color rounded-md">
                                                <p>Embedded reranker model (runs in browser). No configuration required.</p>
                                            </div>
                                        )}

                                        {(selectedRerankerProvider?.type === 'cloud' || selectedRerankerProvider?.type === 'local') && (
                                            <ProviderConfigInput
                                                provider={selectedRerankerProvider}
                                                value={selectedRerankerProvider.type === 'cloud' ? base.reranker.apiKey : base.reranker.path}
                                                placeholder={selectedRerankerProvider.type === 'cloud' ? 'Enter Reranker API Key' : 'http://localhost:8001/rerank'}
                                                onChange={handleRerankerConfigChange}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                         </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default RAGBaseManager;
