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
}

const Settings: React.FC<SettingsProps> = (props) => {
    const { 
        apiSettings, onAddApiKey, keyToDelete, onRequestDeleteApiKey, 
        onConfirmDeleteApiKey, onCancelDeleteApiKey, onApiPortChange, audioDevices,
        audioOutputDevices, onMicChange, onSpeakerChange, onPttKeyChange,
        onNoiseSuppressionChange, onWebhookUrlChange, onMicGainChange, onSpeakerGainChange, 
        rooms, onResetToDefaults, isResetModalOpen, onConfirmReset, onCancelReset
    } = props;
    const { theme, setTheme, availableThemes } = useTheme();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKey | null>(null);
    const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
    const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
    const [isSettingPttKey, setIsSettingPttKey] = useState(false);
    
    // Main audio player ref
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    // --- Refs for robust Web Audio API handling ---
    // Microphone refs
    const [micVolumeLevel, setMicVolumeLevel] = useState(0);
    const micStreamRef = useRef<MediaStream | null>(null);
    const micAudioContextRef = useRef<AudioContext | null>(null);
    const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const micGainNodeRef = useRef<GainNode | null>(null);
    const micAnalyserNodeRef = useRef<AnalyserNode | null>(null);
    const micAnimationIdRef = useRef<number>(0);

    // Speaker/Output refs
    const [outputVolumeLevel, setOutputVolumeLevel] = useState(0);
    const speakerAudioContextRef = useRef<AudioContext | null>(null);
    const speakerGainNodeRef = useRef<GainNode | null>(null);
    const speakerSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const speakerAnalyserNodeRef = useRef<AnalyserNode | null>(null);
    const speakerAnimationIdRef = useRef<number>(0);

    // Push-to-talk keydown listener
    useEffect(() => {
        if (!isSettingPttKey) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            let keyString = e.key;
            if (e.ctrlKey && keyString !== 'Control') keyString = `Ctrl+${keyString}`;
            if (e.altKey && keyString !== 'Alt') keyString = `Alt+${keyString}`;
            if (e.shiftKey && keyString !== 'Shift') keyString = `Shift+${keyString}`;
            onPttKeyChange(keyString);
            setIsSettingPttKey(false);
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSettingPttKey, onPttKeyChange]);


    // --- Microphone Audio Graph Management ---
    const startMicVisualization = () => {
        const analyser = micAnalyserNodeRef.current;
        if (!analyser) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
            if (!isNaN(average)) {
                setMicVolumeLevel(average);
            }
            micAnimationIdRef.current = requestAnimationFrame(draw);
        };
        draw();
    };

    const stopMicVisualization = () => {
        cancelAnimationFrame(micAnimationIdRef.current);
        setMicVolumeLevel(0);
    };

    useEffect(() => {
        if (isSettingsOpen) {
            const setupMic = async () => {
                if (!apiSettings.micId) return;

                try {
                    // Initialize AudioContext if it doesn't exist
                    if (!micAudioContextRef.current) {
                        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const gainNode = context.createGain();
                        const analyser = context.createAnalyser();
                        analyser.fftSize = 512;
                        analyser.smoothingTimeConstant = 0.8;

                        micAudioContextRef.current = context;
                        micGainNodeRef.current = gainNode;
                        micAnalyserNodeRef.current = analyser;
                    }
                    
                    const context = micAudioContextRef.current;
                    if (context.state === 'suspended') {
                        await context.resume();
                    }

                    // Get stream and connect graph
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: { deviceId: { exact: apiSettings.micId }, noiseSuppression: apiSettings.noiseSuppression, echoCancellation: true }
                    });
                    micStreamRef.current = stream;

                    if (micSourceNodeRef.current) micSourceNodeRef.current.disconnect();
                    const source = context.createMediaStreamSource(stream);
                    source.connect(micGainNodeRef.current!).connect(micAnalyserNodeRef.current!);
                    micSourceNodeRef.current = source;

                    startMicVisualization();

                } catch (err) {
                    console.error("Mic setup failed:", err);
                }
            };
            setupMic();
        }

        return () => {
            stopMicVisualization();
            micStreamRef.current?.getTracks().forEach(track => track.stop());
            micSourceNodeRef.current?.disconnect();
        };
    }, [isSettingsOpen, apiSettings.micId, apiSettings.noiseSuppression]);

    useEffect(() => {
        if (micGainNodeRef.current && micAudioContextRef.current) {
            micGainNodeRef.current.gain.setTargetAtTime(apiSettings.micGain, micAudioContextRef.current.currentTime, 0.01);
        }
    }, [apiSettings.micGain]);


    // --- Speaker Audio Graph Management ---
    const startSpeakerVisualization = () => {
        const analyser = speakerAnalyserNodeRef.current;
        if (!analyser) return;
        
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const draw = () => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
            if (!isNaN(average)) {
                setOutputVolumeLevel(average);
            }
            speakerAnimationIdRef.current = requestAnimationFrame(draw);
        };
        draw();
    };

    const stopSpeakerVisualization = () => {
        cancelAnimationFrame(speakerAnimationIdRef.current);
        setOutputVolumeLevel(0);
    };

    useEffect(() => {
        const setupSpeaker = async () => {
             const audioPlayer = audioPlayerRef.current;
             if (!audioPlayer) return;

             try {
                if (!speakerAudioContextRef.current) {
                    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const source = context.createMediaElementSource(audioPlayer);
                    const gainNode = context.createGain();
                    const analyser = context.createAnalyser();
                    source.connect(gainNode).connect(analyser).connect(context.destination);

                    speakerAudioContextRef.current = context;
                    speakerSourceNodeRef.current = source;
                    speakerGainNodeRef.current = gainNode;
                    speakerAnalyserNodeRef.current = analyser;
                }
                const context = speakerAudioContextRef.current;
                if (context.state === 'suspended') {
                    await context.resume();
                }

             } catch(e) {
                console.error("Error setting up speaker context", e);
             }
        };

        if (isSettingsOpen) {
            setupSpeaker().then(() => {
                startSpeakerVisualization();
            });
        }

        return () => {
            stopSpeakerVisualization();
        };
    }, [isSettingsOpen]);

    useEffect(() => {
        if (speakerGainNodeRef.current && speakerAudioContextRef.current) {
            speakerGainNodeRef.current.gain.setTargetAtTime(apiSettings.speakerGain, speakerAudioContextRef.current.currentTime, 0.01);
        }
    }, [apiSettings.speakerGain]);

    useEffect(() => {
        const audioPlayer = audioPlayerRef.current;
        if (audioPlayer && apiSettings.speakerId && typeof audioPlayer.setSinkId === 'function') {
            audioPlayer.setSinkId(apiSettings.speakerId).catch(err => {
                console.warn("Could not set sink ID:", err.message);
            });
        }
    }, [apiSettings.speakerId]);
    
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

    const generateAndPlayTestTone = async () => {
        const audioPlayer = audioPlayerRef.current;
        if (!audioPlayer || !speakerAudioContextRef.current) return;
    
        try {
            if (speakerAudioContextRef.current.state === 'suspended') {
                await speakerAudioContextRef.current.resume();
            }

            const offlineCtx = new OfflineAudioContext(1, 44100 * 1.5, 44100);
            const oscillator = offlineCtx.createOscillator();
            const gainNode = offlineCtx.createGain();
    
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, 0);
            gainNode.gain.setValueAtTime(0, 0);
            gainNode.gain.linearRampToValueAtTime(0.5, 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, 1.5);
    
            oscillator.connect(gainNode);
            gainNode.connect(offlineCtx.destination);
    
            oscillator.start(0);
    
            const audioBuffer = await offlineCtx.startRendering();
            
            const workerScript = `
                let recLength = 0, recBuffers = [], sampleRate;
                this.onmessage = e => { if (e.data.command === 'init') init(e.data.config); else if (e.data.command === 'record') record(e.data.buffer); else if (e.data.command === 'exportWAV') exportWAV(e.data.type); };
                const init = config => sampleRate = config.sampleRate;
                const record = inputBuffer => { recBuffers.push(inputBuffer); recLength += inputBuffer.length; };
                const exportWAV = type => {
                    const buffer = mergeBuffers(recBuffers, recLength);
                    const dataview = encodeWAV(buffer);
                    this.postMessage(new Blob([dataview], { type }));
                };
                const mergeBuffers = (buffers, len) => { let result = new Float32Array(len), offset = 0; for (const buffer of buffers) { result.set(buffer, offset); offset += buffer.length; } return result; };
                const floatTo16BitPCM = (output, offset, input) => { for (let i = 0; i < input.length; i++, offset += 2) { let s = Math.max(-1, Math.min(1, input[i])); output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true); } };
                const writeString = (view, offset, string) => { for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i)); };
                const encodeWAV = samples => { const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer); writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeString(view, 36, 'data'); view.setUint32(40, samples.length * 2, true); floatTo16BitPCM(view, 44, samples); return view; };
            `;
            const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(workerBlob));
            
            worker.postMessage({ command: 'init', config: { sampleRate: 44100 } });
            worker.postMessage({ command: 'record', buffer: audioBuffer.getChannelData(0) });
            worker.postMessage({ command: 'exportWAV', type: 'audio/wav' });

            worker.onmessage = (e) => {
                const audioBlob = e.data;
                const url = URL.createObjectURL(audioBlob);
                audioPlayer.src = url;
                audioPlayer.play().catch(err => console.error("Error playing test tone blob:", err));
                worker.terminate();
            };
    
        } catch(e) {
            console.error("Failed to generate test tone:", e);
        }
    };


    const fullEndpoint = `http://localhost:${apiSettings.apiPort}/v1/chat/completions`;
    const curlExample = `curl ${fullEndpoint} \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -F 'message={"text": "Please transcribe this audio."}' \\
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
            <audio ref={audioPlayerRef} crossOrigin="anonymous" className="hidden"></audio>
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
                        <button onClick={generateAndPlayTestTone} className="w-full mt-2 p-2 bg-surface border border-border-color rounded-md text-sm font-semibold text-text-primary hover:bg-border-color disabled:opacity-50" disabled={audioOutputDevices.length === 0}>Test Sound</button>
                    </div>

                    {/* --- PUSH-TO-TALK --- */}
                     <div className="pt-4">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Push-to-Talk Hotkey</label>
                        <button onClick={() => setIsSettingPttKey(true)} className="w-full p-2 bg-surface-light border border-border-color rounded-md text-left">{isSettingPttKey ? 'Press any key combination...' : (apiSettings.pushToTalkKey || 'Not set')}</button>
                        <p className="text-xs text-text-secondary mt-1">Note: Global hotkey requires the native desktop app version.</p>
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