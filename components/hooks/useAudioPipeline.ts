
import { useState, useCallback, useEffect, useRef } from 'react';
import type { ApiSettings, ChatFile } from '../../types';

export function useAudioPipeline(apiSettings: ApiSettings, isAudioReady: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  // --- Output (Speaker) Bus ---
  const [outputVolumeLevel, setOutputVolumeLevel] = useState(0);
  const outputGainNodeRef = useRef<GainNode | null>(null);
  const outputAnalyserNodeRef = useRef<AnalyserNode | null>(null);
  const outputAnimationIdRef = useRef<number>(0);
  const speakerSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // --- Input (Mic) Bus & Recording ---
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const micAnalyserNodeRef = useRef<AnalyserNode | null>(null);
  const micAnimationIdRef = useRef<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [newlyRecordedFile, setNewlyRecordedFile] = useState<ChatFile | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const initAndResumeAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    if (audioContextRef.current && audioContextRef.current.state === 'running') return audioContextRef.current;
    if (!audioContextRef.current) {
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser.", e);
            return null;
        }
    }
    if (audioContextRef.current.state === 'suspended') {
        try {
            await audioContextRef.current.resume();
        } catch (e) {
            console.error("Could not resume audio context.", e);
            return null;
        }
    }
    return audioContextRef.current;
  }, []);

  const startOutputVisualization = useCallback(() => {
    const analyser = outputAnalyserNodeRef.current;
    if (!analyser) return;
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
        if (!outputAnalyserNodeRef.current) return;
        outputAnalyserNodeRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
        if (!isNaN(average)) setOutputVolumeLevel(average);
        outputAnimationIdRef.current = requestAnimationFrame(draw);
    };
    draw();
  }, [setOutputVolumeLevel]);

  const stopOutputVisualization = useCallback(() => {
      cancelAnimationFrame(outputAnimationIdRef.current);
      setOutputVolumeLevel(0);
  }, [setOutputVolumeLevel]);

  // Setup main output bus (gain -> analyser -> destination)
  useEffect(() => {
    if (!isAudioReady) return;
    const setupOutputBus = async () => {
        const context = await initAndResumeAudioContext();
        if (!context || outputGainNodeRef.current) return;
        try {
            const gain = context.createGain();
            const analyser = context.createAnalyser();
            gain.connect(analyser).connect(context.destination);
            outputGainNodeRef.current = gain;
            outputAnalyserNodeRef.current = analyser;
            startOutputVisualization();
        } catch (e) {
            console.error("Failed to setup main output bus", e);
        }
    };
    setupOutputBus();
    return () => {
        stopOutputVisualization();
        outputGainNodeRef.current?.disconnect();
        outputAnalyserNodeRef.current?.disconnect();
        outputGainNodeRef.current = null;
        outputAnalyserNodeRef.current = null;
    };
  }, [isAudioReady, initAndResumeAudioContext, startOutputVisualization, stopOutputVisualization]);
  
  // Connect the <audio> element player to the main output bus
  useEffect(() => {
    if (!isAudioReady) return;
    const setupAudioPlayer = async () => {
        if (!audioPlayerRef.current) audioPlayerRef.current = new Audio();
        const context = await initAndResumeAudioContext();
        if (!context || !outputGainNodeRef.current || speakerSourceNodeRef.current) return;
        try {
            const source = context.createMediaElementSource(audioPlayerRef.current);
            source.connect(outputGainNodeRef.current);
            speakerSourceNodeRef.current = source;
        } catch (e) {
            if (e instanceof DOMException && e.name === 'InvalidStateError') console.warn("Caught InvalidStateError for speaker graph, likely due to hot-reload.");
            else console.error("Error setting up speaker audio graph", e);
        }
    };
    setupAudioPlayer();
    return () => {
        speakerSourceNodeRef.current?.disconnect();
        speakerSourceNodeRef.current = null;
    };
  }, [isAudioReady, initAndResumeAudioContext]);

  // Control output bus gain
  useEffect(() => {
      if (outputGainNodeRef.current && audioContextRef.current) {
          outputGainNodeRef.current.gain.setTargetAtTime(apiSettings.speakerGain, audioContextRef.current.currentTime, 0.01);
      }
  }, [apiSettings.speakerGain]);

  // Control output device (sink)
  useEffect(() => {
      const audioPlayer = audioPlayerRef.current;
      if (audioPlayer && apiSettings.speakerId && typeof (audioPlayer as any).setSinkId === 'function') {
          (audioPlayer as any).setSinkId(apiSettings.speakerId).catch((err: any) => console.warn("Could not set sink ID:", err.message));
      }
  }, [apiSettings.speakerId]);

  const startMicVisualization = useCallback(() => {
    const analyser = micAnalyserNodeRef.current;
    if (!analyser) return;
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
        if (!micAnalyserNodeRef.current) return;
        micAnalyserNodeRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
        if (!isNaN(average)) setMicVolumeLevel(average);
        micAnimationIdRef.current = requestAnimationFrame(draw);
    };
    draw();
  }, [setMicVolumeLevel]);

  const stopMicVisualization = useCallback(() => {
      cancelAnimationFrame(micAnimationIdRef.current);
      setMicVolumeLevel(0);
  }, [setMicVolumeLevel]);

  // Setup Microphone Input Graph
  useEffect(() => {
    if (!isAudioReady) return;
    let isCancelled = false;
    const setupMicGraph = async () => {
        // Clean up previous stream if it exists
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }
        if (micSourceNodeRef.current) {
            micSourceNodeRef.current.disconnect();
            micSourceNodeRef.current = null;
        }
        stopMicVisualization();

        if (!apiSettings.micId) return;

        const context = await initAndResumeAudioContext();
        if (!context || isCancelled) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    deviceId: { exact: apiSettings.micId },
                    noiseSuppression: apiSettings.noiseSuppression,
                    autoGainControl: true,
                    echoCancellation: true,
                } 
            });

            if (isCancelled) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            micStreamRef.current = stream;
            const source = context.createMediaStreamSource(stream);
            const gainNode = context.createGain();
            const analyser = context.createAnalyser();
            source.connect(gainNode).connect(analyser); // Not connected to destination to prevent feedback
            micSourceNodeRef.current = source;
            micGainNodeRef.current = gainNode;
            micAnalyserNodeRef.current = analyser;
            startMicVisualization();
        } catch (err) {
            console.error("Error setting up mic audio graph:", err);
            setMicVolumeLevel(0);
        }
    };
    
    setupMicGraph();
    
    return () => {
        isCancelled = true;
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }
        if (micSourceNodeRef.current) {
            micSourceNodeRef.current.disconnect();
            micSourceNodeRef.current = null;
        }
        if (micGainNodeRef.current) {
            micGainNodeRef.current.disconnect();
            micGainNodeRef.current = null;
        }
        micAnalyserNodeRef.current = null; // This is connected to gain, which is already disconnected.
        stopMicVisualization();
    };
  }, [isAudioReady, apiSettings.micId, apiSettings.noiseSuppression, initAndResumeAudioContext, startMicVisualization, stopMicVisualization]);

  // Control mic gain
  useEffect(() => {
      if (micGainNodeRef.current && audioContextRef.current) {
          micGainNodeRef.current.gain.setTargetAtTime(apiSettings.micGain, audioContextRef.current.currentTime, 0.01);
      }
  }, [apiSettings.micGain]);
  
  const generateAndPlayTestTone = useCallback(async () => {
    const context = await initAndResumeAudioContext();
    const outputBus = outputGainNodeRef.current;

    if (!context || !outputBus) {
        console.error("Audio context or output bus not ready for test tone.");
        return;
    }

    try {
        const oscillator = context.createOscillator();
        const rampGainNode = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, context.currentTime);

        rampGainNode.gain.setValueAtTime(0, context.currentTime);
        rampGainNode.gain.linearRampToValueAtTime(0.5, context.currentTime + 0.02);
        rampGainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.3);

        oscillator.connect(rampGainNode).connect(outputBus);
        
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.3);

    } catch (e) {
        console.error("Failed to play test tone:", e);
    }
  }, [initAndResumeAudioContext]);

  const playAudioFromUrl = useCallback(async (url: string) => {
      const player = audioPlayerRef.current;
      if (player) {
          await initAndResumeAudioContext();
          player.src = url;
          player.play().catch(e => console.error("Error playing audio:", e));
      }
  }, [initAndResumeAudioContext]);

    const startRecording = useCallback(() => {
        if (isRecording || !micStreamRef.current) return;
        
        try {
            const streamToRecord = micStreamRef.current;
            
            if (micGainNodeRef.current && audioContextRef.current) {
                micGainNodeRef.current.gain.setValueAtTime(apiSettings.micGain, audioContextRef.current.currentTime);
            }

            mediaRecorderRef.current = new MediaRecorder(streamToRecord);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = event => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const newFile: ChatFile = {
                        name: `recording-${Date.now()}.wav`,
                        type: 'audio/wav',
                        content: reader.result as string
                    };
                    setNewlyRecordedFile(newFile);
                };
                reader.readAsDataURL(audioBlob);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error starting recording:", err);
            alert("Could not start recording. Please check microphone permissions and settings.");
            setIsRecording(false);
        }
    }, [isRecording, apiSettings.micGain]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    }, []);

    const onNewRecordingConsumed = useCallback(() => {
        setNewlyRecordedFile(null);
    }, []);

    return {
        outputVolumeLevel,
        micVolumeLevel,
        isRecording,
        newlyRecordedFile,
        generateAndPlayTestTone,
        playAudioFromUrl,
        startRecording,
        stopRecording,
        onNewRecordingConsumed
    };
}
