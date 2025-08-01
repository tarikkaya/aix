import React, { useState, useEffect, useRef } from 'react';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import { useTheme } from '../context/ThemeContext';
import type { ApiSettings, ApiKey, InputDevice, Room } from '../../types';
import { generateSecureApiKey } from '../../App';
import { RoomName } from '../../constants';

interface SettingsProps {
    apiSettings: ApiSettings;
    onAddApiKey: (key: ApiKey) => void;
    keyToDelete: ApiKey | null;
    onRequestDeleteApiKey: (keyId: string) => void;
    onConfirmDeleteApiKey: () => void;
    onCancelDeleteApiKey: () => void;
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

const Settings: React.FC<SettingsProps> = (props) => {
    const { 
        apiSettings, onAddApiKey, keyToDelete, onRequestDeleteApiKey, 
        onConfirmDeleteApiKey, onCancelDeleteApiKey, onApiPortChange, audioDevices,
        audioOutputDevices, onMicChange, onSpeakerChange, onPttKeyChange,
        onNoiseSuppressionChange, onWebhookUrlChange, onMicGainChange, onSpeakerGainChange, 
        rooms, onResetToDefaults, isResetModalOpen, onConfirmReset, onCancelReset,
        outputVolumeLevel, micVolumeLevel, onPlayTestTone
    } = props;
    const { theme, setTheme, availableThemes } = useTheme();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKey | null>(null);
    const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
    const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
    const [isSettingPttKey, setIsSettingPttKey] = useState(false);

    useEffect(() => {
        if (!isSettingPttKey) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
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
        const newKey: ApiKey = { id: window.crypto.randomUUID(), key: generateSecureApiKey(), createdAt: Date.now() };
        setNewlyCreatedKey(newKey);
        setIsNewKeyModalOpen(true);
    };

    const handleCloseNewKeyModal = () => {
        if (newlyCreatedKey) onAddApiKey(newlyCreatedKey);
        setIsNewKeyModalOpen(false);
        setNewlyCreatedKey(null);
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

    return (
        <>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-surface-light transition-colors" aria-label="Open Settings">
                <Icon name="adjustments-horizontal" className="w-6 h-6 text-text-secondary" />
            </button>

            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Theme</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {availableThemes.map(t => <button key={t.name} onClick={() => setTheme(t)} className={`p-2 rounded-md border-2 ${theme.name === t.name ? 'border-primary' : 'border-border-color'}`}>{t.name}</button>)}
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
                            <div className="w-full bg-surface-light rounded-full h-4 p-0.5 border border-border-color overflow-hidden"><div className="bg-primary h-full rounded-full transition-all duration-75" style={{ width: `${Math.min(100, (outputVolumeLevel / 80) * 100)}%` }}></div></div>
                        </div>
                        <button onClick={onPlayTestTone} className="w-full mt-2 p-2 bg-surface border border-border-color rounded-md text-sm font-semibold text-text-primary hover:bg-border-color disabled:opacity-50" disabled={audioOutputDevices.length === 0}>Test Sound</button>
                    </div>

                    {/* --- PUSH-TO-TALK --- */}
                     <div className="pt-4">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Push-to-Talk Hotkey</label>
                        <button 
                            onClick={() => setIsSettingPttKey(true)} 
                            className="w-full p-2 bg-surface-light border border-border-color rounded-md text-left"
                        >
                           {isSettingPttKey ? 'Press any key...' : (apiSettings.pushToTalkKey || 'Not set')}
                        </button>
                    </div>

                  </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">API Keys</h3>
                    <div className="bg-surface p-4 rounded-lg border border-border-color space-y-4">
                        <div className="flex justify-between items-center"><p className="text-sm text-text-secondary">Manage programmatic access to the chat API.</p><button onClick={handleCreateNewKey} className="bg-primary text-white px-3 py-1.5 text-sm font-semibold rounded-lg hover:bg-primary/80 transition-colors">Create new key</button></div>
                        <div className="space-y-2">
                          {apiSettings.apiKeys.map(key => (<div key={key.id} className="grid grid-cols-5 items-center gap-4 text-sm p-2 rounded-md hover:bg-surface-light"><span className="col-span-2 font-mono text-text-primary truncate" title={key.key}>{key.key.slice(0, 11)}...{key.key.slice(-4)}</span><span className="text-text-secondary">{new Date(key.createdAt).toLocaleDateString()}</span><button onClick={() => handleCopy(key.key, key.id)} className="text-primary hover:underline">{copiedKeyId === key.id ? 'Copied!' : 'Copy'}</button><button onClick={() => onRequestDeleteApiKey(key.id)} className="text-red-500/80 hover:text-red-500"><Icon name="trash" className="w-4 h-4"/></button></div>))}
                          {apiSettings.apiKeys.length === 0 && <p className="text-center text-sm text-text-secondary py-4">No API keys created yet.</p>}
                        </div>
                    </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">API & Webhooks</h3>
                    <div className="bg-surface p-4 rounded-lg border border-border-color space-y-6">
                        {/* Input Pipeline */}
                        <div>
                            <h4 className="text-base font-semibold text-text-primary mb-2">Input Pipeline (API Endpoint)</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Endpoint Port</label>
                                    <div className="flex items-center space-x-2 bg-surface-light border border-border-color rounded-md px-3">
                                        <span className="text-text-secondary">http://localhost:</span>
                                        <input type="number" value={apiSettings.apiPort} onChange={e => onApiPortChange(e.target.value)} className="p-2 bg-transparent w-20 focus:outline-none" placeholder="8000" />
                                        <span className="text-text-secondary">/v1/chat/completions</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Example Usage (cURL)</label>
                                    <pre className="text-xs text-text-secondary bg-surface-light p-3 rounded-md overflow-x-auto font-mono"><code>{curlExample}</code></pre>
                                </div>
                            </div>
                        </div>

                        {/* Output Pipeline */}
                        <div>
                            <h4 className="text-base font-semibold text-text-primary mb-2">Output Pipeline (Webhooks)</h4>
                            <div className="space-y-4">
                                <p className="text-sm text-text-secondary">When the AGI generates audio via the Soundcast, it can POST the audio file to a webhook URL.</p>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Webhook URL</label>
                                    <input 
                                        type="text" 
                                        value={apiSettings.webhookUrl || ''} 
                                        onChange={e => onWebhookUrlChange(e.target.value)} 
                                        placeholder="https://your-service.com/aix-audio-hook"
                                        className="w-full p-2 bg-surface-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Example Payload (POST)</label>
                                    <pre className="text-xs text-text-secondary bg-surface-light p-3 rounded-md overflow-x-auto font-mono"><code>{webhookPayloadExample}</code></pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-red-500 mb-2">Danger Zone</h3>
                    <div className="bg-surface p-4 rounded-lg border border-red-500/50 space-y-4">
                        <div>
                            <h4 className="font-semibold text-text-primary">Reset Application State</h4>
                            <p className="text-sm text-text-secondary mt-1">This will delete all custom units, API keys, and settings, restoring the application to its original factory state. This action is irreversible.</p>
                            <button 
                                onClick={onResetToDefaults} 
                                className="mt-3 w-full bg-red-600 text-white px-3 py-1.5 text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Reset to Defaults
                            </button>
                        </div>
                    </div>
                </div>

              </div>
            </Modal>
            
            <Modal isOpen={isResetModalOpen} onClose={onCancelReset} title="Confirm Reset">
                <div>
                    <p className="text-sm text-text-secondary mb-4">Are you sure you want to reset all rooms, units, and settings to their default state? This action is irreversible.</p>
                    <div className="flex justify-end space-x-2 mt-6">
                        <button onClick={onCancelReset} className="px-4 py-2 text-sm font-medium rounded-md bg-surface hover:bg-surface-light transition-colors">Cancel</button>
                        <button onClick={onConfirmReset} className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors">Confirm Reset</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isNewKeyModalOpen} onClose={handleCloseNewKeyModal} title="New API Key Created">
                <div><p className="text-sm text-text-secondary mb-4">This is your new API key. It will not be shown again, so please copy it and store it in a safe place.</p><div className="flex items-center space-x-2 bg-surface p-3 rounded-md border border-border-color"><span className="font-mono text-text-primary flex-grow truncate">{newlyCreatedKey?.key}</span><button onClick={() => handleCopy(newlyCreatedKey?.key || '', 'new')} className="text-primary hover:underline">{copiedKeyId === 'new' ? 'Copied!' : 'Copy'}</button></div><div className="flex justify-end mt-6"><button onClick={handleCloseNewKeyModal} className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/80 transition-colors">Done</button></div></div>
            </Modal>
            
            <Modal isOpen={!!keyToDelete} onClose={onCancelDeleteApiKey} title="Delete API Key">
                <div><p className="text-sm text-text-secondary mb-4">Are you sure you want to delete this API key? This action cannot be undone.</p><p className="font-mono bg-surface p-2 rounded-md border border-border-color text-center">{keyToDelete?.key.slice(0, 11)}...{keyToDelete?.key.slice(-4)}</p><div className="flex justify-end space-x-2 mt-6"><button onClick={onCancelDeleteApiKey} className="px-4 py-2 text-sm font-medium rounded-md bg-surface hover:bg-surface-light transition-colors">Cancel</button><button onClick={onConfirmDeleteApiKey} className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors">Delete Key</button></div></div>
            </Modal>
        </>
    );
};

const Header: React.FC<SettingsProps> = (props) => {
    return (
        <header className="flex items-center justify-between p-4 border-b border-border-color flex-shrink-0">
            <div className="flex items-baseline space-x-2">
                <h1 className="text-xl font-bold text-text-primary">AIX</h1>
                <p className="text-sm text-text-secondary">The Unknown AI</p>
            </div>
            <div className="flex items-center space-x-2">
                <Settings 
                    {...props}
                />
            </div>
        </header>
    );
};

export default Header;