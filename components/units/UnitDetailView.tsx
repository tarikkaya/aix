





import React, { useMemo } from 'react';
import type { Unit, ScaleValue, Tool, RAGBase, Provider, TrainingSource } from '../../types';
import { LLM_PROVIDERS, VECTOR_PROVIDERS, DB_PROVIDERS, RoomName } from '../../constants';
import Icon from '../ui/Icon';
import RAGBaseManager from './RAGBaseManager';
import TrainingVectorManager from './TrainingVectorManager';

const Section: React.FC<{ title: string, icon: React.ReactNode, children: React.ReactNode, initiallyOpen?: boolean }> = ({ title, icon, children, initiallyOpen = false }) => {
    const [isOpen, setIsOpen] = React.useState(initiallyOpen);
    return (
        <div className="bg-surface rounded-lg border border-border-color">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-3 text-left">
                <div className="flex items-center space-x-3">
                    <span className="text-primary">{icon}</span>
                    <h3 className="font-semibold text-text-primary">{title}</h3>
                </div>
                <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} className="w-5 h-5 text-text-secondary" />
            </button>
            {isOpen && <div className="p-4 border-t border-border-color space-y-4">{children}</div>}
        </div>
    );
};

const ProviderConfigInput: React.FC<{ provider?: Provider, value?: string, placeholder: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ provider, value, placeholder, onChange }) => {
    if (!provider) return null;
    return (
        <div className="mt-2">
             <label className="block text-xs font-medium text-text-secondary mb-1">{provider.type === 'cloud' ? 'API Key' : 'Path / URL'}</label>
            <input 
                type="text" 
                value={value || ''}
                placeholder={placeholder}
                onChange={onChange}
                className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
        </div>
    )
}

interface UnitDetailViewProps {
  unit: Unit;
  onUpdate: (unit: Unit) => void;
  roomId: string;
  allTools: Tool[];
  ragBase?: RAGBase;
  onUpdateRagBase: (base: RAGBase) => void;
  activeRoomName: string;
}


const UnitDetailView: React.FC<UnitDetailViewProps> = (props) => {
    const { 
        unit, onUpdate, roomId, allTools, ragBase, 
        onUpdateRagBase, activeRoomName
    } = props;
    
    // State for LLM Provider
    const [lmStudioModels, setLmStudioModels] = React.useState<{ id: string; name: string; }[]>([]);
    const [isLoadingLmStudioModels, setIsLoadingLmStudioModels] = React.useState(false);
    const [lmStudioModelError, setLmStudioModelError] = React.useState<string | null>(null);

    // State for Training Vector Embedding Provider
    const [lmStudioTrainingEmbeddingModels, setLmStudioTrainingEmbeddingModels] = React.useState<{ id: string; name: string; }[]>([]);
    const [isLoadingLmStudioTrainingEmbeddingModels, setIsLoadingLmStudioTrainingEmbeddingModels] = React.useState(false);
    const [lmStudioTrainingEmbeddingModelError, setLmStudioTrainingEmbeddingModelError] = React.useState<string | null>(null);
    
    // State for Global Experience Embedding Provider (on RF Arbiter)
    const [lmStudioExperienceEmbeddingModels, setLmStudioExperienceEmbeddingModels] = React.useState<{ id: string; name: string; }[]>([]);
    const [isLoadingLmStudioExperienceEmbeddingModels, setIsLoadingLmStudioExperienceEmbeddingModels] = React.useState(false);
    const [lmStudioExperienceEmbeddingModelError, setLmStudioExperienceEmbeddingModelError] = React.useState<string | null>(null);

    const defaultTrainingVector = useMemo<Unit['trainingVector']>(() => ({
        enabled: false,
        vectorStore: {
            provider: 'lancedb',
            path: `./aix_data/rooms/${roomId}/units/${unit.id}/training_vector.lancedb`
        },
        embedding: {
            provider: 'ollama',
            model: 'nomic-embed-text',
            path: 'http://localhost:11434'
        },
        neurons: 0,
        sources: []
    }), [roomId, unit.id]);

    // Effect for LLM Provider
    React.useEffect(() => {
        const llmProvider = unit.llmProvider;
        if (llmProvider?.provider !== 'lmstudio' || !llmProvider.path) {
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
                let path = llmProvider.path;
                if (!path.startsWith('http://') && !path.startsWith('https://')) path = 'http://' + path;
                
                const url = new URL(`${path}/v1/models`);
                const response = await fetch(url.toString(), { signal });
                
                if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
                const data = await response.json();
                if (!data.data || !Array.isArray(data.data)) throw new Error('Invalid response format from LM Studio server.');

                const models = data.data.map((model: any) => ({ id: model.id, name: model.id }));
                setLmStudioModels(models);

                if (models.length > 0 && !models.find(m => m.id === llmProvider.model)) {
                    onUpdate({ ...unit, llmProvider: { ...llmProvider, model: models[0].id } });
                } else if (models.length === 0 && llmProvider.model) {
                     onUpdate({ ...unit, llmProvider: { ...llmProvider, model: '' } });
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
    }, [unit.llmProvider, onUpdate]);

    // Generic fetcher for LM Studio embedding models
    const fetchLmStudioEmbeddingModels = (
        path: string,
        setLoading: (loading: boolean) => void,
        setError: (error: string | null) => void,
        setModels: (models: { id: string; name: string; }[]) => void,
        onSuccess: (models: { id: string; name: string; }[]) => void
    ) => {
        const controller = new AbortController();
        const signal = controller.signal;
        
        const fetchFn = async () => {
            setLoading(true);
            setError(null);
            setModels([]);

            try {
                let urlPath = path;
                if (!urlPath.startsWith('http://') && !urlPath.startsWith('https://')) urlPath = 'http://' + urlPath;
                
                const url = new URL(`${urlPath}/v1/models`);
                const response = await fetch(url.toString(), { signal });
                
                if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
                const data = await response.json();
                if (!data.data || !Array.isArray(data.data)) throw new Error('Invalid response format from LM Studio server.');
                
                const models = data.data.map((model: any) => ({ id: model.id, name: model.id }));
                setModels(models);
                onSuccess(models);

            } catch (error) {
                if (error instanceof Error && error.name !== 'AbortError') {
                    setError('Failed to fetch models. Check URL and server status.');
                }
            } finally {
                setLoading(false);
            }
        };

        const debounceTimeout = setTimeout(fetchFn, 500);
        return () => { clearTimeout(debounceTimeout); controller.abort(); };
    };

    // Effect for Training Vector Embedding Provider
    React.useEffect(() => {
        const embedding = unit.trainingVector?.embedding;
        if (embedding?.provider !== 'lmstudio' || !embedding.path) {
            setLmStudioTrainingEmbeddingModels([]);
            setLmStudioTrainingEmbeddingModelError(null);
            return;
        }

        return fetchLmStudioEmbeddingModels(
            embedding.path,
            setIsLoadingLmStudioTrainingEmbeddingModels,
            setLmStudioTrainingEmbeddingModelError,
            setLmStudioTrainingEmbeddingModels,
            (models) => {
                const currentTrainingVector = unit.trainingVector || defaultTrainingVector;
                if (models.length > 0 && !models.find(m => m.id === embedding.model)) {
                    onUpdate({ ...unit, trainingVector: { ...currentTrainingVector, embedding: { ...embedding, model: models[0].id } } });
                } else if (models.length === 0 && embedding.model) {
                     onUpdate({ ...unit, trainingVector: { ...currentTrainingVector, embedding: { ...embedding, model: '' } } });
                }
            }
        );
    }, [unit.trainingVector, onUpdate, defaultTrainingVector]);
    
    // Effect for Global Experience Embedding Provider (on RF Arbiter)
    React.useEffect(() => {
        const embedding = unit.experienceEmbeddingEngine;
        if (unit.name !== 'RF Arbiter' || embedding?.provider !== 'lmstudio' || !embedding.path) {
            setLmStudioExperienceEmbeddingModels([]);
            setLmStudioExperienceEmbeddingModelError(null);
            return;
        }

        return fetchLmStudioEmbeddingModels(
            embedding.path,
            setIsLoadingLmStudioExperienceEmbeddingModels,
            setLmStudioExperienceEmbeddingModelError,
            setLmStudioExperienceEmbeddingModels,
            (models) => {
                if (models.length > 0 && !models.find(m => m.id === embedding.model)) {
                    onUpdate({ ...unit, experienceEmbeddingEngine: { ...embedding, model: models[0].id } });
                } else if (models.length === 0 && embedding.model) {
                     onUpdate({ ...unit, experienceEmbeddingEngine: { ...embedding, model: '' } });
                }
            }
        );
    }, [unit.name, unit.experienceEmbeddingEngine, onUpdate]);


    const handleLlmProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProviderId = e.target.value;
        const provider = LLM_PROVIDERS.find(p => p.id === newProviderId);
        const defaultModel = provider?.models?.[0];
        onUpdate({ ...unit, llmProvider: { provider: newProviderId, model: defaultModel?.id || '', apiKey: '', path: '' }});
    };

    const handleVectorProviderChange = (e: React.ChangeEvent<HTMLSelectElement>, vectorType: 'trainingVector' | 'experienceVector') => {
        const newProviderId = e.target.value;
    
        if (vectorType === 'trainingVector') {
            const currentVector = unit.trainingVector || defaultTrainingVector;
            let newPath = '';
            if (['lancedb', 'chromadb', 'faiss'].includes(newProviderId)) {
                newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/training_vector.${newProviderId}`;
            }
            onUpdate({
                ...unit,
                trainingVector: {
                    ...currentVector,
                    vectorStore: { provider: newProviderId, path: newPath, apiKey: '' },
                },
            });
        } else { // experienceVector
            const currentVector = unit.experienceVector || { provider: 'lancedb', neurons: [] };
            let newPath = '';
            if (['lancedb', 'chromadb', 'faiss'].includes(newProviderId)) {
                newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/experience_vector.${newProviderId}`;
            }
            onUpdate({
                ...unit,
                experienceVector: {
                    ...currentVector,
                    provider: newProviderId,
                    path: newPath,
                    apiKey: '',
                },
            });
        }
    };
    
    const handleDbProviderChange = (e: React.ChangeEvent<HTMLSelectElement>, dbType: 'standardDb' | 'scaleDb') => {
        const newProviderId = e.target.value;
        let newPath = '';
        if (newProviderId === 'sqlite' || newProviderId === 'duckdb') {
            if (dbType === 'standardDb') {
                newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/standard.${newProviderId === 'sqlite' ? 'db' : 'duckdb'}`;
            } else { // scaleDb
                newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/scale_db.${newProviderId === 'sqlite' ? 'sqlite' : 'duckdb'}`;
            }
        }
        
        if (dbType === 'standardDb') {
            const currentDb = unit.standardDb || { enabled: false, provider: 'sqlite', path: '' };
            onUpdate({ ...unit, standardDb: { ...currentDb, provider: newProviderId, path: newPath, apiKey: '' } });
        } else { // scaleDb
            const currentVector = unit.scaleDb || { enabled: false, provider: 'sqlite', values: [], path: '' };
            onUpdate({ ...unit, scaleDb: { ...currentVector, provider: newProviderId, path: newPath, apiKey: '' } });
        }
    };

    const handleToolToggle = (toolId: string) => {
        const hasTool = (unit.tools || []).includes(toolId);
        const newTools = hasTool ? (unit.tools || []).filter(id => id !== toolId) : [...(unit.tools || []), toolId];
        onUpdate({ ...unit, tools: newTools });
    };

    const handleScaleValueChange = (index: number, field: keyof Omit<ScaleValue, 'id'>, value: string | number) => {
        const currentVector = unit.scaleDb;
        if (!currentVector) return;
        
        const newValues = [...(currentVector.values || [])];
        const updatedValue = { ...newValues[index], [field]: value };
    
        if (field === 'min' && typeof value === 'number' && value > updatedValue.max) {
            updatedValue.max = value;
        }
        if (field === 'max' && typeof value === 'number' && value < updatedValue.min) {
            updatedValue.min = value;
        }
        if (field === 'score' && typeof value === 'number') {
            if (value > updatedValue.max) updatedValue.score = updatedValue.max;
            else if (value < updatedValue.min) updatedValue.score = updatedValue.min;
        }
        newValues[index] = updatedValue;
        onUpdate({ ...unit, scaleDb: { ...currentVector, values: newValues } });
    };

    const handleAddScaleValue = () => {
        const currentVector = unit.scaleDb || { enabled: false, provider: 'sqlite', values: [], path: '' };
        const newValues = [...(currentVector.values || []), { id: `sv-${Date.now()}`, name: 'New Metric', score: 50, min: 0, max: 100, defaultValue: 50 }];
        onUpdate({ ...unit, scaleDb: { ...currentVector, values: newValues } });
    };

    const handleRemoveScaleValue = (index: number) => {
        const currentVector = unit.scaleDb;
        if (!currentVector || !currentVector.values) return;
        const newValues = currentVector.values.filter((_, i) => i !== index);
        onUpdate({ ...unit, scaleDb: { ...currentVector, values: newValues } });
    };

    const handleSchedulerChange = (field: keyof Unit['scheduler'], value: any) => {
        onUpdate({ ...unit, scheduler: { ...(unit.scheduler || { enabled: false, type: 'interval' }), [field]: value } });
    };

    const handleTrainingEmbeddingProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProviderId = e.target.value;
        const provider = LLM_PROVIDERS.find(p => p.id === newProviderId);
        const defaultModel = provider?.embeddingModels?.[0];
        const currentVector = unit.trainingVector || defaultTrainingVector;

        const newEmbeddingConfig = {
            provider: newProviderId,
            model: defaultModel?.id || '',
            apiKey: '',
            path: ''
        };
        onUpdate({ ...unit, trainingVector: { ...currentVector, embedding: newEmbeddingConfig } });
    };
    
    const handleExperienceEmbeddingProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProviderId = e.target.value;
        const provider = LLM_PROVIDERS.find(p => p.id === newProviderId);
        const defaultModel = provider?.embeddingModels?.[0];
        const currentEngine = unit.experienceEmbeddingEngine;

        const newEmbeddingConfig = {
            provider: newProviderId,
            model: defaultModel?.id || '',
            apiKey: '',
            path: ''
        };
        onUpdate({ ...unit, experienceEmbeddingEngine: { ...currentEngine, ...newEmbeddingConfig } });
    };

    const handleTrainingSourcesUpdate = (sources: TrainingSource[]) => {
        const totalNeurons = sources
            .filter(s => s.status === 'Completed')
            .reduce((acc, s) => acc + s.neuronCount, 0);
        const currentVector = unit.trainingVector || defaultTrainingVector;
        onUpdate({
            ...unit,
            trainingVector: {
                ...currentVector,
                sources: sources,
                neurons: totalNeurons,
            },
        });
    };
    
    const isExemptFromLoopToggle = ['Admin Manager', 'Comms Chief'].includes(unit.name);

    const selectedLlmProvider = LLM_PROVIDERS.find(p => p.id === unit.llmProvider?.provider);
    const selectedTrainingEmbeddingProvider = LLM_PROVIDERS.find(p => p.id === unit.trainingVector?.embedding?.provider);
    const selectedExperienceEmbeddingProvider = LLM_PROVIDERS.find(p => p.id === unit.experienceEmbeddingEngine?.provider);
    const selectedTrainingVectorStoreProvider = VECTOR_PROVIDERS.find(p => p.id === unit.trainingVector?.vectorStore?.provider);
    const selectedExperienceProvider = VECTOR_PROVIDERS.find(p => p.id === unit.experienceVector?.provider);
    const selectedDbProvider = DB_PROVIDERS.find(p => p.id === unit.standardDb?.provider);
    const selectedScaleProvider = DB_PROVIDERS.find(p => p.id === unit.scaleDb?.provider);
    
    const llmProviderModels = selectedLlmProvider?.models || [];
    const trainingEmbeddingModels = selectedTrainingEmbeddingProvider?.embeddingModels || [];
    const experienceEmbeddingModels = selectedExperienceEmbeddingProvider?.embeddingModels || [];

    const autoConfiguredVectorProviders = ['lancedb', 'chromadb', 'faiss'];
    const autoConfiguredDbProviders = ['sqlite', 'duckdb'];
    
    return (
        <div className="space-y-4 pb-8">
            <div className="flex justify-between items-center">
                <input
                    type="text"
                    value={unit.name}
                    onChange={(e) => onUpdate({...unit, name: e.target.value})}
                    className="w-full bg-transparent text-2xl font-bold text-text-primary focus:outline-none focus:bg-surface p-2 rounded-md"
                />
                {!isExemptFromLoopToggle && selectedLlmProvider?.type === 'local' && (
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                        <Icon name="recycle" className="w-5 h-5" />
                        <span className="text-sm font-medium text-text-secondary">Loop:</span>
                        <label htmlFor="loop-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="loop-toggle" className="sr-only peer" 
                                checked={unit.isLoopOpen}
                                onChange={(e) => onUpdate({...unit, isLoopOpen: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-surface-light peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                )}
            </div>

            {activeRoomName === RoomName.Proactive && (
                <Section title="Task Scheduler" icon={<Icon name="clock" className="w-5 h-5" />} initiallyOpen={true}>
                    <div className="flex items-center space-x-2 mb-4">
                        <input type="checkbox" id="scheduler-enabled" checked={unit.scheduler?.enabled ?? false} onChange={e => handleSchedulerChange('enabled', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                        <label htmlFor="scheduler-enabled" className="text-text-primary">Enable Scheduler</label>
                    </div>
                    {unit.scheduler?.enabled && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Trigger Type</label>
                                <select value={unit.scheduler.type} onChange={e => handleSchedulerChange('type', e.target.value)} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                    <option value="datetime">Specific Date & Time</option>
                                    <option value="interval">Interval</option>
                                </select>
                            </div>
                            {unit.scheduler.type === 'datetime' ? (
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Date and Time</label>
                                    <input
                                        type="datetime-local"
                                        value={unit.scheduler.datetime || ''}
                                        onChange={e => handleSchedulerChange('datetime', e.target.value)}
                                        className="w-full p-2 bg-surface-light border border-border-color rounded-md"
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1">Run Every</label>
                                        <input
                                            type="number"
                                            value={unit.scheduler.intervalValue || ''}
                                            onChange={e => handleSchedulerChange('intervalValue', parseInt(e.target.value, 10))}
                                            className="w-full p-2 bg-surface-light border border-border-color rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1">Unit</label>
                                        <select value={unit.scheduler.intervalUnit || 'hours'} onChange={e => handleSchedulerChange('intervalUnit', e.target.value)} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                            <option value="minutes">Minutes</option>
                                            <option value="hours">Hours</option>
                                            <option value="days">Days</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Section>
            )}

            <Section title="Purpose" icon={<Icon name="brain" className="w-5 h-5" />} initiallyOpen={true}>
                <textarea
                    value={unit.purpose}
                    onChange={(e) => onUpdate({ ...unit, purpose: e.target.value })}
                    rows={3}
                    className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    placeholder="Describe the high-level objective of this unit..."
                />
            </Section>

            <Section title="Core Configuration" icon={<Icon name="settings" className="w-5 h-5" />} initiallyOpen={true}>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">LLM Provider</label>
                    <select value={unit.llmProvider?.provider || ''} onChange={handleLlmProviderChange} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                        {LLM_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </select>
                     <ProviderConfigInput 
                        provider={selectedLlmProvider}
                        value={selectedLlmProvider?.type === 'cloud' ? unit.llmProvider?.apiKey : unit.llmProvider?.path}
                        placeholder={selectedLlmProvider?.type === 'cloud' ? 'Enter API Key...' : 'http://localhost:11434'}
                        onChange={(e) => onUpdate({...unit, llmProvider: { ...(unit.llmProvider || { provider: '', model: '' }), [selectedLlmProvider?.type === 'cloud' ? 'apiKey' : 'path']: e.target.value}})}
                    />
                </div>
                {unit.llmProvider?.provider === 'lmstudio' ? (
                     <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Model</label>
                        <select 
                            value={unit.llmProvider.model || ''} 
                            onChange={(e) => onUpdate({...unit, llmProvider: { ...(unit.llmProvider || { provider: '', model: '' }), model: e.target.value}})}
                            className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            disabled={isLoadingLmStudioModels || !!lmStudioModelError || lmStudioModels.length === 0}
                        >
                            {isLoadingLmStudioModels && <option>Loading models...</option>}
                            {!isLoadingLmStudioModels && !lmStudioModelError && lmStudioModels.length === 0 && <option>No models found at address</option>}
                            {!isLoadingLmStudioModels && lmStudioModelError && <option>Error fetching models</option>}
                            {lmStudioModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                        {lmStudioModelError && <p className="text-xs text-red-400 mt-1">{lmStudioModelError}</p>}
                    </div>
                ) : (
                    llmProviderModels.length > 0 && <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Model</label>
                        <select value={unit.llmProvider?.model || ''} onChange={(e) => onUpdate({...unit, llmProvider: { ...(unit.llmProvider || { provider: '', model: '' }), model: e.target.value}})} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                           {llmProviderModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1 mt-4">Core Prompt</label>
                    <textarea
                        value={unit.prompt}
                        onChange={(e) => onUpdate({ ...unit, prompt: e.target.value })}
                        rows={6}
                        className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                    />
                </div>
            </Section>
            
            {unit.name === 'RF Arbiter' && unit.experienceEmbeddingEngine && (
                 <Section title="Global Experience Embedding Engine" icon={<Icon name="wrench-screwdriver" className="w-5 h-5" />} initiallyOpen={true}>
                     <div className="space-y-4 p-4 bg-surface rounded-lg border border-primary/50">
                        <p className="text-sm text-text-secondary">This engine, configured here on the RF Arbiter, is responsible for embedding the experience neurons for ALL units in the coalition. This ensures a consistent learning protocol.</p>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Embedding Provider</label>
                            <select value={unit.experienceEmbeddingEngine?.provider || ''} onChange={handleExperienceEmbeddingProviderChange} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                {LLM_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                            <ProviderConfigInput 
                                provider={selectedExperienceEmbeddingProvider}
                                value={selectedExperienceEmbeddingProvider?.type === 'cloud' ? unit.experienceEmbeddingEngine?.apiKey : unit.experienceEmbeddingEngine?.path}
                                placeholder={selectedExperienceEmbeddingProvider?.type === 'cloud' ? 'Enter API Key...' : 'http://localhost:11434'}
                                onChange={(e) => {
                                    const key = selectedExperienceEmbeddingProvider?.type === 'cloud' ? 'apiKey' : 'path';
                                    onUpdate({ ...unit, experienceEmbeddingEngine: { ...(unit.experienceEmbeddingEngine!), [key]: e.target.value } });
                                }}
                            />
                        </div>

                        {unit.experienceEmbeddingEngine?.provider === 'lmstudio' ? (
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Embedding Model</label>
                                <select 
                                    value={unit.experienceEmbeddingEngine?.model || ''} 
                                    onChange={(e) => onUpdate({ ...unit, experienceEmbeddingEngine: { ...(unit.experienceEmbeddingEngine!), model: e.target.value } })}
                                    className="w-full p-2 bg-surface-light border border-border-color rounded-md disabled:opacity-50"
                                    disabled={isLoadingLmStudioExperienceEmbeddingModels || !!lmStudioExperienceEmbeddingModelError || lmStudioExperienceEmbeddingModels.length === 0}>
                                    {isLoadingLmStudioExperienceEmbeddingModels && <option>Loading models...</option>}
                                    {!isLoadingLmStudioExperienceEmbeddingModels && !lmStudioExperienceEmbeddingModelError && lmStudioExperienceEmbeddingModels.length === 0 && <option>No models found</option>}
                                    {!isLoadingLmStudioExperienceEmbeddingModels && lmStudioExperienceEmbeddingModelError && <option>Error fetching models</option>}
                                    {lmStudioExperienceEmbeddingModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                </select>
                                {lmStudioExperienceEmbeddingModelError && <p className="text-xs text-red-400 mt-1">{lmStudioExperienceEmbeddingModelError}</p>}
                            </div>
                        ) : (
                            experienceEmbeddingModels.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Embedding Model</label>
                                    <select value={unit.experienceEmbeddingEngine?.model || ''} onChange={(e) => onUpdate({ ...unit, experienceEmbeddingEngine: { ...(unit.experienceEmbeddingEngine!), model: e.target.value } })} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                        {experienceEmbeddingModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                    </select>
                                </div>
                            )
                        )}
                    </div>
                 </Section>
            )}

            {unit.type?.includes('RAG') && ragBase && (
                <Section title="Knowledge Base (RAG)" icon={<Icon name="database" className="w-5 h-5" />} initiallyOpen={true}>
                    <RAGBaseManager base={ragBase} onUpdate={onUpdateRagBase} />
                </Section>
            )}

            <Section title="Available Tools" icon={<Icon name="wrench-screwdriver" className="w-5 h-5" />}>
                <div className="grid grid-cols-2 gap-2">
                    {allTools.map(tool => (
                        <div key={tool.id} className="flex items-center space-x-2 bg-surface-light p-2 rounded-md">
                            <input
                                type="checkbox"
                                id={`tool-${tool.id}`}
                                checked={(unit.tools || []).includes(tool.id)}
                                onChange={() => handleToolToggle(tool.id)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor={`tool-${tool.id}`} className="text-sm text-text-primary">{tool.name}</label>
                        </div>
                    ))}
                    {allTools.length === 0 && <p className="col-span-2 text-sm text-center text-text-secondary">No tools available in the Tools Room.</p>}
                </div>
            </Section>
            
            <Section title="Training Vector Space" icon={<Icon name="database" className="w-5 h-5" />}>
                <div className="flex items-center space-x-2 mb-4">
                    <input type="checkbox" id="training-enabled" checked={unit.trainingVector?.enabled ?? false} onChange={e => onUpdate({...unit, trainingVector: { ...(unit.trainingVector || defaultTrainingVector), enabled: e.target.checked}})} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="training-enabled" className="text-text-primary">Enable Training Vector Space</label>
                </div>
                {unit.trainingVector?.enabled && (
                    <div className="space-y-4">
                        <div className="space-y-4 p-4 bg-surface rounded-lg border border-border-color">
                            <h4 className="font-semibold text-text-primary">Training Embedding Engine</h4>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Embedding Provider</label>
                                <select value={unit.trainingVector?.embedding?.provider || ''} onChange={handleTrainingEmbeddingProviderChange} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                    {LLM_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                </select>
                                <ProviderConfigInput 
                                    provider={selectedTrainingEmbeddingProvider}
                                    value={selectedTrainingEmbeddingProvider?.type === 'cloud' ? unit.trainingVector?.embedding?.apiKey : unit.trainingVector?.embedding?.path}
                                    placeholder={selectedTrainingEmbeddingProvider?.type === 'cloud' ? 'Enter API Key...' : 'http://localhost:11434'}
                                    onChange={(e) => {
                                        const key = selectedTrainingEmbeddingProvider?.type === 'cloud' ? 'apiKey' : 'path';
                                        const currentVector = unit.trainingVector || defaultTrainingVector;
                                        onUpdate({
                                            ...unit, 
                                            trainingVector: {
                                                ...currentVector,
                                                embedding: {
                                                    ...(currentVector.embedding),
                                                    provider: currentVector.embedding.provider,
                                                    model: currentVector.embedding.model,
                                                    [key]: e.target.value
                                                }
                                            }
                                        });
                                    }}
                                />
                            </div>

                            {unit.trainingVector?.embedding?.provider === 'lmstudio' ? (
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Embedding Model</label>
                                    <select 
                                        value={unit.trainingVector?.embedding?.model || ''} 
                                        onChange={(e) => onUpdate({...unit, trainingVector: { ...(unit.trainingVector!), embedding: { ...(unit.trainingVector?.embedding!), model: e.target.value}}})}
                                        className="w-full p-2 bg-surface-light border border-border-color rounded-md disabled:opacity-50"
                                        disabled={isLoadingLmStudioTrainingEmbeddingModels || !!lmStudioTrainingEmbeddingModelError || lmStudioTrainingEmbeddingModels.length === 0}>
                                        {isLoadingLmStudioTrainingEmbeddingModels && <option>Loading models...</option>}
                                        {!isLoadingLmStudioTrainingEmbeddingModels && !lmStudioTrainingEmbeddingModelError && lmStudioTrainingEmbeddingModels.length === 0 && <option>No models found</option>}
                                        {!isLoadingLmStudioTrainingEmbeddingModels && lmStudioTrainingEmbeddingModelError && <option>Error fetching models</option>}
                                        {lmStudioTrainingEmbeddingModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                    </select>
                                    {lmStudioTrainingEmbeddingModelError && <p className="text-xs text-red-400 mt-1">{lmStudioTrainingEmbeddingModelError}</p>}
                                </div>
                            ) : (
                                trainingEmbeddingModels.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1">Embedding Model</label>
                                        <select value={unit.trainingVector?.embedding?.model || ''} onChange={(e) => onUpdate({...unit, trainingVector: { ...(unit.trainingVector!), embedding: { ...(unit.trainingVector?.embedding!), model: e.target.value}}})} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                            {trainingEmbeddingModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                        </select>
                                    </div>
                                )
                            )}
                        </div>

                        <div className="space-y-4 p-4 bg-surface rounded-lg border border-border-color">
                            <h4 className="font-semibold text-text-primary">Vector Store Configuration</h4>
                             <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Vector Store Provider</label>
                                <select value={unit.trainingVector?.vectorStore?.provider || ''} onChange={(e) => handleVectorProviderChange(e, 'trainingVector')} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                    {VECTOR_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                </select>
                                {unit.trainingVector?.vectorStore?.provider && autoConfiguredVectorProviders.includes(unit.trainingVector.vectorStore.provider) ? (
                                     <div className="mt-2 text-sm text-text-secondary p-2 bg-surface-light border border-border-color rounded-md">Path: <code className="font-mono">{unit.trainingVector.vectorStore.path || 'N/A'}</code></div>
                                ) : (
                                    <ProviderConfigInput 
                                        provider={selectedTrainingVectorStoreProvider}
                                        value={selectedTrainingVectorStoreProvider?.type === 'cloud' ? unit.trainingVector?.vectorStore?.apiKey : unit.trainingVector?.vectorStore?.path}
                                        placeholder={selectedTrainingVectorStoreProvider?.type === 'cloud' ? 'Enter API Key...' : 'Enter Path...'}
                                        onChange={(e) => {
                                            const key = selectedTrainingVectorStoreProvider?.type === 'cloud' ? 'apiKey' : 'path';
                                            const currentVector = unit.trainingVector || defaultTrainingVector;
                                            onUpdate({
                                                ...unit,
                                                trainingVector: {
                                                    ...currentVector,
                                                    vectorStore: {
                                                        ...currentVector.vectorStore,
                                                        provider: currentVector.vectorStore.provider,
                                                        [key]: e.target.value,
                                                    }
                                                },
                                            });
                                        }}
                                    />
                                )}
                            </div>
                            
                            <TrainingVectorManager 
                                sources={unit.trainingVector?.sources || []}
                                onUpdateSources={handleTrainingSourcesUpdate}
                            />
                        </div>
                    </div>
                )}
            </Section>
            
            <Section title="Experience Vector" icon={<Icon name="chart-bar" className="w-5 h-5" />}>
                <div className="space-y-4">
                    <div className="text-sm text-text-secondary">
                        This unit's experience is managed by the Global Experience Embedding Engine on the <span className="font-bold text-text-primary">RF Arbiter</span> unit.
                    </div>
                    <div className="p-4 bg-surface rounded-lg border border-border-color space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-text-primary">Experience Neurons</span>
                            <span className="font-mono text-lg font-bold text-primary">{unit.experienceVector?.neurons?.length.toLocaleString() || 0}</span>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Vector Store Provider</label>
                            <select value={unit.experienceVector?.provider || ''} onChange={(e) => handleVectorProviderChange(e, 'experienceVector')} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                {VECTOR_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                             {unit.experienceVector?.provider && autoConfiguredVectorProviders.includes(unit.experienceVector.provider) ? (
                                <div className="mt-2 text-sm text-text-secondary p-2 bg-surface-light border border-border-color rounded-md">Path: <code className="font-mono">{unit.experienceVector.path || 'N/A'}</code></div>
                            ) : (
                                <ProviderConfigInput 
                                    provider={selectedExperienceProvider}
                                    value={selectedExperienceProvider?.type === 'cloud' ? unit.experienceVector?.apiKey : unit.experienceVector?.path}
                                    placeholder={selectedExperienceProvider?.type === 'cloud' ? 'Enter API Key...' : 'Enter Path...'}
                                    onChange={(e) => {
                                        const key = selectedExperienceProvider?.type === 'cloud' ? 'apiKey' : 'path';
                                        onUpdate({...unit, experienceVector: { ...(unit.experienceVector || { provider: '', neurons: [] }), [key]: e.target.value}});
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </Section>
            
            <Section title="Standard Database" icon={<Icon name="document-text" className="w-5 h-5" />}>
                <div className="flex items-center space-x-2 mb-4">
                    <input type="checkbox" id="db-enabled" checked={unit.standardDb?.enabled ?? false} onChange={e => onUpdate({...unit, standardDb: { ...(unit.standardDb || { provider: 'sqlite', enabled: false, path: '' }), enabled: e.target.checked}})} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="db-enabled" className="text-text-primary">Enable Standard Database</label>
                </div>
                {unit.standardDb?.enabled && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Database Provider</label>
                            <select value={unit.standardDb?.provider || ''} onChange={(e) => handleDbProviderChange(e, 'standardDb')} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                {DB_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                             {unit.standardDb?.provider && autoConfiguredDbProviders.includes(unit.standardDb.provider) ? (
                                <div className="mt-2 text-sm text-text-secondary p-2 bg-surface-light border border-border-color rounded-md">Path: <code className="font-mono">{unit.standardDb.path || 'N/A'}</code></div>
                            ) : (
                                <ProviderConfigInput 
                                    provider={selectedDbProvider}
                                    value={selectedDbProvider?.type === 'cloud' ? unit.standardDb?.apiKey : unit.standardDb?.path}
                                    placeholder={selectedDbProvider?.type === 'cloud' ? 'Enter API Key...' : 'Enter Path...'}
                                    onChange={(e) => {
                                        const key = selectedDbProvider?.type === 'cloud' ? 'apiKey' : 'path';
                                        onUpdate({...unit, standardDb: { ...(unit.standardDb || { provider: '', enabled: false, path: '' }), [key]: e.target.value}});
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}
            </Section>
            
            <Section title="Scale DB" icon={<Icon name="chart-bar" className="w-5 h-5" />}>
                <div className="flex items-center space-x-2 mb-4">
                    <input type="checkbox" id="scale-enabled" checked={unit.scaleDb?.enabled ?? false} onChange={e => onUpdate({...unit, scaleDb: { ...(unit.scaleDb || { provider: 'sqlite', enabled: false, values: [], path: '' }), enabled: e.target.checked}})} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="scale-enabled" className="text-text-primary">Enable Scale DB</label>
                </div>
                {unit.scaleDb?.enabled && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Database Provider</label>
                            <select value={unit.scaleDb.provider} onChange={(e) => handleDbProviderChange(e, 'scaleDb')} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                {DB_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                            {unit.scaleDb.provider && autoConfiguredDbProviders.includes(unit.scaleDb.provider) ? (
                                <div className="mt-2 text-sm text-text-secondary p-2 bg-surface-light border border-border-color rounded-md">Path: <code className="font-mono">{unit.scaleDb.path || 'N/A'}</code></div>
                            ) : (
                                <ProviderConfigInput 
                                    provider={selectedScaleProvider}
                                    value={selectedScaleProvider?.type === 'cloud' ? unit.scaleDb.apiKey : unit.scaleDb.path}
                                    placeholder={selectedScaleProvider?.type === 'cloud' ? 'Enter API Key...' : 'Enter Path...'}
                                    onChange={(e) => {
                                        const key = selectedScaleProvider?.type === 'cloud' ? 'apiKey' : 'path';
                                        onUpdate({...unit, scaleDb: { ...(unit.scaleDb || { provider: 'sqlite', enabled: false, values: [], path: '' }), [key]: e.target.value}});
                                    }}
                                />
                            )}
                        </div>
                        
                        <div className="pt-2 border-t border-border-color">
                        {unit.scaleDb.values && Array.isArray(unit.scaleDb.values) && unit.scaleDb.values.map((val, index) => (
                            <div key={val.id} className="p-3 bg-surface mt-2 rounded-lg border border-border-color space-y-3">
                                <div className="flex justify-between items-center">
                                   <input type="text" value={val.name} onChange={(e) => handleScaleValueChange(index, 'name', e.target.value)} className="font-semibold bg-transparent focus:outline-none"/>
                                    <button onClick={() => handleRemoveScaleValue(index)} className="text-text-secondary hover:text-red-500"><Icon name="trash" className="w-4 h-4" /></button>
                                </div>
                                <input type="range" min={val.min} max={val.max} value={val.score} onChange={(e) => handleScaleValueChange(index, 'score', parseFloat(e.target.value))} className="w-full h-2 bg-surface-light rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary" />
                                <div className="grid grid-cols-4 gap-2 text-sm">
                                    <div>
                                        <label className="text-xs text-text-secondary">Min</label>
                                        <input type="number" value={val.min} onChange={(e) => handleScaleValueChange(index, 'min', parseFloat(e.target.value))} className="w-full p-1 bg-surface-light rounded-md"/>
                                    </div>
                                     <div>
                                        <label className="text-xs text-text-secondary">Current</label>
                                        <input type="number" value={val.score} onChange={(e) => handleScaleValueChange(index, 'score', parseFloat(e.target.value))} className="w-full p-1 bg-surface-light rounded-md"/>
                                    </div>
                                     <div>
                                        <label className="text-xs text-text-secondary">Default</label>
                                        <input type="number" value={val.defaultValue} onChange={(e) => handleScaleValueChange(index, 'defaultValue', parseFloat(e.target.value))} className="w-full p-1 bg-surface-light rounded-md"/>
                                    </div>
                                     <div>
                                        <label className="text-xs text-text-secondary">Max</label>
                                        <input type="number" value={val.max} onChange={(e) => handleScaleValueChange(index, 'max', parseFloat(e.target.value))} className="w-full p-1 bg-surface-light rounded-md"/>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button onClick={handleAddScaleValue} className="w-full mt-4 p-2 bg-surface-light border border-dashed border-border-color rounded-md text-sm text-text-primary hover:bg-surface">Add Scale Value</button>
                        </div>
                    </div>
                )}
            </Section>

        </div>
    );
};

export default UnitDetailView;