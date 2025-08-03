import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import { useTheme } from '../context/ThemeContext';
import type { ApiSettings, ApiKey, InputDevice, Room, CloudConnection, Provider, GlobalEmbeddingSettings, LocalProviderConnection } from '../../types';
import { generateSecureApiKey } from '../../App';
import { RoomName, LLM_PROVIDERS, VECTOR_PROVIDERS, DB_PROVIDERS, RERANKER_PROVIDERS } from '../../constants';

interface AddConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (connection: CloudConnection) => void;
}

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

const AddCloudConnectionModal: React.FC<AddConnectionModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [name, setName] = useState('');
    const [providerId, setProviderId] = useState('openai');
    const [keyValue, setKeyValue] = useState('');
    const [url, setUrl] = useState('');
    const [environment, setEnvironment] = useState('');
    
    const allProviders = [...LLM_PROVIDERS, ...VECTOR_PROVIDERS, ...DB_PROVIDERS, ...RERANKER_PROVIDERS]
        .filter(p => p.type === 'cloud')
        .filter((provider, index, self) => index === self.findIndex(p => p.id === provider.id)); // Deduplicate

    const selectedProvider = allProviders.find(p => p.id === providerId);
    
    const needsUrl = selectedProvider?.id === 'supabase' || selectedProvider?.id === 'turso';
    const needsEnvironment = selectedProvider?.id === 'pinecone';

    const handleSubmit = () => {
        if (!name.trim() || !keyValue.trim() || (needsUrl && !url.trim()) || (needsEnvironment && !environment.trim())) {
            alert("Please fill out all required fields for the selected provider.");
            return;
        }
        const newConnection: CloudConnection = {
            id: window.crypto.randomUUID(),
            name,
            providerId,
            key: keyValue,
            url: needsUrl ? url : undefined,
            environment: needsEnvironment ? environment : undefined,
            createdAt: new Date().toISOString()
        };
        onAdd(newConnection);
        onClose();
        setName('');
        setProviderId('openai');
        setKeyValue('');
        setUrl('');
        setEnvironment('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Cloud Connection">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Connection Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., My Personal Pinecone" className="w-full p-2 bg-surface border border-border-color rounded-md" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Provider</label>
                    <select value={providerId} onChange={e => setProviderId(e.target.value)} className="w-full p-2 bg-surface border border-border-color rounded-md">
                        {allProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">API Key</label>
                     <input type="password" value={keyValue} onChange={e => setKeyValue(e.target.value)} placeholder="Enter key value..." className="w-full p-2 bg-surface border border-border-color rounded-md" />
                </div>
                {needsUrl && (
                     <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Project URL</label>
                        <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="e.g., https://xyz.supabase.co" className="w-full p-2 bg-surface border border-border-color rounded-md" />
                    </div>
                )}
                {needsEnvironment && (
                     <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Environment</label>
                        <input type="text" value={environment} onChange={e => setEnvironment(e.target.value)} placeholder="e.g., gcp-starter" className="w-full p-2 bg-surface border border-border-color rounded-md" />
                    </div>
                )}
                <div className="flex justify-end space-x-2 pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md bg-surface-light hover:bg-surface">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/80">Add Connection</button>
                </div>
            </div>
        </Modal>
    )
}

interface AddLocalConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (connection: LocalProviderConnection) => void;
}

const AddLocalConnectionModal: React.FC<AddLocalConnectionModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [name, setName] = useState('');
    const [providerId, setProviderId] = useState('ollama');
    const [url, setUrl] = useState('http://localhost:11434');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
    
    const allLocalProviders = [...LLM_PROVIDERS, ...RERANKER_PROVIDERS]
        .filter(p => p.type === 'local')
        .filter((provider, index, self) => index === self.findIndex(p => p.id === provider.id)); // Deduplicate

    const handleTestConnection = async () => {
        if (providerId !== 'lmstudio') return;
        setTestStatus('testing');
        try {
            let testUrl = url;
            if (!testUrl.startsWith('http')) testUrl = 'http://' + testUrl;
            const res = await fetch(`${testUrl}/v1/models`, { method: 'GET' });
            if (res.ok) {
                setTestStatus('success');
            } else {
                setTestStatus('failed');
            }
        } catch (error) {
            setTestStatus('failed');
        }
    };
    
    useEffect(() => {
        setTestStatus('idle');
    }, [url, providerId]);

    const handleSubmit = () => {
        if (!name.trim() || !url.trim()) {
            alert("Please provide a name and URL for the connection.");
            return;
        }
        const newConnection: LocalProviderConnection = {
            id: window.crypto.randomUUID(),
            name,
            providerId,
            url,
            createdAt: new Date().toISOString()
        };
        onAdd(newConnection);
        onClose();
        setName('');
        setProviderId('ollama');
        setUrl('http://localhost:11434');
        setTestStatus('idle');
    };

    const getTestButton = () => {
        switch(testStatus) {
            case 'testing': return <><Icon name="spinner" className="w-4 h-4 animate-spin"/> Testing...</>;
            case 'success': return <><Icon name="check-mark" className="w-4 h-4"/> Success</>;
            case 'failed': return <><Icon name="x-mark" className="w-4 h-4"/> Failed</>;
            default: return 'Test Connection';
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Local Provider Connection">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Connection Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., My Local Ollama" className="w-full p-2 bg-surface border border-border-color rounded-md" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Provider</label>
                    <select value={providerId} onChange={e => setProviderId(e.target.value)} className="w-full p-2 bg-surface border border-border-color rounded-md">
                        {allLocalProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Server URL</label>
                     <div className="flex space-x-2">
                        <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="http://localhost:11434" className="w-full p-2 bg-surface border border-border-color rounded-md" />
                        {providerId === 'lmstudio' && (
                            <button 
                                onClick={handleTestConnection}
                                disabled={testStatus === 'testing'}
                                className={`flex items-center space-x-2 px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors
                                    ${testStatus === 'success' ? 'bg-green-600' : testStatus === 'failed' ? 'bg-red-600' : 'bg-surface-light hover:bg-border-color'}
                                    text-white disabled:opacity-70`}
                            >
                                {getTestButton()}
                            </button>
                        )}
                     </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md bg-surface-light hover:bg-surface">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/80">Add Connection</button>
                </div>
            </div>
        </Modal>
    )
}


interface HeaderProps {
    apiSettings: ApiSettings;
    onApiSettingsChange: (settings: ApiSettings) => void;
    onAddApiKey: (key: ApiKey) => void;
    keyToDelete: ApiKey | null;
    onRequestDeleteApiKey: (keyId: string) => void;
    onConfirmDeleteApiKey: () => void;
    onCancelDeleteApiKey: () => void;
    connectionToDelete: CloudConnection | null;
    onAddCloudConnection: (connection: CloudConnection) => void;
    onRequestDeleteCloudConnection: (connectionId: string) => void;
    onConfirmDeleteCloudConnection: () => void;
    onCancelDeleteCloudConnection: () => void;
    localConnectionToDelete: LocalProviderConnection | null;
    onAddLocalProviderConnection: (connection: LocalProviderConnection) => void;
    onRequestDeleteLocalProviderConnection: (connectionId: string) => void;
    onConfirmDeleteLocalProviderConnection: () => void;
    onCancelDeleteLocalProviderConnection: () => void;
    onApiPortChange: (port: string) => void;
    audioDevices: InputDevice[];
    audioOutputDevices: InputDevice[];
    onMicChange: (micId: string) => void;
    onSpeakerChange: (speakerId: string) => void;
    onPttKeyChange: (key: string) => void;
    onNoiseSuppressionChange: (enabled: boolean) => void;
    onWebhookUrlChange: (url: string) => void;
    onMicGainChange: (gain: number) => void;
    onSpeakerGainChange: (gain: number) => void;
    rooms: Room[];
    onResetToDefaults: () => void;
    isResetModalOpen: boolean;
    onConfirmReset: () => void;
    onCancelReset: () => void;
    outputVolumeLevel: number;
    micVolumeLevel: number;
    onPlayTestTone: () => void;
}

const Header: React.FC<HeaderProps> = (props) => {
    const { 
        apiSettings, onApiSettingsChange, onAddApiKey, keyToDelete, onRequestDeleteApiKey, 
        onConfirmDeleteApiKey, onCancelDeleteApiKey, connectionToDelete, onAddCloudConnection,
        onRequestDeleteCloudConnection, onConfirmDeleteCloudConnection, onCancelDeleteCloudConnection,
        localConnectionToDelete, onAddLocalProviderConnection, onRequestDeleteLocalProviderConnection,
        onConfirmDeleteLocalProviderConnection, onCancelDeleteLocalProviderConnection,
        onApiPortChange, audioDevices,
        audioOutputDevices, onMicChange, onSpeakerChange, onPttKeyChange,
        onNoiseSuppressionChange, onWebhookUrlChange, onMicGainChange, onSpeakerGainChange, 
        rooms, onResetToDefaults, isResetModalOpen, onConfirmReset, onCancelReset,
        outputVolumeLevel, micVolumeLevel, onPlayTestTone
    } = props;
    const { theme, setTheme, availableThemes } = useTheme();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKey | null>(null);
    const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
    const [isAddCloudConnectionModalOpen, setIsAddCloudConnectionModalOpen] = useState(false);
    const [isAddLocalConnectionModalOpen, setIsAddLocalConnectionModalOpen] = useState(false);
    const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
    const [isSettingPttKey, setIsSettingPttKey] = useState(false);
    
    const [embeddingLmStudioModels, setEmbeddingLmStudioModels] = useState<{ id: string; name: string; }[]>([]);
    const [isLoadingEmbeddingLmStudioModels, setIsLoadingEmbeddingLmStudioModels] = useState(false);
    const [embeddingLmStudioModelError, setEmbeddingLmStudioModelError] = useState<string | null>(null);

    useEffect(() => {
        if (!isSettingPttKey) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            
            if (e.key === 'Escape') {
                setIsSettingPttKey(false);
                return;
            }

            let keyString = e.key;
            if (e.key === ' ') keyString = 'Space';
            if (e.ctrlKey && !['Control', 'Alt', 'Shift'].includes(e.key)) keyString = `Ctrl+${keyString}`;
            if (e.altKey && !['Control', 'Alt', 'Shift'].includes(e.key)) keyString = `Alt+${keyString}`;
            if (e.shiftKey && !['Control', 'Alt', 'Shift'].includes(e.key)) keyString = `Shift+${keyString}`;
            onPttKeyChange(keyString);
            setIsSettingPttKey(false);
        };
        const handleClickOutside = (e: MouseEvent) => {
             setIsSettingPttKey(false);
        }
        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          window.removeEventListener('keydown', handleKeyDown);
          document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isSettingPttKey, onPttKeyChange]);


    const handleCopy = (key: string, id: string) => {
        navigator.clipboard.writeText(key);
        setCopiedKeyId(id);
        setTimeout(() => setCopiedKeyId(null), 2000);
    };

    const handleCreateNewKey = () => {
        const newKey: ApiKey = { id: window.crypto.randomUUID(), key: generateSecureApiKey(), createdAt: new Date().toISOString() };
        setNewlyCreatedKey(newKey);
        setIsNewKeyModalOpen(true);
    };

    const handleCloseNewKeyModal = () => {
        if (newlyCreatedKey) onAddApiKey(newlyCreatedKey);
        setIsNewKeyModalOpen(false);
        setNewlyCreatedKey(null);
    };

    const handleEmbeddingSettingsChange = useCallback((updates: Partial<GlobalEmbeddingSettings>) => {
        const newSettings = { ...apiSettings.globalEmbeddingSettings, ...updates };
        onApiSettingsChange({ ...apiSettings, globalEmbeddingSettings: newSettings });
    }, [apiSettings, onApiSettingsChange]);

    useEffect(() => {
        const embeddingSettings = apiSettings.globalEmbeddingSettings;
        const connectionId = embeddingSettings.connectionId;
        const connection = apiSettings.localProviderConnections.find(c => c.id === connectionId);
        
        if (embeddingSettings?.provider !== 'lmstudio' || !connection) {
            setEmbeddingLmStudioModels([]);
            setEmbeddingLmStudioModelError(null);
            return;
        }

        const controller = new AbortController();
        const signal = controller.signal;

        const fetchModels = async () => {
            setIsLoadingEmbeddingLmStudioModels(true);
            setEmbeddingLmStudioModelError(null);
            setEmbeddingLmStudioModels([]);

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
                setEmbeddingLmStudioModels(models);

                if (models.length > 0 && !models.some(m => m.id === embeddingSettings.model)) {
                    handleEmbeddingSettingsChange({ model: models[0].id });
                } else if (models.length === 0 && embeddingSettings.model) {
                    handleEmbeddingSettingsChange({ model: '' });
                }

            } catch (error) {
                if (error instanceof Error && error.name !== 'AbortError') {
                    setEmbeddingLmStudioModelError('Failed to fetch models. Check URL and server status.');
                }
            } finally {
                if (!signal.aborted) {
                    setIsLoadingEmbeddingLmStudioModels(false);
                }
            }
        };

        const debounceTimeout = setTimeout(fetchModels, 500);
        return () => { clearTimeout(debounceTimeout); controller.abort(); };
    }, [apiSettings.globalEmbeddingSettings.provider, apiSettings.globalEmbeddingSettings.connectionId, apiSettings.localProviderConnections, handleEmbeddingSettingsChange]);

    const handleEmbeddingProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProviderId = e.target.value;
        const provider = LLM_PROVIDERS.find(p => p.id === newProviderId);
        const defaultModel = provider?.embeddingModels?.[0]?.id || '';
        handleEmbeddingSettingsChange({
            provider: newProviderId,
            model: defaultModel,
            connectionId: '',
        });
    };
    
    const soundRoom = rooms.find(r => r.name === RoomName.Sound);

    const fullEndpoint = `http://localhost:${apiSettings.apiPort}/v1/chat/completions`;
    const curlExample = `curl ${fullEndpoint} \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -F 'message={"text": "What is being said in this recording?"}' \\
  -F 'files=@"/path/to/your/audio.mp3"'`;

    const webhookPayloadExample = `{
  "sourceUnit": "Text-to-Speech Synthesizer",
  "timestamp": "2024-05-21T10:30:00Z",
  "audioFile": {
    "name": "response_1716287400000.mp3",
    "type": "audio/mpeg",
    "content": "<Base64 encoded audio data>"
  }
}`;
    
    const allCloudProviders = [...LLM_PROVIDERS, ...VECTOR_PROVIDERS, ...DB_PROVIDERS];
    const allLocalProviders = [...LLM_PROVIDERS, ...RERANKER_PROVIDERS];
    const selectedEmbeddingProvider = LLM_PROVIDERS.find(p => p.id === apiSettings.globalEmbeddingSettings.provider);
    const embeddingModels = selectedEmbeddingProvider?.embeddingModels || [];

    return (
        <>
            <header className="flex items-center justify-between p-2 border-b border-border-color flex-shrink-0">
                <div />
                <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-surface-light transition-colors" aria-label="Open Settings">
                    <Icon name="adjustments-horizontal" className="w-6 h-6 text-text-secondary" />
                </button>
            </header>

            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Theme</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {availableThemes.map(t => <button key={t.name} onClick={() => setTheme(t)} className={`p-2 rounded-md border-2 ${theme.name === t.name ? 'border-primary' : 'border-border-color'}`}>{t.name}</button>)}
                  </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">Global Embedding Engine</h3>
                     <div className="bg-surface p-4 rounded-lg border border-border-color space-y-4">
                        <p className="text-sm text-text-secondary">This single engine is used for all embedding tasks across the framework, including training vectors, RAG, and experience neurons.</p>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Embedding Provider</label>
                            <select value={apiSettings.globalEmbeddingSettings.provider} onChange={handleEmbeddingProviderChange} className="w-full p-2 bg-surface-light border border-border-color rounded-md">
                                {LLM_PROVIDERS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Embedding Model</label>
                            {selectedEmbeddingProvider?.id === 'lmstudio' ? (
                                <>
                                    <select
                                        value={apiSettings.globalEmbeddingSettings.model || ''}
                                        onChange={e => handleEmbeddingSettingsChange({ model: e.target.value })}
                                        className="w-full p-2 bg-surface-light border border-border-color rounded-md disabled:opacity-50"
                                        disabled={isLoadingEmbeddingLmStudioModels || !!embeddingLmStudioModelError || embeddingLmStudioModels.length === 0}
                                    >
                                        {isLoadingEmbeddingLmStudioModels && <option>Loading models...</option>}
                                        {!isLoadingEmbeddingLmStudioModels && !embeddingLmStudioModelError && embeddingLmStudioModels.length === 0 && <option>No models found at address</option>}
                                        {!isLoadingEmbeddingLmStudioModels && embeddingLmStudioModelError && <option>Error fetching models</option>}
                                        {embeddingLmStudioModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                    </select>
                                    {embeddingLmStudioModelError && (
                                        <p className="text-xs text-red-400 mt-1">{embeddingLmStudioModelError}</p>
                                    )}
                                </>
                            ) : (
                                embeddingModels.length > 0 ? (
                                    <select
                                        value={apiSettings.globalEmbeddingSettings.model}
                                        onChange={e => handleEmbeddingSettingsChange({ model: e.target.value })}
                                        className="w-full p-2 bg-surface-light border border-border-color rounded-md"
                                    >
                                        {embeddingModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                    </select>
                                ) : (
                                     <div className="text-xs text-text-secondary p-2 bg-surface-light border border-border-color rounded-md">
                                        No embedding models listed for this provider.
                                     </div>
                                )
                            )}
                        </div>
                         <CloudConnectionSelector
                            provider={selectedEmbeddingProvider}
                            selectedConnectionId={apiSettings.globalEmbeddingSettings.connectionId}
                            availableConnections={apiSettings.cloudConnections}
                            onChange={(connectionId) => handleEmbeddingSettingsChange({ connectionId })}
                        />
                         <LocalConnectionSelector
                            provider={selectedEmbeddingProvider}
                            selectedConnectionId={apiSettings.globalEmbeddingSettings.connectionId}
                            availableConnections={apiSettings.localProviderConnections}
                            onChange={(connectionId) => handleEmbeddingSettingsChange({ connectionId })}
                        />
                     </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Sound Processing Pipeline</h3>
                  <div className="bg-surface p-4 rounded-lg border border-border-color space-y-4">
                    
                    {/* --- INPUT STAGE --- */}
                    <div className="space-y-4 p-3 bg-surface-light/50 rounded-lg border border-border-color">
                        <h4 className="text-base font-semibold text-text-primary mb-2 text-center">Input Stage</h4>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Microphone Source</label>
                            <select value={apiSettings.micId || ''} onChange={(e) => onMicChange(e.target.value)} className="w-full p-2 bg-surface-light border border-border-color rounded-md" disabled={audioDevices.length === 0}>
                                {audioDevices.length > 0 ? audioDevices.map(d => <option key={d.id} value={d.id}>{d.name}</option>) : <option>No microphones found</option>}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="mic-volume" className="block text-sm font-medium text-text-secondary mb-1">Mic Volume</label>
                            <div className="flex items-center space-x-3"><Icon name="microphone" className="w-5 h-5 text-text-secondary" /><input id="mic-volume" type="range" min="0" max="2" step="0.1" value={apiSettings.micGain} onChange={(e) => onMicGainChange(parseFloat(e.target.value))} className="w-full h-2 bg-surface-light rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary" /></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Live Input Level</label>
                            <div className="w-full bg-surface-light rounded-full h-4 p-0.5 border border-border-color overflow-hidden"><div className="bg-primary h-full rounded-full transition-all duration-75" style={{ width: `${Math.min(100, (micVolumeLevel / 140) * 100)}%` }}></div></div>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                           <input type="checkbox" id="noise-suppression" checked={apiSettings.noiseSuppression} onChange={e => onNoiseSuppressionChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary bg-surface-light" />
                           <label htmlFor="noise-suppression" className="text-sm font-medium text-text-primary">Noise Suppression</label>
                        </div>
                    </div>
                    
                    <div className="flex justify-center items-center text-text-secondary"><Icon name="chevron-down" className="w-6 h-6" /></div>

                    {/* --- PROCESSING STAGE --- */}
                    <div className="space-y-4 p-3 bg-surface-light/50 rounded-lg border border-border-color">
                        <h4 className="text-base font-semibold text-text-primary mb-2 text-center">Sound Room Processing Core</h4>
                        <div className="space-y-2">
                           {soundRoom && soundRoom.units.map(unit => (
                               <div key={unit.id} className="flex items-center space-x-3 p-2 bg-surface rounded-md">
                                   <Icon name="wrench-screwdriver" className="w-5 h-5 text-primary"/>
                                   <span className="text-sm font-medium text-text-primary">{unit.name}</span>
                               </div>
                           ))}
                           {(!soundRoom || soundRoom.units.length === 0) && (
                                <p className="text-center text-sm text-text-secondary py-2">No processing units found in the Sound Room.</p>
                           )}
                        </div>
                    </div>

                    <div className="flex justify-center items-center text-text-secondary"><Icon name="chevron-down" className="w-6 h-6" /></div>

                    {/* --- OUTPUT STAGE --- */}
                     <div className="space-y-4 p-3 bg-surface-light/50 rounded-lg border border-border-color">
                        <h4 className="text-base font-semibold text-text-primary mb-2 text-center">Output Stage</h4>
                         <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Output Device (Speakers)</label>
                            <select value={apiSettings.speakerId || ''} onChange={(e) => onSpeakerChange(e.target.value)} className="w-full p-2 bg-surface-light border border-border-color rounded-md" disabled={audioOutputDevices.length === 0}>
                                {audioOutputDevices.length > 0 ? audioOutputDevices.map(d => <option key={d.id} value={d.id}>{d.name}</option>) : <option>No speakers found</option>}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="speaker-volume" className="block text-sm font-medium text-text-secondary mb-1">Output Volume</label>
                            <div className="flex items-center space-x-3"><Icon name="speaker-wave" className="w-5 h-5 text-text-secondary" /><input id="speaker-volume" type="range" min="0" max="1.5" step="0.05" value={apiSettings.speakerGain} onChange={(e) => onSpeakerGainChange(parseFloat(e.target.value))} className="w-full h-2 bg-surface-light rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary" /></div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Live Output Level</label>
                            <div className="w-full bg-surface-light rounded-full h-4 p-0.5 border border-border-color overflow-hidden"><div className="bg-green-500 h-full rounded-full transition-all duration-75" style={{ width: `${Math.min(100, outputVolumeLevel)}%` }}></div></div>
                        </div>
                        <div className="flex items-center space-x-2 pt-2 justify-center">
                            <button onClick={onPlayTestTone} className="text-sm p-2 bg-surface hover:bg-surface-light border border-border-color rounded-md">Play Test Tone</button>
                        </div>
                    </div>
                  </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">Push-to-Talk & Webhooks</h3>
                    <div className="bg-surface p-4 rounded-lg border border-border-color space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Push-to-Talk Key</label>
                            <button onClick={() => setIsSettingPttKey(true)} className="w-full p-2 bg-surface-light border border-border-color rounded-md text-left">
                                {isSettingPttKey ? 'Press any key...' : (apiSettings.pushToTalkKey || 'Not set')}
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Soundcast Webhook URL</label>
                            <input type="text" value={apiSettings.webhookUrl || ''} onChange={(e) => onWebhookUrlChange(e.target.value)} placeholder="https://your-service.com/webhook" className="w-full p-2 bg-surface-light border border-border-color rounded-md"/>
                             {apiSettings.webhookUrl && (
                                <>
                                <p className="text-xs text-text-secondary mt-2">Example webhook payload:</p>
                                <pre className="text-xs p-2 bg-surface rounded-md mt-1 overflow-x-auto"><code>{webhookPayloadExample}</code></pre>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">API Configuration</h3>
                  <div className="bg-surface p-4 rounded-lg border border-border-color space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">API Port</label>
                            <input type="text" value={apiSettings.apiPort} onChange={(e) => onApiPortChange(e.target.value)} className="w-full p-2 bg-surface-light border border-border-color rounded-md" />
                        </div>
                        <div>
                            <p className="text-xs text-text-secondary mt-2">Example cURL request:</p>
                            <pre className="text-xs p-2 bg-surface rounded-md mt-1 overflow-x-auto"><code>{curlExample}</code></pre>
                        </div>
                  </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">Cloud Connections</h3>
                    <div className="bg-surface p-4 rounded-lg border border-border-color space-y-2">
                        {apiSettings.cloudConnections.length > 0 ? (
                            apiSettings.cloudConnections.map(conn => (
                                <div key={conn.id} className="flex justify-between items-center p-2 hover:bg-surface-light rounded-md">
                                    <div>
                                        <p className="font-semibold">{conn.name}</p>
                                        <p className="text-sm text-text-secondary">{allCloudProviders.find(p => p.id === conn.providerId)?.name || 'Unknown Provider'}</p>
                                    </div>
                                    <button onClick={() => onRequestDeleteCloudConnection(conn.id)} className="p-1 text-text-secondary hover:text-red-500"><Icon name="trash" className="w-4 h-4"/></button>
                                </div>
                            ))
                        ) : (
                             <p className="text-sm text-center text-text-secondary py-2">No cloud connections configured.</p>
                        )}
                        <button onClick={() => setIsAddCloudConnectionModalOpen(true)} className="w-full text-sm mt-2 p-2 bg-surface hover:bg-surface-light border border-border-color rounded-md">Add Connection</button>
                    </div>
                </div>

                 <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">Local Provider Connections</h3>
                    <div className="bg-surface p-4 rounded-lg border border-border-color space-y-2">
                        {apiSettings.localProviderConnections.length > 0 ? (
                            apiSettings.localProviderConnections.map(conn => (
                                <div key={conn.id} className="flex justify-between items-center p-2 hover:bg-surface-light rounded-md">
                                    <div>
                                        <p className="font-semibold">{conn.name}</p>
                                        <p className="text-sm text-text-secondary">{allLocalProviders.find(p => p.id === conn.providerId)?.name || 'Unknown Provider'}: {conn.url}</p>
                                    </div>
                                    <button onClick={() => onRequestDeleteLocalProviderConnection(conn.id)} className="p-1 text-text-secondary hover:text-red-500"><Icon name="trash" className="w-4 h-4"/></button>
                                </div>
                            ))
                        ) : (
                             <p className="text-sm text-center text-text-secondary py-2">No local providers connected.</p>
                        )}
                        <button onClick={() => setIsAddLocalConnectionModalOpen(true)} className="w-full text-sm mt-2 p-2 bg-surface hover:bg-surface-light border border-border-color rounded-md">Add Connection</button>
                    </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">API Keys</h3>
                   <div className="bg-surface p-4 rounded-lg border border-border-color space-y-2">
                    {apiSettings.apiKeys.map(key => (
                        <div key={key.id} className="flex items-center justify-between p-2 hover:bg-surface-light rounded-md">
                           <div className="font-mono text-sm">aix_sk...{key.key.slice(-4)}</div>
                           <div className="flex items-center space-x-2">
                               <button onClick={() => handleCopy(key.key, key.id)} className="text-text-secondary hover:text-primary">
                                  <Icon name={copiedKeyId === key.id ? "check-mark" : "copy"} className="w-4 h-4" />
                               </button>
                               <button onClick={() => onRequestDeleteApiKey(key.id)} className="text-text-secondary hover:text-red-500">
                                  <Icon name="trash" className="w-4 h-4" />
                               </button>
                           </div>
                        </div>
                    ))}
                    <button onClick={handleCreateNewKey} className="w-full text-sm mt-2 p-2 bg-surface hover:bg-surface-light border border-border-color rounded-md">Create New API Key</button>
                   </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Danger Zone</h3>
                  <div className="bg-surface p-4 rounded-lg border border-red-500/50">
                    <button onClick={onResetToDefaults} className="w-full text-sm p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold border border-red-500/50 rounded-md">Reset to Default Settings</button>
                    <p className="text-xs text-text-secondary mt-2">This will erase all your custom units, tools, and settings. This action cannot be undone.</p>
                  </div>
                </div>
              </div>
            </Modal>
            
            <Modal isOpen={isNewKeyModalOpen} onClose={handleCloseNewKeyModal} title="New API Key Created">
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">Your new API key has been created. Please copy it and store it somewhere safe. You will not be able to see it again.</p>
                <div className="flex items-center space-x-2 p-2 bg-surface border border-border-color rounded-md">
                    <input type="text" readOnly value={newlyCreatedKey?.key || ''} className="flex-grow bg-transparent font-mono text-sm" />
                    <button onClick={() => newlyCreatedKey && handleCopy(newlyCreatedKey.key, newlyCreatedKey.id)} className="p-2 text-text-secondary hover:text-primary">
                        <Icon name={copiedKeyId === newlyCreatedKey?.id ? "check-mark" : "copy"} className="w-5 h-5"/>
                    </button>
                </div>
                <div className="flex justify-end">
                    <button onClick={handleCloseNewKeyModal} className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/80">I have copied my key</button>
                </div>
              </div>
            </Modal>
            
            <Modal isOpen={!!keyToDelete} onClose={onCancelDeleteApiKey} title="Confirm Deletion">
                <p>Are you sure you want to delete the API key ending in ...{keyToDelete?.key.slice(-4)}?</p>
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onCancelDeleteApiKey} className="px-4 py-2 rounded-md bg-surface-light">Cancel</button>
                    <button onClick={onConfirmDeleteApiKey} className="px-4 py-2 rounded-md bg-red-500 text-white">Delete</button>
                </div>
            </Modal>

             <Modal isOpen={!!connectionToDelete} onClose={onCancelDeleteCloudConnection} title="Confirm Deletion">
                <p>Are you sure you want to delete the connection "{connectionToDelete?.name}"?</p>
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onCancelDeleteCloudConnection} className="px-4 py-2 rounded-md bg-surface-light">Cancel</button>
                    <button onClick={onConfirmDeleteCloudConnection} className="px-4 py-2 rounded-md bg-red-500 text-white">Delete</button>
                </div>
            </Modal>

            <Modal isOpen={!!localConnectionToDelete} onClose={onCancelDeleteLocalProviderConnection} title="Confirm Deletion">
                <p>Are you sure you want to delete the connection "{localConnectionToDelete?.name}"?</p>
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onCancelDeleteLocalProviderConnection} className="px-4 py-2 rounded-md bg-surface-light">Cancel</button>
                    <button onClick={onConfirmDeleteLocalProviderConnection} className="px-4 py-2 rounded-md bg-red-500 text-white">Delete</button>
                </div>
            </Modal>
            
            <Modal isOpen={isResetModalOpen} onClose={onCancelReset} title="Confirm Reset">
                <p className="text-text-primary">Are you sure you want to reset all application data to its default state? This includes all rooms, units, tools, and settings. This action is irreversible.</p>
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onCancelReset} className="px-4 py-2 rounded-md bg-surface-light">Cancel</button>
                    <button onClick={onConfirmReset} className="px-4 py-2 rounded-md bg-red-500 text-white">Reset Application</button>
                </div>
            </Modal>

            <AddCloudConnectionModal isOpen={isAddCloudConnectionModalOpen} onClose={() => setIsAddCloudConnectionModalOpen(false)} onAdd={onAddCloudConnection} />
            <AddLocalConnectionModal isOpen={isAddLocalConnectionModalOpen} onClose={() => setIsAddLocalConnectionModalOpen(false)} onAdd={onAddLocalProviderConnection} />
        </>
    );
};

export default Header;
