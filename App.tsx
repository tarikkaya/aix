import React, { useState, useCallback, useEffect } from 'react';
import { initialRooms, RoomName, initialRagBases, initialApiSettings, RERANKER_PROVIDERS } from './constants';
import type { Room, Unit, Tool, RAGBase, ApiSettings, ApiKey, InputDevice } from './types';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';
import ChatWindow from './components/layout/ChatWindow';
import { ThemeProvider } from './components/context/ThemeContext';

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
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [audioDevices, setAudioDevices] = useState<InputDevice[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<InputDevice[]>([]);

  // Load state from local storage only once on initial mount
  useEffect(() => {
    const savedState = loadState();
    if (savedState) {
        setRooms(savedState.rooms);
        setRagBases(savedState.ragBases);
        setApiSettings(savedState.apiSettings);
        // Ensure activeRoom is set from the loaded state
        const activeRoomFromState = savedState.rooms.find(r => r.id === initialRooms[0].id) || savedState.rooms[0];
        if (activeRoomFromState) {
            setActiveRoom(activeRoomFromState);
        }
    }
    setSavedStateLoaded(true); // Mark that we've attempted to load
  }, []);

  // Save state whenever it changes, but only after the initial load has completed.
  useEffect(() => {
      if (savedStateLoaded) {
          saveState({ rooms, ragBases, apiSettings });
      }
  }, [rooms, ragBases, apiSettings, savedStateLoaded]);

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
            if (unit.type === 'Drive' && unit.scaleVector.enabled && unit.scaleVector.values.length > 0) {
              let unitHasChanges = false;
              const newScaleValues = unit.scaleVector.values.map(val => {
                // Defensive check: Ensure defaultValue is a number and not equal to score.
                if (typeof val.defaultValue !== 'number' || val.score === val.defaultValue) {
                    return val;
                }
                
                let newScore = val.score;
                if (newScore > val.defaultValue) {
                  newScore = Math.max(val.defaultValue, newScore - 1);
                } else if (newScore < val.defaultValue) {
                  newScore = Math.min(val.defaultValue, newScore + 1);
                }
                
                if (newScore !== val.score) {
                  unitHasChanges = true;
                }
                return { ...val, score: newScore };
              });

              if (unitHasChanges) {
                roomHasChanges = true;
                return { ...unit, scaleVector: { ...unit.scaleVector, values: newScaleValues } };
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
      // Deep comparison to avoid unnecessary state updates
      if (JSON.stringify(currentActiveRoom) !== JSON.stringify(activeRoom)) {
        setActiveRoom(currentActiveRoom);
      }
      if (activeUnit) {
        const currentActiveUnit = currentActiveRoom.units.find(u => u.id === activeUnit.id);
        if (currentActiveUnit && JSON.stringify(currentActiveUnit) !== JSON.stringify(activeUnit)) {
          setActiveUnit(currentActiveUnit);
        } else if (!currentActiveUnit) {
          setActiveUnit(null);
        }
      }
    } else {
      // Active room doesn't exist anymore, switch to the first room
      setActiveRoom(rooms[0]);
    }
  }, [rooms, activeRoom, activeUnit]);


  useEffect(() => {
    /**
     * Normalizes a device label by removing common OS-specific prefixes
     * like "Default" or "Communications". This helps in identifying that
     * multiple entries refer to the same physical device.
     * e.g., "Default - Microphone (Realtek)" -> "Microphone (Realtek)"
     * e.g., "İletişim - Mikrofon (Realtek)" -> "Mikrofon (Realtek)"
     */
    const normalizeLabel = (label: string): string => {
      return label
        .replace(/^(Default|Varsayılan)\s*-\s*/i, '')
        .replace(/^(Communications|İletişim)\s*-\s*/i, '')
        .trim();
    };

    /**
     * Assigns a priority score to a device based on its label or deviceId.
     * This is used to select the "best" device entry when duplicates are found.
     * The special 'default' deviceId gets the highest priority, followed by
     * labels containing "Default", then "Communications".
     */
    const getDevicePriority = (device: MediaDeviceInfo): number => {
      if (device.deviceId === 'default') return 3;
      if (/^(Default|Varsayılan)/i.test(device.label)) return 2;
      if (/^(Communications|İletişim)/i.test(device.label)) return 1;
      return 0;
    };

    /**
     * Takes a raw list of devices from the browser and returns a de-duplicated list.
     * It groups devices by their normalized name and then picks the one with the
     * highest priority from each group. This resolves the issue where one physical
     * microphone appears multiple times in the list.
     */
    const getUniqueDevices = (devices: MediaDeviceInfo[], kind: 'audioinput' | 'audiooutput'): MediaDeviceInfo[] => {
      const devicesOfKind = devices.filter(d => d.kind === kind);
      const deviceMap = new Map<string, MediaDeviceInfo>();

      for (const device of devicesOfKind) {
        // Use the normalized label as the key for grouping, or deviceId as a fallback.
        const key = device.label ? normalizeLabel(device.label) : device.deviceId;
        const existingDevice = deviceMap.get(key);

        // If we haven't seen this device before, or the new one has a higher priority,
        // it becomes the new candidate for this key.
        if (!existingDevice || getDevicePriority(device) > getDevicePriority(existingDevice)) {
          deviceMap.set(key, device);
        }
      }
      return Array.from(deviceMap.values());
    };
    
    const getDevices = async () => {
      try {
        // We must request permission before we can get device labels.
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const mics = getUniqueDevices(devices, 'audioinput')
            .map((d, i) => ({ id: d.deviceId, name: d.label || `Microphone ${i + 1}` }));
        
        const speakers = getUniqueDevices(devices, 'audiooutput')
            .map((d, i) => ({ id: d.deviceId, name: d.label || `Speakers ${i + 1}` }));
        
        setAudioDevices(currentMics => {
            if (JSON.stringify(currentMics) === JSON.stringify(mics)) return currentMics;
            return mics;
        });

        setAudioOutputDevices(currentSpeakers => {
            if (JSON.stringify(currentSpeakers) === JSON.stringify(speakers)) return currentSpeakers;
            return speakers;
        });

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

      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    };

    // Initial device fetch
    getDevices();
    
    // Listen for any changes in media devices (e.g., plugging in a headset)
    navigator.mediaDevices.addEventListener('devicechange', getDevices);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, []);

  const handleSelectRoom = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      setActiveRoom(room);
    }
  };

  const handleSelectUnit = (unitId: string) => {
    const unit = activeRoom.units.find(u => u.id === unitId);
    setActiveUnit(unit || null);
  };
  
  const handleAddUnit = (roomId: string, type: 'Standard' | 'RAG' | 'Code RAG' | 'Drive') => {
    const unitId = `unit-${Date.now()}`;
    let newUnit: Unit;
    const roomForUnit = rooms.find(r => r.id === roomId);

    if (type === 'Code RAG') {
        newUnit = {
            id: unitId,
            name: `New Code RAG Unit`,
            type: 'Code RAG',
            purpose: 'To understand, store, retrieve, and analyze code snippets from its specialized knowledge base.',
            isLoopOpen: true,
            todo: { items: [] },
            todoVector: { provider: 'sqlite', path: `./aix_data/rooms/${roomId}/units/${unitId}/todo_vector.sqlite` },
            llmProvider: { provider: 'openai', model: 'gpt-4o' },
            prompt: 'You are a specialist in code analysis. Use your knowledge base of code snippets to answer questions, complete code, or find relevant examples.',
            trainingVector: { enabled: true, provider: 'lancedb', neurons: 0, path: `./aix_data/rooms/${roomId}/units/${unitId}/training_vector.lancedb` },
            experienceVector: { provider: 'lancedb', rf: 0, path: `./aix_data/rooms/${roomId}/units/${unitId}/experience_vector.lancedb` },
            standardDb: { provider: 'sqlite', enabled: true, path: `./aix_data/rooms/${roomId}/units/${unitId}/standard.db` },
            scaleVector: { enabled: false, provider: 'sqlite', path: `./aix_data/rooms/${roomId}/units/${unitId}/scale_vector.sqlite`, values: [] },
            tools: [],
        };
    } else {
        let unitName: string;
        switch (type) {
            case 'RAG':
                unitName = `New RAG Unit`;
                break;
            case 'Drive':
                unitName = `New Drive Unit`;
                break;
            default: // Standard
                unitName = `New Unit #${Math.floor(Math.random() * 1000)}`;
        }

        newUnit = {
            id: unitId,
            name: unitName,
            type: type, // This will be 'Standard', 'RAG', or 'Drive'
            purpose: 'Define the high-level purpose of this unit.',
            isLoopOpen: true,
            todo: { items: [] },
            todoVector: { provider: 'sqlite', path: `./aix_data/rooms/${roomId}/units/${unitId}/todo_vector.sqlite` },
            llmProvider: { provider: 'ollama', model: 'llama3-8b', path: 'http://localhost:11434' },
            prompt: 'This is a new unit. Define its core prompt.',
            trainingVector: { enabled: false, provider: 'lancedb', neurons: 0, path: `./aix_data/rooms/${roomId}/units/${unitId}/training_vector.lancedb` },
            experienceVector: { provider: 'lancedb', rf: 0, path: `./aix_data/rooms/${roomId}/units/${unitId}/experience_vector.lancedb` },
            standardDb: { provider: 'sqlite', enabled: false, path: './aix.db' },
            scaleVector: { enabled: false, provider: 'sqlite', path: `./aix_data/rooms/${roomId}/units/${unitId}/scale_vector.sqlite`, values: [] },
            tools: [],
        };
    }
    
    if (roomForUnit?.name === RoomName.Proactive) {
        newUnit.scheduler = {
            enabled: false,
            type: 'interval',
            intervalValue: 1,
            intervalUnit: 'days',
        };
        newUnit.isLoopOpen = false; // Proactive units default to closed loop
    }

    if (type === 'RAG' || type === 'Code RAG') {
        const ragBaseId = `ragbase-${Date.now()}`;
        newUnit.ragBaseId = ragBaseId;
        
        const isCodeBase = type === 'Code RAG';
        const baseNamePrefix = isCodeBase ? "New Code RAG Base" : "New RAG Base";
        
        const defaultRerankerProvider = RERANKER_PROVIDERS.find(p => p.id === 'embedded-rerank') || RERANKER_PROVIDERS[0];
        const defaultRerankerModel = defaultRerankerProvider?.models?.[0]?.id || '';

        const newRagBase: RAGBase = {
            id: ragBaseId,
            name: baseNamePrefix,
            embedding: {
                provider: 'ollama',
                model: 'nomic-embed-text',
                path: 'http://localhost:11434'
            },
            vectorStore: {
                provider: 'lancedb',
                path: `./aix_data/rag_bases/${ragBaseId}/vector_store.lancedb`
            },
            chunking: {
                chunkSize: isCodeBase ? 256 : 512,
                overlap: isCodeBase ? 30 : 50
            },
            retrieval: {
                topK: 3
            },
            reranker: {
                enabled: true,
                provider: defaultRerankerProvider.id,
                model: defaultRerankerModel,
                path: defaultRerankerProvider.type === 'local' ? 'http://localhost:8001/rerank' : undefined
            },
            useTranscript: false,
            dataConnectors: []
        };
        setRagBases(prev => [...prev, newRagBase]);
    }

    const newRooms = rooms.map(room => {
        if (room.id === roomId) {
            const updatedRoom = { ...room, units: [...room.units, newUnit] };
            setActiveRoom(updatedRoom);
            return updatedRoom;
        }
        return room;
    });
    setRooms(newRooms);
  };

  const handleUpdateUnit = (updatedUnit: Unit) => {
    const newRooms = rooms.map(room => {
        if (room.units.some(u => u.id === updatedUnit.id)) {
            const units = room.units.map(u => u.id === updatedUnit.id ? updatedUnit : u);
            const updatedRoom = { ...room, units };
            if (room.id === activeRoom.id) {
                setActiveRoom(updatedRoom);
            }
            return updatedRoom;
        }
        return room;
    });
    setRooms(newRooms);
    setActiveUnit(updatedUnit);
  };

  const handleUpdateRagBase = (updatedBase: RAGBase) => {
    setRagBases(prevBases => prevBases.map(b => b.id === updatedBase.id ? updatedBase : b));
  };

  const handleDeleteUnit = (unitId: string) => {
    const newRooms = rooms.map(room => {
      // Find the room containing the unit to be deleted.
      if (room.units.some(u => u.id === unitId)) {
          const updatedUnits = room.units.filter(u => u.id !== unitId);
          const updatedRoom = { ...room, units: updatedUnits };
          // If the deleted unit was in the currently active room, update it.
          if (room.id === activeRoom.id) {
              setActiveRoom(updatedRoom);
          }
          if (activeUnit?.id === unitId) setActiveUnit(null);
          return updatedRoom;
      }
      return room;
    });
    setRooms(newRooms);
  };

  const handleAddTool = (tool: Omit<Tool, 'id'>) => {
    const newTool: Tool = { ...tool, id: `tool-${Date.now()}` };
    setRooms(prevRooms => prevRooms.map(room => {
      if (room.name === RoomName.Tools) {
        return {
          ...room,
          tools: [...(room.tools || []), newTool]
        };
      }
      return room;
    }));
  };

  const handleDeleteTool = (toolId: string) => {
    setRooms(prevRooms => prevRooms.map(room => {
      if (room.name === RoomName.Tools) {
        return {
          ...room,
          tools: (room.tools || []).filter(t => t.id !== toolId)
        };
      }
      return room;
    }));
  };

  const handleAddApiKey = (key: ApiKey) => {
    setApiSettings(prev => ({
        ...prev,
        apiKeys: [...prev.apiKeys, key]
    }));
  };

  const requestDeleteApiKey = (keyId: string) => {
    const key = apiSettings.apiKeys.find(k => k.id === keyId);
    if (key) {
        setKeyToDelete(key);
    }
  };

  const confirmDeleteApiKey = () => {
    if (!keyToDelete) return;
    setApiSettings(prev => ({
        ...prev,
        apiKeys: prev.apiKeys.filter(k => k.id !== keyToDelete.id)
    }));
    setKeyToDelete(null);
  };
    
  const cancelDeleteApiKey = () => {
    setKeyToDelete(null);
  }

  const handleApiPortChange = (port: string) => {
    const portNumber = parseInt(port, 10);
    if (!isNaN(portNumber) && portNumber >= 0 && portNumber <= 65535) {
        setApiSettings(prev => ({ ...prev, apiPort: portNumber }));
    } else if (port === '') {
        setApiSettings(prev => ({ ...prev, apiPort: 0 }));
    }
  };

  const handleMicChange = (micId: string) => {
    setApiSettings(prev => ({ ...prev, micId }));
  };
  
  const handleSpeakerChange = (speakerId: string) => {
    setApiSettings(prev => ({ ...prev, speakerId }));
  };
  
  const handlePttKeyChange = (key: string) => {
    setApiSettings(prev => ({ ...prev, pushToTalkKey: key }));
  };
  
  const handleNoiseSuppressionChange = (enabled: boolean) => {
    setApiSettings(prev => ({ ...prev, noiseSuppression: enabled }));
  };

  const handleWebhookUrlChange = (url: string) => {
    setApiSettings(prev => ({...prev, webhookUrl: url}));
  };
  
  const handleMicGainChange = (gain: number) => {
    setApiSettings(prev => ({ ...prev, micGain: gain }));
  };

  const handleSpeakerGainChange = (gain: number) => {
    setApiSettings(prev => ({ ...prev, speakerGain: gain }));
  };

  const handleResetToDefaults = () => {
      setIsResetModalOpen(true);
  };

  const confirmReset = () => {
    // Manually reset state instead of reloading, which is more reliable in sandboxed environments.
    localStorage.removeItem(STATE_STORAGE_KEY);
    setRooms(initialRooms);
    setRagBases(initialRagBases);
    setApiSettings(initialApiSettings);
    setActiveRoom(initialRooms[0]);
    setActiveUnit(null);
    setIsResetModalOpen(false);
  };

  const cancelReset = () => {
    setIsResetModalOpen(false);
  };

  const allTools = rooms.find(r => r.name === RoomName.Tools)?.tools || [];

  return (
    <ThemeProvider>
      <div className="h-screen w-screen flex flex-col font-sans">
        <Header 
            apiSettings={apiSettings}
            onAddApiKey={handleAddApiKey}
            keyToDelete={keyToDelete}
            onRequestDeleteApiKey={requestDeleteApiKey}
            onConfirmDeleteApiKey={confirmDeleteApiKey}
            onCancelDeleteApiKey={cancelDeleteApiKey}
            onApiPortChange={handleApiPortChange}
            audioDevices={audioDevices}
            audioOutputDevices={audioOutputDevices}
            onMicChange={handleMicChange}
            onSpeakerChange={handleSpeakerChange}
            onPttKeyChange={handlePttKeyChange}
            onNoiseSuppressionChange={handleNoiseSuppressionChange}
            onWebhookUrlChange={handleWebhookUrlChange}
            onMicGainChange={handleMicGainChange}
            onSpeakerGainChange={handleSpeakerGainChange}
            rooms={rooms}
            onResetToDefaults={handleResetToDefaults}
            isResetModalOpen={isResetModalOpen}
            onConfirmReset={confirmReset}
            onCancelReset={cancelReset}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar rooms={rooms} activeRoom={activeRoom} onSelectRoom={handleSelectRoom} />
          <div className="flex flex-1 overflow-hidden">
            <MainContent
              activeRoom={activeRoom}
              activeUnit={activeUnit}
              allTools={allTools}
              ragBases={ragBases}
              onSelectUnit={handleSelectUnit}
              onAddUnit={handleAddUnit}
              onUpdateUnit={handleUpdateUnit}
              onDeleteUnit={handleDeleteUnit}
              onAddTool={handleAddTool}
              onDeleteTool={handleDeleteTool}
              onUpdateRagBase={handleUpdateRagBase}
            />
            <ChatWindow 
                rooms={rooms} 
                micId={apiSettings.micId} 
                micGain={apiSettings.micGain}
                onAddUnit={handleAddUnit}
                onDeleteUnit={handleDeleteUnit}
                onUpdateUnit={handleUpdateUnit}
                onAddTool={handleAddTool}
                onDeleteTool={handleDeleteTool}
            />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}