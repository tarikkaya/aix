import React, { useState, useCallback, useEffect } from 'react';
import { initialRooms, RoomName, initialRagBases, initialApiSettings, PROTECTED_UNITS } from './constants';
import type { Room, Unit, RAGBase, ApiSettings, ApiKey, InputDevice, ChatMessage, ExperienceNeuron, ChatFile, Tool, CloudConnection, LocalProviderConnection, FileReference } from './types';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';
import ChatWindow from './components/layout/ChatWindow';
import { ThemeProvider } from './components/context/ThemeContext';
import { useAudioPipeline } from './components/hooks/useAudioPipeline';

export const generateSecureApiKey = (): string => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    return `aix_sk_${hex}`;
};

const STATE_STORAGE_KEY = 'aix_state';

interface AppState {
    rooms: Room[];
    ragBases: RAGBase[];
    apiSettings: ApiSettings;
    fileStore: Record<string, ChatFile>;
}

const loadState = (): AppState | undefined => {
    try {
        const serializedState = localStorage.getItem(STATE_STORAGE_KEY);
        if (serializedState === null) {
            return undefined;
        }
        return JSON.parse(serializedState);
    } catch (error) {
        console.warn("Could not load state from local storage", error);
        return undefined;
    }
};

const saveState = (state: AppState) => {
    try {
        const serializedState = JSON.stringify(state);
        localStorage.setItem(STATE_STORAGE_KEY, serializedState);
    } catch (error) {
        console.warn("Could not save state to local storage", error);
    }
};

export default function App() {
  const [savedStateLoaded, setSavedStateLoaded] = useState(false);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [ragBases, setRagBases] = useState<RAGBase[]>(initialRagBases);
  const [activeRoom, setActiveRoom] = useState<Room>(initialRooms[0]);
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null);
  const [apiSettings, setApiSettings] = useState<ApiSettings>(initialApiSettings);
  const [fileStore, setFileStore] = useState<Record<string, ChatFile>>({});
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [connectionToDelete, setConnectionToDelete] = useState<CloudConnection | null>(null);
  const [localConnectionToDelete, setLocalConnectionToDelete] = useState<LocalProviderConnection | null>(null);
  const [audioDevices, setAudioDevices] = useState<InputDevice[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<InputDevice[]>([]);
  const [isAudioReady, setIsAudioReady] = useState(false);
  
  const {
    outputVolumeLevel,
    micVolumeLevel,
    isRecording,
    newlyRecordedFile,
    generateAndPlayTestTone,
    playAudioFromUrl,
    startRecording,
    stopRecording,
    onNewRecordingConsumed,
  } = useAudioPipeline(apiSettings, isAudioReady);
  
  // Load state from local storage only once on initial mount
  useEffect(() => {
    const savedState = loadState();
    if (savedState) {
        // --- START OF MIGRATION LOGIC for Rooms and Units ---
        // This logic ensures that if new "protected" units are added to the default
        // configuration, they are seamlessly merged into the user's existing saved state
        // without wiping their customizations.
        const savedRoomsMap = new Map(savedState.rooms.map(r => [r.name, r]));
        const finalRooms = initialRooms.map(initialRoom => {
            const savedRoom = savedRoomsMap.get(initialRoom.name);
            if (!savedRoom) {
                // This is a new default room, add it as is.
                return initialRoom;
            }

            // Room exists, check for missing protected units
            const savedUnitNames = new Set(savedRoom.units.map(u => u.name));
            const missingUnits = initialRoom.units.filter(
                initialUnit => PROTECTED_UNITS.includes(initialUnit.name) && !savedUnitNames.has(initialUnit.name)
            );
            
            // Return the user's saved room but with any missing protected units added
            return {
                ...savedRoom,
                units: [...savedRoom.units, ...missingUnits]
            };
        });

        setRooms(finalRooms);
        // --- END OF MIGRATION LOGIC ---

        setRagBases(savedState.ragBases);
        // Ensure all new apiSettings properties are initialized
        const loadedApiSettings = { ...initialApiSettings, ...savedState.apiSettings };
        if (!loadedApiSettings.cloudConnections) loadedApiSettings.cloudConnections = [];
        if (!loadedApiSettings.localProviderConnections) loadedApiSettings.localProviderConnections = [];
        if (!loadedApiSettings.globalEmbeddingSettings) loadedApiSettings.globalEmbeddingSettings = initialApiSettings.globalEmbeddingSettings;
        
        setApiSettings(loadedApiSettings);
        if (savedState.fileStore) {
            setFileStore(savedState.fileStore);
        }

        const activeRoomFromState = finalRooms.find(r => r.id === initialRooms[0].id) || finalRooms[0];
        if (activeRoomFromState) {
            setActiveRoom(activeRoomFromState);
        }
    }
    setSavedStateLoaded(true);
  }, []);

  // Save state whenever it changes, but only after the initial load has completed.
  useEffect(() => {
      if (savedStateLoaded) {
          saveState({ rooms, ragBases, apiSettings, fileStore });
      }
  }, [rooms, ragBases, apiSettings, fileStore, savedStateLoaded]);

  useEffect(() => {
    setActiveUnit(null);
  }, [activeRoom.id]);
  
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  // Homeostatic balance for Drive units - updates rooms state in the background.
  useEffect(() => {
    const HOMEOSTASIS_INTERVAL = 10 * 60 * 1000; // 10 minutes
    const intervalId = setInterval(() => {
      setRooms(currentRooms => {
        let hasChanges = false;
        const newRooms = currentRooms.map(room => {
          let roomHasChanges = false;
          const newUnits = room.units.map(unit => {
            if (unit.type === 'Drive' && unit.scaleDb.enabled && unit.scaleDb.values.length > 0) {
              let unitHasChanges = false;
              const newScaleValues = unit.scaleDb.values.map(val => {
                if (typeof val.defaultValue !== 'number' || val.score === val.defaultValue) return val;
                let newScore = val.score;
                if (newScore > val.defaultValue) newScore = Math.max(val.defaultValue, newScore - 1);
                else if (newScore < val.defaultValue) newScore = Math.min(val.defaultValue, newScore + 1);
                if (newScore !== val.score) unitHasChanges = true;
                return { ...val, score: newScore };
              });
              if (unitHasChanges) {
                roomHasChanges = true;
                return { ...unit, scaleDb: { ...unit.scaleDb, values: newScaleValues } };
              }
            }
            return unit;
          });
          if (roomHasChanges) {
            hasChanges = true;
            return { ...room, units: newUnits };
          }
          return room;
        });
        return hasChanges ? newRooms : currentRooms;
      });
    }, HOMEOSTASIS_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);

  // Sync active room and unit when the main `rooms` array is updated by a background process.
  useEffect(() => {
    const currentActiveRoom = rooms.find(r => r.id === activeRoom.id);
    if (currentActiveRoom) {
      if (JSON.stringify(currentActiveRoom) !== JSON.stringify(activeRoom)) setActiveRoom(currentActiveRoom);
      if (activeUnit) {
        const currentActiveUnit = currentActiveRoom.units.find(u => u.id === activeUnit.id);
        if (currentActiveUnit && JSON.stringify(currentActiveUnit) !== JSON.stringify(activeUnit)) setActiveUnit(currentActiveUnit);
        else if (!currentActiveUnit) setActiveUnit(null);
      }
    } else {
      setActiveRoom(rooms[0]);
    }
  }, [rooms, activeRoom, activeUnit]);

  const updateDeviceList = useCallback(async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const normalizeLabel = (label: string): string => label.replace(/^(Default|Varsayılan)\s*-\s*/i, '').replace(/^(Communications|İletişim)\s*-\s*/i, '').trim();
        const getDevicePriority = (device: MediaDeviceInfo): number => {
            if (device.deviceId === 'default') return 3;
            if (/^(Default|Varsayılan)/i.test(device.label)) return 2;
            if (/^(Communications|İletişim)/i.test(device.label)) return 1;
            return 0;
        };
        const getUniqueDevices = (devices: MediaDeviceInfo[], kind: 'audioinput' | 'audiooutput'): MediaDeviceInfo[] => {
            const devicesOfKind = devices.filter(d => d.kind === kind);
            const deviceMap = new Map<string, MediaDeviceInfo>();
            for (const device of devicesOfKind) {
                const key = device.label ? normalizeLabel(device.label) : device.deviceId;
                const existingDevice = deviceMap.get(key);
                if (!existingDevice || getDevicePriority(device) > getDevicePriority(existingDevice)) deviceMap.set(key, device);
            }
            return Array.from(deviceMap.values());
        };
        const mics = getUniqueDevices(devices, 'audioinput').map((d, i) => ({ id: d.deviceId, name: d.label || `Microphone ${i + 1}` }));
        const speakers = getUniqueDevices(devices, 'audiooutput').map((d, i) => ({ id: d.deviceId, name: d.label || `Speakers ${i + 1}` }));
        setAudioDevices(currentMics => JSON.stringify(currentMics) !== JSON.stringify(mics) ? mics : currentMics);
        setAudioOutputDevices(currentSpeakers => JSON.stringify(currentSpeakers) !== JSON.stringify(speakers) ? speakers : currentSpeakers);
        setApiSettings(prev => {
            const newSettings = { ...prev };
            let settingsChanged = false;
            if (mics.length > 0 && (!prev.micId || !mics.some(m => m.id === prev.micId))) {
                newSettings.micId = mics[0].id;
                settingsChanged = true;
            } else if (mics.length === 0 && prev.micId) {
                newSettings.micId = null;
                settingsChanged = true;
            }
            if (speakers.length > 0 && (!prev.speakerId || !speakers.some(s => s.id === prev.speakerId))) {
                newSettings.speakerId = speakers[0].id;
                settingsChanged = true;
            } else if (speakers.length === 0 && prev.speakerId) {
                newSettings.speakerId = null;
                settingsChanged = true;
            }
            return settingsChanged ? newSettings : prev;
        });
    } catch (err: any) {
        console.error("Error enumerating devices:", err);
    }
  }, []);

  const handleInitializeAudio = useCallback(async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        await updateDeviceList();
        setIsAudioReady(true);
    } catch (err) {
        console.error("Audio permission denied or error during initialization:", err);
        alert("Microphone access is required for full application functionality. Please allow access and refresh the page if audio features do not work.");
    }
  }, [updateDeviceList]);

  useEffect(() => {
    handleInitializeAudio();
  }, [handleInitializeAudio]);

  useEffect(() => {
    if (isAudioReady) {
        navigator.mediaDevices.addEventListener('devicechange', updateDeviceList);
        return () => navigator.mediaDevices.removeEventListener('devicechange', updateDeviceList);
    }
  }, [isAudioReady, updateDeviceList]);

    
    // Push-to-talk keydown listener
    useEffect(() => {
        if (!apiSettings.pushToTalkKey) return;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            if (e.key === apiSettings.pushToTalkKey && !isRecording) {
                 e.preventDefault();
                 startRecording();
            }
        }
        const handleKeyUp = (e: KeyboardEvent) => {
             if (e.key === apiSettings.pushToTalkKey && isRecording) {
                 e.preventDefault();
                 stopRecording();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [apiSettings.pushToTalkKey, isRecording, startRecording, stopRecording]);

  const handleUpdateUnit = (updatedUnit: Unit) => {
    setRooms(currentRooms => {
      return currentRooms.map(room => {
        if (room.units.some(u => u.id === updatedUnit.id)) {
          return {
            ...room,
            units: room.units.map(u => u.id === updatedUnit.id ? updatedUnit : u)
          };
        }
        return room;
      });
    });
  };

  const handleAddUnit = (roomId: string, type: 'Standard' | 'RAG' | 'Code RAG' | 'Drive') => {
      setRooms(currentRooms => {
          return currentRooms.map(room => {
              if (room.id === roomId) {
                  const newUnitId = `unit-${Date.now()}`;
                  const newUnit: Unit = {
                    id: newUnitId,
                    name: `New ${type} Unit`,
                    type: type,
                    purpose: 'A newly created unit, ready for configuration.',
                    isLoopOpen: true,
                    todo: { items: [] },
                    todoVector: { provider: 'sqlite', path: `./aix_data/rooms/${roomId}/units/${newUnitId}/todo_vector.sqlite` },
                    llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' },
                    prompt: `I am a new ${type} unit. I am aware of my own configuration, including my training vector, experience vector, and standard database, and I will use them to inform my responses. I will follow the coalition protocol: If configured with a local LLM provider, I will await a 'load' command. If configured with a cloud LLM provider, I will await a direct activation command from my Room Manager. All semantic embeddings for my training data and experience vector are managed by the framework's single Global Embedding Engine.`,
                    trainingVector: { enabled: false, vectorStore: { provider: 'lancedb' }, neurons: 0, sources: [] },
                    experienceVector: { provider: 'lancedb', neurons: [] },
                    standardDb: { provider: 'sqlite', enabled: false },
                    scaleDb: { enabled: false, provider: 'sqlite', path: `./aix_data/rooms/${roomId}/units/${newUnitId}/scale_db.sqlite`, values: [] },
                    tools: [],
                  };
                  if (type === 'RAG' || type === 'Code RAG') {
                      newUnit.ragBaseId = 'ragbase-history'; // Default, user can change
                  }
                  return { ...room, units: [...room.units, newUnit] };
              }
              return room;
          });
      });
  };

  const handleDeleteUnit = (unitId: string) => {
      setRooms(currentRooms => {
          return currentRooms.map(room => {
              return { ...room, units: room.units.filter(u => u.id !== unitId) };
          });
      });
      if (activeUnit?.id === unitId) {
        setActiveUnit(null);
      }
  };
  
  const handleAddTool = (tool: Omit<Tool, 'id'>) => {
    const newTool: Tool = { ...tool, id: `tool-${Date.now()}` };
    setRooms(currentRooms => {
        return currentRooms.map(room => {
            if (room.name === RoomName.Tools) {
                return { ...room, tools: [...(room.tools || []), newTool] };
            }
            return room;
        });
    });
  };
  
  const handleDeleteTool = (toolId: string) => {
      setRooms(currentRooms => {
          return currentRooms.map(room => {
              if (room.name === RoomName.Tools) {
                  return { ...room, tools: (room.tools || []).filter(t => t.id !== toolId) };
              }
              return room;
          })
      });
  };

  const handleUpdateRagBase = (updatedBase: RAGBase) => {
    setRagBases(bases => bases.map(b => b.id === updatedBase.id ? updatedBase : b));
  };
  
  const handleApiPortChange = (port: string) => {
      const portNumber = parseInt(port, 10);
      if (!isNaN(portNumber) && portNumber > 0 && portNumber < 65536) {
          setApiSettings(prev => ({ ...prev, apiPort: portNumber }));
      }
  };
  
  const handleAddApiKey = (key: ApiKey) => {
      setApiSettings(prev => ({ ...prev, apiKeys: [...prev.apiKeys, key]}));
  };
  
  const handleRequestDeleteApiKey = (keyId: string) => {
      const key = apiSettings.apiKeys.find(k => k.id === keyId);
      if (key) setKeyToDelete(key);
  };
  
  const handleConfirmDeleteApiKey = () => {
      if (keyToDelete) {
          setApiSettings(prev => ({...prev, apiKeys: prev.apiKeys.filter(k => k.id !== keyToDelete.id)}));
          setKeyToDelete(null);
      }
  };
  
  const handleCancelDeleteApiKey = () => setKeyToDelete(null);
  
  const handleAddCloudConnection = (connection: CloudConnection) => {
      setApiSettings(prev => ({ ...prev, cloudConnections: [...prev.cloudConnections, connection]}));
  };

  const handleRequestDeleteCloudConnection = (connectionId: string) => {
      const connection = apiSettings.cloudConnections.find(c => c.id === connectionId);
      if (connection) setConnectionToDelete(connection);
  };

  const handleConfirmDeleteCloudConnection = () => {
      if (connectionToDelete) {
          setApiSettings(prev => ({...prev, cloudConnections: prev.cloudConnections.filter(c => c.id !== connectionToDelete.id)}));
          setConnectionToDelete(null);
      }
  };

  const handleCancelDeleteCloudConnection = () => setConnectionToDelete(null);
  
  const handleAddLocalProviderConnection = (connection: LocalProviderConnection) => {
      setApiSettings(prev => ({ ...prev, localProviderConnections: [...prev.localProviderConnections, connection]}));
  };
  
  const handleRequestDeleteLocalProviderConnection = (connectionId: string) => {
      const connection = apiSettings.localProviderConnections.find(c => c.id === connectionId);
      if (connection) setLocalConnectionToDelete(connection);
  };
  
  const handleConfirmDeleteLocalProviderConnection = () => {
      if (localConnectionToDelete) {
          setApiSettings(prev => ({...prev, localProviderConnections: prev.localProviderConnections.filter(c => c.id !== localConnectionToDelete.id)}));
          setLocalConnectionToDelete(null);
      }
  };
  
  const handleCancelDeleteLocalProviderConnection = () => setLocalConnectionToDelete(null);


  const handleResetToDefaults = () => {
    setIsResetModalOpen(true);
  };
  
  const handleConfirmReset = () => {
    localStorage.removeItem(STATE_STORAGE_KEY);
    window.location.reload();
  };
  
  const handleCancelReset = () => {
    setIsResetModalOpen(false);
  };

  const handleNoiseSuppressionChange = (enabled: boolean) => {
    // Changing noise suppression requires re-initializing the MediaStream.
    // The most robust way to ensure the entire audio pipeline is cleanly
    // reset is to save the new state and perform a full page reload.
    const updatedApiSettings = {
      ...apiSettings,
      noiseSuppression: enabled,
    };
    
    // Manually construct and save state because we need to ensure it's
    // in localStorage BEFORE the page reloads.
    saveState({
      rooms,
      ragBases,
      apiSettings: updatedApiSettings,
      fileStore,
    });
    
    window.location.reload();
  };
  
  const handleDistributeFeedback = (message: ChatMessage, rf: 'up' | 'down', reason: string) => {
        console.log(`Distributing feedback for message ${message.id}:`, {
            feedback: rf,
            reason: reason,
            participants: message.participantUnitIds,
        });

        const fileReferences: FileReference[] = [];
        if (message.files && message.files.length > 0) {
            const newFileStoreEntries: Record<string, ChatFile> = {};
            for (const file of message.files) {
                const fileId = `fs-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                fileReferences.push({ id: fileId, name: file.name, type: file.type });
                newFileStoreEntries[fileId] = file;
            }
            setFileStore(prev => ({ ...prev, ...newFileStoreEntries }));
        }
        
        const timestamp = new Date().toISOString();
        const participantIds = message.participantUnitIds || [];
        
        setRooms(currentRooms => {
            return currentRooms.map(room => ({
                ...room,
                units: room.units.map(unit => {
                    if (participantIds.includes(unit.id)) {
                        const newNeuron: ExperienceNeuron = { 
                            id: `exp-${unit.id}-${Date.now()}`,
                            timestamp,
                            response: message.text,
                            rf,
                            reason,
                            isSystemRf: false,
                            files: fileReferences,
                            imageAnalysis: message.imageAnalysis,
                            audioAnalysis: message.audioAnalysis,
                        };
                        return {
                            ...unit,
                            experienceVector: {
                                ...unit.experienceVector,
                                neurons: [...(unit.experienceVector.neurons || []), newNeuron]
                            }
                        };
                    }
                    return unit;
                })
            }));
        });
    };
    
    const handleSystemFeedback = (message: ChatMessage) => {
        console.log(`Applying system feedback for message ${message.id}`);

        const fileReferences: FileReference[] = [];
        if (message.files && message.files.length > 0) {
            const newFileStoreEntries: Record<string, ChatFile> = {};
            for (const file of message.files) {
                const fileId = `fs-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                fileReferences.push({ id: fileId, name: file.name, type: file.type });
                newFileStoreEntries[fileId] = file;
            }
            setFileStore(prev => ({ ...prev, ...newFileStoreEntries }));
        }

        setRooms(currentRooms => {
            return currentRooms.map(room => ({
                ...room,
                units: room.units.map(unit => {
                    if (message.participantUnitIds?.includes(unit.id)) {
                         const newNeuron: ExperienceNeuron = {
                            id: `exp-sys-${unit.id}-${Date.now()}`,
                            timestamp: new Date().toISOString(),
                            response: message.text,
                            rf: 'up',
                            reason: 'System-approved: No negative feedback provided.',
                            isSystemRf: true,
                            files: fileReferences,
                            imageAnalysis: message.imageAnalysis,
                            audioAnalysis: message.audioAnalysis,
                        };
                        return {
                            ...unit,
                            experienceVector: {
                                ...unit.experienceVector,
                                neurons: [...(unit.experienceVector.neurons || []), newNeuron]
                            }
                        };
                    }
                    return unit;
                })
            }))
        })
    };


  return (
    <ThemeProvider>
        <div className="flex h-screen w-screen bg-background text-text-primary">
            <div className="flex flex-1">
                <Sidebar 
                  rooms={rooms} 
                  activeRoom={activeRoom}
                  onSelectRoom={(roomId) => setActiveRoom(rooms.find(r => r.id === roomId) || rooms[0])}
                />
                <div className="flex-1 flex flex-col min-w-0">
                    <Header 
                        apiSettings={apiSettings}
                        onApiSettingsChange={setApiSettings}
                        onAddApiKey={handleAddApiKey}
                        keyToDelete={keyToDelete}
                        onRequestDeleteApiKey={handleRequestDeleteApiKey}
                        onConfirmDeleteApiKey={handleConfirmDeleteApiKey}
                        onCancelDeleteApiKey={handleCancelDeleteApiKey}
                        connectionToDelete={connectionToDelete}
                        onAddCloudConnection={handleAddCloudConnection}
                        onRequestDeleteCloudConnection={handleRequestDeleteCloudConnection}
                        onConfirmDeleteCloudConnection={handleConfirmDeleteCloudConnection}
                        onCancelDeleteCloudConnection={handleCancelDeleteCloudConnection}
                        localConnectionToDelete={localConnectionToDelete}
                        onAddLocalProviderConnection={handleAddLocalProviderConnection}
                        onRequestDeleteLocalProviderConnection={handleRequestDeleteLocalProviderConnection}
                        onConfirmDeleteLocalProviderConnection={handleConfirmDeleteLocalProviderConnection}
                        onCancelDeleteLocalProviderConnection={handleCancelDeleteLocalProviderConnection}
                        onApiPortChange={handleApiPortChange}
                        audioDevices={audioDevices}
                        audioOutputDevices={audioOutputDevices}
                        onMicChange={(micId) => setApiSettings(prev => ({ ...prev, micId }))}
                        onSpeakerChange={(speakerId) => setApiSettings(prev => ({ ...prev, speakerId }))}
                        onPttKeyChange={(key) => setApiSettings(prev => ({ ...prev, pushToTalkKey: key }))}
                        onNoiseSuppressionChange={handleNoiseSuppressionChange}
                        onWebhookUrlChange={(url) => setApiSettings(prev => ({ ...prev, webhookUrl: url }))}
                        onMicGainChange={(gain) => setApiSettings(prev => ({ ...prev, micGain: gain }))}
                        onSpeakerGainChange={(gain) => setApiSettings(prev => ({ ...prev, speakerGain: gain }))}
                        rooms={rooms}
                        onResetToDefaults={handleResetToDefaults}
                        isResetModalOpen={isResetModalOpen}
                        onConfirmReset={handleConfirmReset}
                        onCancelReset={handleCancelReset}
                        outputVolumeLevel={outputVolumeLevel}
                        micVolumeLevel={micVolumeLevel}
                        onPlayTestTone={generateAndPlayTestTone}
                    />
                    <div className="flex-1 flex overflow-hidden">
                        <MainContent
                          activeRoom={activeRoom}
                          activeUnit={activeUnit}
                          allTools={rooms.find(r => r.name === RoomName.Tools)?.tools || []}
                          ragBases={ragBases}
                          apiSettings={apiSettings}
                          onSelectUnit={(unitId) => setActiveUnit(activeRoom.units.find(u => u.id === unitId) || null)}
                          onAddUnit={handleAddUnit}
                          onUpdateUnit={handleUpdateUnit}
                          onDeleteUnit={handleDeleteUnit}
                          onAddTool={handleAddTool}
                          onDeleteTool={handleDeleteTool}
                          onUpdateRagBase={handleUpdateRagBase}
                        />
                        <ChatWindow 
                            rooms={rooms}
                            apiSettings={apiSettings}
                            onAddUnit={handleAddUnit}
                            onDeleteUnit={handleDeleteUnit}
                            onUpdateUnit={handleUpdateUnit}
                            onAddTool={handleAddTool}
                            onDeleteTool={handleDeleteTool}
                            onDistributeFeedback={handleDistributeFeedback}
                            onSystemFeedback={handleSystemFeedback}
                            playAudioFromUrl={playAudioFromUrl}
                            isRecording={isRecording}
                            startRecording={startRecording}
                            stopRecording={stopRecording}
                            newlyRecordedFile={newlyRecordedFile}
                            onNewRecordingConsumed={onNewRecordingConsumed}
                        />
                    </div>
                </div>
            </div>
        </div>
    </ThemeProvider>
  );
}
