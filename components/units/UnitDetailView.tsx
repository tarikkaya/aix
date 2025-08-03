import React, { useMemo } from 'react';
import type { Unit, ScaleValue, Tool, RAGBase, Provider, TrainingSource, ApiSettings, CloudConnection, LocalProviderConnection } from '../../types';
import { LLM_PROVIDERS, VECTOR_PROVIDERS, DB_PROVIDERS, RoomName, RERANKER_PROVIDERS } from '../../constants';
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

const CloudConnectionSelector: React.FC<{
    provider?: Provider;
    selectedConnectionId?: string;
    availableConnections: CloudConnection[];
    onChange: (connectionId: string) => void;
}> = ({ provider, selectedConnectionId, availableConnections, onChange }) => {
    if (!provider || provider.type !== 'cloud') return null;

    const relevantConnections = availableConnections.filter(c => c.providerId === provider.id);

    return (
        <div className="mt-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">Cloud Connection</label>
            <select
                value={selectedConnectionId || ''}
                onChange={e => onChange(e.target.value)}
                className="w-full p-2 bg-surface-light border border-border-color rounded-md"
            >
                <option value="">-- Select Connection --</option>
                {relevantConnections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
        </div>
    );
}

const LocalConnectionSelector: React.FC<{
    provider?: Provider;
    selectedConnectionId?: string;
    availableConnections: LocalProviderConnection[];
    onChange: (connectionId: string) => void;
}> = ({ provider, selectedConnectionId, availableConnections, onChange }) => {
    if (!provider || provider.type !== 'local') return null;

    const relevantConnections = availableConnections.filter(c => c.providerId === provider.id);

    return (
        <div className="mt-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">Local Connection</label>
            <select
                value={selectedConnectionId || ''}
                onChange={e => onChange(e.target.value)}
                className="w-full p-2 bg-surface-light border border-border-color rounded-md"
            >
                <option value="">-- Select Connection --</option>
                {relevantConnections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
        </div>
    );
};


const LocalPathInput: React.FC<{
    provider?: Provider;
    value?: string;
    placeholder: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ provider, value, placeholder, onChange }) => {
    // This component is for file-based local providers, not server-based ones.
    if (!provider || provider.type === 'cloud' || provider.type === 'local') return null;
    return (
        <div className="mt-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">Path</label>
            <input
                type="text"
                value={value || ''}
                placeholder={placeholder}
                onChange={onChange}
                readOnly
                className="w-full p-2 bg-surface border border-border-color rounded-md text-sm text-text-secondary cursor-not-allowed"
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
    apiSettings: ApiSettings;
}


const UnitDetailView: React.FC<UnitDetailViewProps> = (props) => {
    const {
        unit, onUpdate, roomId, allTools, ragBase,
        onUpdateRagBase, activeRoomName, apiSettings
    } = props;

    // State for LLM Provider
    const [lmStudioModels, setLmStudioModels] = React.useState<{ id: string; name: string; }[]>([]);
    const [isLoadingLmStudioModels, setIsLoadingLmStudioModels] = React.useState(false);
    const [lmStudioModelError, setLmStudioModelError] = React.useState<string | null>(null);
    
    const defaultTrainingVector = useMemo<Unit['trainingVector']>(() => ({
        enabled: false,
        vectorStore: {
            provider: 'lancedb',
            path: `./aix_data/rooms/${roomId}/units/${unit.id}/training_vector.lancedb`
        },
        neurons: 0,
        sources: []
    }), [roomId, unit.id]);

    // Effect for LLM Provider
    React.useEffect(() => {
        const llmProvider = unit.llmProvider;
        const connection = apiSettings.localProviderConnections.find(c => c.id === llmProvider.connectionId);

        if (llmProvider?.provider !== 'lmstudio' || !connection) {
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
                let path = connection.url;
                if (!path.startsWith('http://') && !path.startsWith('https://')) path = 'http://' + path;
                if (!path.endsWith('/')) path += '/';

                const url = new URL(`${path}v1/models`);
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
                if (!signal.aborted) {
                    setIsLoadingLmStudioModels(false);
                }
            }
        };

        const debounceTimeout = setTimeout(fetchModels, 500);
        return () => { clearTimeout(debounceTimeout); controller.abort(); };
    }, [unit.llmProvider.provider, unit.llmProvider.connectionId, apiSettings.localProviderConnections, onUpdate]);

    const handleLlmProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProviderId = e.target.value;
        const provider = LLM_PROVIDERS.find(p => p.id === newProviderId);
        const defaultModel = provider?.models?.[0];
        onUpdate({ ...unit, llmProvider: { provider: newProviderId, model: defaultModel?.id || '', connectionId: '' } });
    };

    const handleVectorProviderChange = (e: React.ChangeEvent<HTMLSelectElement>, vectorType: 'trainingVector' | 'experienceVector') => {
        const newProviderId = e.target.value;
        const provider = VECTOR_PROVIDERS.find(p => p.id === newProviderId);

        if (vectorType === 'trainingVector') {
            const currentVector = unit.trainingVector || defaultTrainingVector;
            let newPath;
            if (provider?.type !== 'cloud') {
                 newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/training_vector.${newProviderId}`;
            }
            onUpdate({
                ...unit,
                trainingVector: {
                    ...currentVector,
                    vectorStore: { provider: newProviderId, path: newPath, connectionId: '' },
                },
            });
        } else { // experienceVector
            const currentVector = unit.experienceVector || { provider: 'lancedb', neurons: [] };
            let newPath;
            if (provider?.type !== 'cloud') {
                newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/experience_vector.${newProviderId}`;
            }
            onUpdate({
                ...unit,
                experienceVector: {
                    ...currentVector,
                    provider: newProviderId,
                    path: newPath,
                    connectionId: '',
                },
            });
        }
    };

    const handleDbProviderChange = (e: React.ChangeEvent<HTMLSelectElement>, dbType: 'standardDb' | 'scaleDb') => {
        const newProviderId = e.target.value;
        const provider = DB_PROVIDERS.find(p => p.id === newProviderId);
        let newPath;

        if (dbType === 'standardDb') {
            if (provider?.type !== 'cloud') {
                 newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/standard.${newProviderId === 'sqlite' ? 'db' : 'duckdb'}`;
            }
            const currentDb = unit.standardDb || { enabled: false, provider: 'sqlite' };
            onUpdate({ ...unit, standardDb: { ...currentDb, provider: newProviderId, path: newPath, connectionId: '' } });
        } else { // scaleDb
            if (provider?.type !== 'cloud') {
                newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/scale_db.${newProviderId === 'sqlite' ? 'sqlite' : 'duckdb'}`;
            }
            const currentVector = unit.scaleDb || { enabled: false, provider: 'sqlite', values: [] };
            onUpdate({ ...unit, scaleDb: { ...currentVector, provider: newProviderId, path: newPath, connectionId: '' } });
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
    const selectedTrainingVectorStoreProvider = VECTOR_PROVIDERS.find(p => p.id === unit.trainingVector?.vectorStore?.provider);
    const selectedExperienceProvider = VECTOR_PROVIDERS.find(p => p.id === unit.experienceVector?.provider);
    const selectedDbProvider = DB_PROVIDERS.find(p => p.id === unit.standardDb?.provider);
    const selectedScaleProvider = DB_PROVIDERS.find(p => p.id === unit.scaleDb?.provider);

    const llmProviderModels = selectedLlmProvider?.models || [];
    
    return (
        <div className="space-y-4 pb-8">
            <div className="flex justify-between items-center">
                <input
                    type="text"
                    value={unit.name}
                    onChange={(e) => onUpdate({ ...unit, name: e.target.value })}
                    className="w-full bg-transparent text-2xl font-bold text-text-primary focus:outline-none focus:bg-surface p-2 rounded-md"
                />
                {!isExemptFromLoopToggle && selectedLlmProvider?.type === 'local' && (
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                        <Icon name="recycle" className="w-5 h-5" />
                        <span className="text-sm font-medium text-text-secondary">Loop:</span>
                        <label htmlFor="loop-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="loop-toggle" className="sr-only peer"
                                checked={unit.isLoopOpen}
                                onChange={(e) => onUpdate({ ...unit, isLoopOpen: e.target.checked })}
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
                    <CloudConnectionSelector
                        provider={selectedLlmProvider}
                        selectedConnectionId={unit.llmProvider?.connectionId}
                        availableConnections={apiSettings.cloudConnections}
                        onChange={(connectionId) => onUpdate({ ...unit, llmProvider: { ...(unit.llmProvider!), connectionId } })}
                    />
                    <LocalConnectionSelector
                        provider={selectedLlmProvider}
                        selectedConnectionId={unit.llmProvider.connectionId}
                        availableConnections={apiSettings.localProviderConnections}
                        onChange={(connectionId) => onUpdate({ ...unit, llmProvider: { ...unit.llmProvider, connectionId } })}
                    />
                </div>
                {unit.llmProvider?.provider === 'lmstudio' ? (
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Model</label>
                        <select
                            value={unit.llmProvider.model || ''}
                            onChange={(e) => onUpdate({ ...unit, llmProvider: { ...(unit.llmProvider!), model: e.target.value } })}
                            className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            disabled={isLoadingLmStudioModels || !!lmStudioModelError || lmStudioModels.length === 0}
                        >
                            {isLoadingLmStudioModels && <option>Loading models...</option>}
                            {!isLoadingLmStudioModels && !lmStudioModelError && lmStudioModels.length === 0 && <option>No models found at connection</option>}
                            {!isLoadingLmStudioModels && lmStudioModelError && <option>Error fetching models</option>}
                            {lmStudioModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                        {lmStudioModelError && <p className="text-xs text-red-400 mt-1">{lmStudioModelError}</p>}
                    </div>
                ) : (
                    llmProviderModels.length > 0 && <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Model</label>
                        <select value={unit.llmProvider?.model || ''} onChange={(e) => onUpdate({ ...unit, llmProvider: { ...(unit.llmProvider!), model: e.target.value } })} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
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

            {unit.type?.includes('RAG') && ragBase && (
                <Section title="Knowledge Base (RAG)" icon={<Icon name="database" className="w-5 h-5" />} initiallyOpen={true}>
                    <RAGBaseManager base={ragBase} onUpdate={onUpdateRagBase} apiSettings={apiSettings} />
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
                    <input type="checkbox" id="training-enabled" checked={unit.trainingVector?.enabled ?? false} onChange={e => onUpdate({ ...unit, trainingVector: { ...(unit.trainingVector || defaultTrainingVector), enabled: e.target.checked } })} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="training-enabled" className="text-text-primary">Enable Training Vector Space</label>
                </div>
                {unit.trainingVector?.enabled && (
                    <div className="space-y-4">
                         <div className="text-sm text-text-secondary">
                            This unit's training data is embedded using the framework's <span className="font-bold text-text-primary">Global Embedding Engine</span>.
                        </div>
                        <div className="space-y-4 p-4 bg-surface rounded-lg border border-border-color">
                            <h4 className="font-semibold text-text-primary">Vector Store Configuration</h4>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Vector Store Provider</label>
                                <select value={unit.trainingVector?.vectorStore?.provider || ''} onChange={(e) => handleVectorProviderChange(e, 'trainingVector')} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                    {VECTOR_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                </select>
                                <CloudConnectionSelector
                                    provider={selectedTrainingVectorStoreProvider}
                                    selectedConnectionId={unit.trainingVector.vectorStore.connectionId}
                                    availableConnections={apiSettings.cloudConnections}
                                    onChange={(connectionId) => onUpdate({ ...unit, trainingVector: { ...unit.trainingVector!, vectorStore: { ...unit.trainingVector!.vectorStore, connectionId } } })}
                                />
                                <LocalPathInput
                                    provider={selectedTrainingVectorStoreProvider}
                                    value={unit.trainingVector.vectorStore.path}
                                    placeholder="Auto-configured path"
                                    onChange={(e) => onUpdate({ ...unit, trainingVector: { ...unit.trainingVector!, vectorStore: { ...unit.trainingVector!.vectorStore, path: e.target.value } } })}
                                />
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
                        This unit's experience is embedded using the framework's <span className="font-bold text-text-primary">Global Embedding Engine</span> and managed by the <span className="font-bold text-text-primary">RF Arbiter</span> unit.
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
                            <CloudConnectionSelector
                                provider={selectedExperienceProvider}
                                selectedConnectionId={unit.experienceVector.connectionId}
                                availableConnections={apiSettings.cloudConnections}
                                onChange={(connectionId) => onUpdate({ ...unit, experienceVector: { ...unit.experienceVector!, connectionId } })}
                            />
                            <LocalPathInput
                                provider={selectedExperienceProvider}
                                value={unit.experienceVector.path}
                                placeholder="Auto-configured path"
                                onChange={(e) => onUpdate({ ...unit, experienceVector: { ...unit.experienceVector!, path: e.target.value } })}
                            />
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Standard Database" icon={<Icon name="document-text" className="w-5 h-5" />}>
                <div className="flex items-center space-x-2 mb-4">
                    <input type="checkbox" id="db-enabled" checked={unit.standardDb?.enabled ?? false} onChange={e => onUpdate({ ...unit, standardDb: { ...(unit.standardDb || { provider: 'sqlite', enabled: false }), enabled: e.target.checked } })} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="db-enabled" className="text-text-primary">Enable Standard Database</label>
                </div>
                {unit.standardDb?.enabled && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Database Provider</label>
                            <select value={unit.standardDb?.provider || ''} onChange={(e) => handleDbProviderChange(e, 'standardDb')} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                {DB_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                             <CloudConnectionSelector
                                provider={selectedDbProvider}
                                selectedConnectionId={unit.standardDb.connectionId}
                                availableConnections={apiSettings.cloudConnections}
                                onChange={(connectionId) => onUpdate({ ...unit, standardDb: { ...unit.standardDb!, connectionId } })}
                            />
                            <LocalPathInput
                                provider={selectedDbProvider}
                                value={unit.standardDb.path}
                                placeholder="Auto-configured path"
                                onChange={(e) => onUpdate({ ...unit, standardDb: { ...unit.standardDb!, path: e.target.value } })}
                            />
                        </div>
                    </div>
                )}
            </Section>

            <Section title="Scale DB" icon={<Icon name="chart-bar" className="w-5 h-5" />}>
                <div className="flex items-center space-x-2 mb-4">
                    <input type="checkbox" id="scale-enabled" checked={unit.scaleDb?.enabled ?? false} onChange={e => onUpdate({ ...unit, scaleDb: { ...(unit.scaleDb || { provider: 'sqlite', enabled: false, values: [] }), enabled: e.target.checked } })} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="scale-enabled" className="text-text-primary">Enable Scale DB</label>
                </div>
                {unit.scaleDb?.enabled && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Database Provider</label>
                            <select value={unit.scaleDb.provider} onChange={(e) => handleDbProviderChange(e, 'scaleDb')} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                {DB_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                            <CloudConnectionSelector
                                provider={selectedScaleProvider}
                                selectedConnectionId={unit.scaleDb.connectionId}
                                availableConnections={apiSettings.cloudConnections}
                                onChange={(connectionId) => onUpdate({ ...unit, scaleDb: { ...unit.scaleDb!, connectionId } })}
                            />
                            <LocalPathInput
                                provider={selectedScaleProvider}
                                value={unit.scaleDb.path}
                                placeholder="Auto-configured path"
                                onChange={(e) => onUpdate({ ...unit, scaleDb: { ...unit.scaleDb!, path: e.target.value } })}
                            />
                        </div>

                        <div className="pt-2 border-t border-border-color">
                            {unit.scaleDb.values && Array.isArray(unit.scaleDb.values) && unit.scaleDb.values.map((val, index) => (
                                <div key={val.id} className="p-3 bg-surface mt-2 rounded-lg border border-border-color space-y-3">
                                    <div className="flex justify-between items-center">
                                        <input type="text" value={val.name} onChange={(e) => handleScaleValueChange(index, 'name', e.target.value)} className="font-semibold bg-transparent focus:outline-none" />
                                        <button onClick={() => handleRemoveScaleValue(index)} className="text-text-secondary hover:text-red-500"><Icon name="trash" className="w-4 h-4" /></button>
                                    </div>
                                    <input type="range" min={val.min} max={val.max} value={val.score} onChange={(e) => handleScaleValueChange(index, 'score', parseFloat(e.target.value))} className="w-full h-2 bg-surface-light rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary" />
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="grid grid-cols-2 items-center gap-1">
                                            <label className="text-text-secondary">Min:</label>
                                            <input type="number" value={val.min} onChange={(e) => handleScaleValueChange(index, 'min', parseFloat(e.target.value))} className="p-1 bg-surface-light border border-border-color rounded-md w-full" />
                                        </div>
                                        <div className="grid grid-cols-2 items-center gap-1">
                                            <label className="text-text-secondary">Max:</label>
                                            <input type="number" value={val.max} onChange={(e) => handleScaleValueChange(index, 'max', parseFloat(e.target.value))} className="p-1 bg-surface-light border border-border-color rounded-md w-full" />
                                        </div>
                                        <div className="grid grid-cols-2 items-center gap-1">
                                            <label className="text-text-secondary">Score:</label>
                                            <input type="number" value={val.score} onChange={(e) => handleScaleValueChange(index, 'score', parseFloat(e.target.value))} className="p-1 bg-surface-light border border-border-color rounded-md w-full" />
                                        </div>
                                        <div className="grid grid-cols-2 items-center gap-1">
                                            <label className="text-text-secondary">Default:</label>
                                            <input type="number" value={val.defaultValue} onChange={(e) => handleScaleValueChange(index, 'defaultValue', parseFloat(e.target.value))} className="p-1 bg-surface-light border border-border-color rounded-md w-full" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button onClick={handleAddScaleValue} className="mt-4 w-full text-sm p-2 bg-surface hover:bg-surface-light border border-border-color rounded-md">Add Metric</button>
                        </div>
                    </div>
                )}
            </Section>

        </div>
    );
};

export default UnitDetailView;
