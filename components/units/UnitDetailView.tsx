
import React from 'react';
import type { Unit, ScaleValue, Tool, RAGBase, Provider } from '../../types';
import { LLM_PROVIDERS, VECTOR_PROVIDERS, DB_PROVIDERS, RoomName } from '../../constants';
import Icon from '../ui/Icon';
import RAGBaseManager from './RAGBaseManager';

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
    
    const [lmStudioModels, setLmStudioModels] = React.useState<{ id: string; name: string; }[]>([]);
    const [isLoadingLmStudioModels, setIsLoadingLmStudioModels] = React.useState(false);
    const [lmStudioModelError, setLmStudioModelError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (unit.llmProvider.provider !== 'lmstudio' || !unit.llmProvider.path) {
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
                let path = unit.llmProvider.path;
                if (!path) throw new Error("Path is not defined.");
                if (!path.startsWith('http://') && !path.startsWith('https://')) path = 'http://' + path;
                
                const url = new URL(`${path}/v1/models`);
                const response = await fetch(url.toString(), { signal });
                
                if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
                const data = await response.json();
                if (!data.data || !Array.isArray(data.data)) throw new Error('Invalid response format from LM Studio server.');

                const models = data.data.map((model: any) => ({ id: model.id, name: model.id }));
                setLmStudioModels(models);

                if (models.length > 0 && !models.find(m => m.id === unit.llmProvider.model)) {
                    onUpdate({ ...unit, llmProvider: { ...unit.llmProvider, model: models[0].id } });
                } else if (models.length === 0 && unit.llmProvider.model) {
                     onUpdate({ ...unit, llmProvider: { ...unit.llmProvider, model: '' } });
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
    }, [unit.llmProvider.provider, unit.llmProvider.path, unit.llmProvider.model, onUpdate]);


    const handleLlmProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProviderId = e.target.value;
        const provider = LLM_PROVIDERS.find(p => p.id === newProviderId);
        const defaultModel = provider?.models?.[0];
        onUpdate({ ...unit, llmProvider: { ...unit.llmProvider, provider: newProviderId, model: defaultModel?.id || '', apiKey: '', path: '' }});
    };

    const handleVectorProviderChange = (e: React.ChangeEvent<HTMLSelectElement>, vectorType: 'trainingVector' | 'experienceVector') => {
        const newProviderId = e.target.value;
        const vectorConfig = unit[vectorType];
        let newPath = '';
        if (newProviderId === 'lancedb') {
            newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/${vectorType}.lancedb`;
        } else if (newProviderId === 'chromadb') {
            newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/${vectorType}_chromadb`;
        }
        onUpdate({ ...unit, [vectorType]: { ...vectorConfig, provider: newProviderId, path: newPath, apiKey: '' } } as unknown as Unit);
    };
    
    const handleDbProviderChange = (e: React.ChangeEvent<HTMLSelectElement>, dbType: 'standardDb' | 'scaleVector') => {
        const newProviderId = e.target.value;
        const dbConfig = unit[dbType];
        let newPath = '';
        if (newProviderId === 'sqlite' || newProviderId === 'duckdb') {
            if (dbType === 'standardDb') {
                newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/standard.${newProviderId === 'sqlite' ? 'db' : 'duckdb'}`;
            } else { // scaleVector
                newPath = `./aix_data/rooms/${roomId}/units/${unit.id}/scale_vector.${newProviderId === 'sqlite' ? 'sqlite' : 'duckdb'}`;
            }
        }
        onUpdate({ ...unit, [dbType]: { ...dbConfig, provider: newProviderId, path: newPath, apiKey: '' } } as Unit);
    };

    const handleToolToggle = (toolId: string) => {
        const hasTool = unit.tools.includes(toolId);
        const newTools = hasTool ? unit.tools.filter(id => id !== toolId) : [...unit.tools, toolId];
        onUpdate({ ...unit, tools: newTools });
    };

    const handleScaleValueChange = (index: number, field: keyof Omit<ScaleValue, 'id'>, value: string | number) => {
        const newValues = [...unit.scaleVector.values];
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
        onUpdate({ ...unit, scaleVector: { ...unit.scaleVector, values: newValues } });
    };

    const handleAddScaleValue = () => {
        const newValues = [...unit.scaleVector.values, { id: `sv-${Date.now()}`, name: 'New Metric', score: 50, min: 0, max: 100, defaultValue: 50 }];
        onUpdate({ ...unit, scaleVector: { ...unit.scaleVector, values: newValues } });
    };

    const handleRemoveScaleValue = (index: number) => {
        const newValues = unit.scaleVector.values.filter((_, i) => i !== index);
        onUpdate({ ...unit, scaleVector: { ...unit.scaleVector, values: newValues } });
    };

    const handleSchedulerChange = (field: keyof Unit['scheduler'], value: any) => {
        onUpdate({ ...unit, scheduler: { ...unit.scheduler, [field]: value } });
    };
    
    const isExemptFromLoopToggle = ['Admin Manager', 'Comms Chief'].includes(unit.name);

    const selectedLlmProvider = LLM_PROVIDERS.find(p => p.id === unit.llmProvider.provider);
    const selectedTrainingProvider = VECTOR_PROVIDERS.find(p => p.id === unit.trainingVector.provider);
    const selectedExperienceProvider = VECTOR_PROVIDERS.find(p => p.id === unit.experienceVector.provider);
    const selectedDbProvider = DB_PROVIDERS.find(p => p.id === unit.standardDb.provider);
    const selectedScaleProvider = DB_PROVIDERS.find(p => p.id === unit.scaleVector.provider);
    
    const staticModelOptions = selectedLlmProvider?.models || [];
    const autoConfiguredVectorProviders = ['lancedb', 'chromadb'];
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
                {!isExemptFromLoopToggle && (
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

            {activeRoomName === RoomName.Proactive && unit.scheduler && (
                <Section title="Task Scheduler" icon={<Icon name="clock" className="w-5 h-5" />} initiallyOpen={true}>
                    <div className="flex items-center space-x-2 mb-4">
                        <input type="checkbox" id="scheduler-enabled" checked={unit.scheduler.enabled} onChange={e => handleSchedulerChange('enabled', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                        <label htmlFor="scheduler-enabled" className="text-text-primary">Enable Scheduler</label>
                    </div>
                    {unit.scheduler.enabled && (
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
                    <select value={unit.llmProvider.provider} onChange={handleLlmProviderChange} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                        {LLM_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </select>
                     <ProviderConfigInput 
                        provider={selectedLlmProvider}
                        value={selectedLlmProvider?.type === 'cloud' ? unit.llmProvider.apiKey : unit.llmProvider.path}
                        placeholder={selectedLlmProvider?.type === 'cloud' ? 'Enter API Key...' : 'http://localhost:11434'}
                        onChange={(e) => onUpdate({...unit, llmProvider: {...unit.llmProvider, [selectedLlmProvider?.type === 'cloud' ? 'apiKey' : 'path']: e.target.value}})}
                    />
                </div>
                {unit.llmProvider.provider === 'lmstudio' ? (
                     <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Model</label>
                        <select 
                            value={unit.llmProvider.model} 
                            onChange={(e) => onUpdate({...unit, llmProvider: {...unit.llmProvider, model: e.target.value}})}
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
                    staticModelOptions.length > 0 && <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Model</label>
                        <select value={unit.llmProvider.model} onChange={(e) => onUpdate({...unit, llmProvider: {...unit.llmProvider, model: e.target.value}})} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                           {staticModelOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
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

            {unit.type.includes('RAG') && ragBase && (
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
                                checked={unit.tools.includes(tool.id)}
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
                    <input type="checkbox" id="training-enabled" checked={unit.trainingVector.enabled} onChange={e => onUpdate({...unit, trainingVector: {...unit.trainingVector, enabled: e.target.checked}})} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="training-enabled" className="text-text-primary">Enable Training Vector Space</label>
                </div>
                {unit.trainingVector.enabled && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Vector Provider</label>
                            <select value={unit.trainingVector.provider} onChange={(e) => handleVectorProviderChange(e, 'trainingVector')} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                                {VECTOR_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                            {autoConfiguredVectorProviders.includes(unit.trainingVector.provider) ? (
                                 <div className="mt-2 text-sm text-text-secondary p-2 bg-surface-light border border-border-color rounded-md">Path: <code className="font-mono">{unit.trainingVector.path}</code></div>
                            ) : (
                                <ProviderConfigInput 
                                    provider={selectedTrainingProvider}
                                    value={selectedTrainingProvider?.type === 'cloud' ? unit.trainingVector.apiKey : unit.trainingVector.path}
                                    placeholder={selectedTrainingProvider?.type === 'cloud' ? 'Enter API Key...' : 'Enter Path...'}
                                    onChange={(e) => onUpdate({...unit, trainingVector: {...unit.trainingVector, [selectedTrainingProvider?.type === 'cloud' ? 'apiKey' : 'path']: e.target.value}})}
                                />
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Neuron Count</label>
                            <p className="text-lg font-bold text-text-primary">{unit.trainingVector.neurons.toLocaleString()}</p>
                        </div>
                    </div>
                )}
            </Section>

            <Section title="Experience Vector Space" icon={<Icon name="database" className="w-5 h-5" />}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Vector Provider</label>
                         <select value={unit.experienceVector.provider} onChange={(e) => handleVectorProviderChange(e, 'experienceVector')} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                            {VECTOR_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                        {autoConfiguredVectorProviders.includes(unit.experienceVector.provider) ? (
                                <div className="mt-2 text-sm text-text-secondary p-2 bg-surface-light border border-border-color rounded-md">Path: <code className="font-mono">{unit.experienceVector.path}</code></div>
                        ) : (
                            <ProviderConfigInput 
                                provider={selectedExperienceProvider}
                                value={selectedExperienceProvider?.type === 'cloud' ? unit.experienceVector.apiKey : unit.experienceVector.path}
                                placeholder={selectedExperienceProvider?.type === 'cloud' ? 'Enter API Key...' : 'Enter Path...'}
                                onChange={(e) => onUpdate({...unit, experienceVector: {...unit.experienceVector, [selectedExperienceProvider?.type === 'cloud' ? 'apiKey' : 'path']: e.target.value}})}
                            />
                        )}
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Reinforcement Factor (RF)</label>
                        <div className="flex items-baseline space-x-2">
                            <p className="text-lg font-bold text-text-primary">{unit.experienceVector.rf}</p>
                            <span className="text-xs text-text-secondary italic">(Assigned by Room Manager)</span>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Standard Database" icon={<Icon name="database" className="w-5 h-5" />}>
                <div className="flex items-center space-x-2 mb-4">
                    <input type="checkbox" id="db-enabled" checked={unit.standardDb.enabled} onChange={e => onUpdate({...unit, standardDb: {...unit.standardDb, enabled: e.target.checked}})} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="db-enabled" className="text-text-primary">Enable Standard DB</label>
                </div>
                {unit.standardDb.enabled && (
                    <div className="space-y-4">
                         <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">DB Provider</label>
                            <select value={unit.standardDb.provider} onChange={(e) => handleDbProviderChange(e, 'standardDb')} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                                {DB_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                            {autoConfiguredDbProviders.includes(unit.standardDb.provider) ? (
                                <div className="mt-2 text-sm text-text-secondary p-2 bg-surface-light border border-border-color rounded-md">Path: <code className="font-mono">{unit.standardDb.path}</code></div>
                            ) : (
                                <ProviderConfigInput 
                                    provider={selectedDbProvider}
                                    value={selectedDbProvider?.type === 'cloud' ? unit.standardDb.apiKey : unit.standardDb.path}
                                    placeholder={selectedDbProvider?.type === 'cloud' ? 'Enter API Key...' : 'Enter Path...'}
                                    onChange={(e) => onUpdate({...unit, standardDb: {...unit.standardDb, [selectedDbProvider?.type === 'cloud' ? 'apiKey' : 'path']: e.target.value}})}
                                />
                            )}
                        </div>
                    </div>
                )}
            </Section>
            
            <Section title="Scale Vector" icon={<Icon name="chart-bar" className="w-5 h-5" />}>
                 <div className="flex items-center space-x-2 mb-4">
                    <input type="checkbox" id="scale-enabled" checked={unit.scaleVector.enabled} onChange={e => onUpdate({...unit, scaleVector: {...unit.scaleVector, enabled: e.target.checked}})} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="scale-enabled" className="text-text-primary">Enable Scale Vector</label>
                </div>
                 {unit.scaleVector.enabled && (
                    <div className="space-y-4">
                       <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">DB Provider</label>
                            <select value={unit.scaleVector.provider} onChange={(e) => handleDbProviderChange(e, 'scaleVector')} className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                                {DB_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                            {autoConfiguredDbProviders.includes(unit.scaleVector.provider) ? (
                                <div className="mt-2 text-sm text-text-secondary p-2 bg-surface-light border border-border-color rounded-md">Path: <code className="font-mono">{unit.scaleVector.path}</code></div>
                            ) : (
                                <ProviderConfigInput 
                                    provider={selectedScaleProvider}
                                    value={selectedScaleProvider?.type === 'cloud' ? unit.scaleVector.apiKey : unit.scaleVector.path}
                                    placeholder={selectedScaleProvider?.type === 'cloud' ? 'Enter API Key...' : 'Enter Path...'}
                                    onChange={(e) => onUpdate({...unit, scaleVector: {...unit.scaleVector, [selectedScaleProvider?.type === 'cloud' ? 'apiKey' : 'path']: e.target.value}})}
                                />
                            )}
                        </div>
                        <div className="space-y-3">
                            {unit.scaleVector.values.map((val, index) => (
                                <div key={val.id} className="p-2 rounded-md bg-surface-light">
                                    <div className="grid grid-cols-4 gap-2 items-center">
                                        <input type="text" value={val.name} onChange={e => handleScaleValueChange(index, 'name', e.target.value)} className="col-span-2 p-1 bg-surface border border-border-color rounded-md text-sm" />
                                        <input type="number" value={val.score} onChange={e => handleScaleValueChange(index, 'score', Number(e.target.value))} className="p-1 bg-surface border border-border-color rounded-md text-sm text-center" />
                                         <button onClick={() => handleRemoveScaleValue(index)} className="p-1 text-text-secondary hover:text-red-500 justify-self-end"><Icon name="trash" className="w-4 h-4" /></button>
                                    </div>
                                    <div className="col-span-4 mt-2">
                                        <input type="range" value={val.score} min={val.min} max={val.max} onChange={e => handleScaleValueChange(index, 'score', Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                     <div className="flex justify-between text-xs text-text-secondary mt-1">
                                         <input type="number" value={val.min} onChange={e => handleScaleValueChange(index, 'min', Number(e.target.value))} className="p-1 w-16 bg-surface border border-border-color rounded-md text-sm" />
                                         <input type="number" value={val.max} onChange={e => handleScaleValueChange(index, 'max', Number(e.target.value))} className="p-1 w-16 bg-surface border border-border-color rounded-md text-sm" />
                                     </div>
                                </div>
                            ))}
                        </div>
                         <button onClick={handleAddScaleValue} className="w-full text-sm p-2 bg-primary/20 text-primary rounded-md hover:bg-primary/30">Add Scale Value</button>
                    </div>
                )}
            </Section>
        </div>
    );
};

export default UnitDetailView;