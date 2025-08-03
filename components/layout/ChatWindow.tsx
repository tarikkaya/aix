import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage as ChatMessageType, ChatFile, Room, Unit, ApiSettings, CloudConnection, LocalProviderConnection, ImageMetadata, AudioMetadata } from '../../types';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { RoomName, LLM_PROVIDERS } from '../../constants';


const CodeBlock: React.FC<{ language: string; value: string }> = ({ language, value }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="my-2 bg-[#1E1E1E] rounded-md overflow-hidden border border-border-color">
            <div className="flex justify-between items-center px-4 py-1 bg-surface-light text-xs text-text-secondary">
                <span>{language || 'code'}</span>
                <button onClick={handleCopy} className="flex items-center space-x-1">
                    <Icon name="copy" className="w-3 h-3" />
                    <span>{copied ? 'Copied!' : 'Copy code'}</span>
                </button>
            </div>
            <SyntaxHighlighter language={language} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem' }}>
                {value}
            </SyntaxHighlighter>
        </div>
    );
};

const ThinkingMessage: React.FC = () => (
    <div className="flex flex-col my-4 items-start">
        <div className="text-xs font-bold mb-1 text-text-secondary px-1 text-left">
            AIX
        </div>
        <div className="max-w-xl p-3 rounded-lg bg-surface-light text-text-primary rounded-bl-none">
            <div className="flex items-center space-x-2 text-sm">
                <Icon name="spinner" className="w-4 h-4 animate-spin" />
                <span>Thinking...</span>
            </div>
        </div>
    </div>
);


const ChatMessage: React.FC<{ message: ChatMessageType; onFeedback: (id: string, feedback: 'up' | 'down') => void; onImageZoom: (src: string) => void }> = ({ message, onFeedback, onImageZoom }) => {
  const isUser = message.sender === 'user';
  
  if (message.isThinking) {
      return <ThinkingMessage />;
  }

  const renderFile = (file: ChatFile, isAiMessage: boolean) => {
    if (file.type.startsWith('image/')) {
        const imageElement = <img src={file.content} alt={file.name} className="rounded-md max-h-60 cursor-pointer" />;
        
        if (isAiMessage) {
             return (
                <div key={file.name} className="bg-surface border border-border-color p-2 rounded-lg my-2">
                    <div className="text-xs text-text-secondary mb-2 font-semibold">Generated Image</div>
                    <button onClick={() => onImageZoom(file.content)} className="block" aria-label={`Zoom in on image ${file.name}`}>
                       {imageElement}
                    </button>
                </div>
            );
        }
        
        return (
            <button key={file.name} onClick={() => onImageZoom(file.content)} className="block my-2" aria-label={`Zoom in on image ${file.name}`}>
                {imageElement}
            </button>
        );
    }
    if (file.type.startsWith('audio/')) {
        if (isAiMessage) {
            return (
                <div key={file.name} className="flex items-center space-x-2 my-1 p-2 bg-surface rounded-md">
                    <Icon name="speaker-wave" className="w-5 h-5 text-text-secondary" />
                    <span className="text-sm text-text-secondary">Audio response played</span>
                </div>
            );
        }
        return (
            <div key={file.name} className="flex items-center space-x-2 my-1">
                <audio controls src={file.content} className="w-full h-10" />
            </div>
        );
    }
    return (
        <div key={file.name} className="bg-surface border border-border-color p-3 rounded-lg my-2 flex items-center gap-3">
            <Icon name="document-text" className="w-6 h-6 flex-shrink-0 text-text-secondary"/>
            <div className="flex-grow overflow-hidden">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-text-secondary">{file.type}</p>
            </div>
        </div>
    );
  }

  return (
    <div className={`flex flex-col my-4 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`text-xs font-bold mb-1 text-text-secondary px-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {isUser ? 'USER' : 'AIX'}
        </div>
        <div className={`max-w-xl p-3 rounded-lg ${isUser ? 'bg-primary text-white rounded-br-none' : 'bg-surface-light text-text-primary rounded-bl-none'}`}>
            {message.files && message.files.length > 0 && (
                <div className="space-y-2 mb-2">
                    {message.files.map(file => renderFile(file, !isUser))}
                </div>
            )}
            {message.text && (
               <div className="text-sm prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                 <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                        code({ node, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeString = String(children).replace(/\n$/, '');
                            return match ? (
                                <CodeBlock language={match[1]} value={codeString} />
                            ) : (
                                <code className="bg-surface px-1 py-0.5 rounded-sm" {...props}>{children}</code>
                            );
                        },
                    }}
                 >
                    {message.text}
                 </ReactMarkdown>
               </div>
            )}
            {!isUser && (
              <div className="flex items-center justify-end mt-2 space-x-2">
                 {message.systemRf && <span className="text-xs text-text-secondary italic">System RF applied</span>}
                <button onClick={() => onFeedback(message.id, 'up')} className={`p-1 rounded-full ${message.rf === 'up' ? 'bg-green-500/30 text-green-400' : 'hover:bg-surface'}`}>
                    <Icon name="arrow-up" className="w-4 h-4"/>
                </button>
                <button onClick={() => onFeedback(message.id, 'down')} className={`p-1 rounded-full ${message.rf === 'down' ? 'bg-red-500/30 text-red-400' : 'hover:bg-surface'}`}>
                    <Icon name="arrow-down" className="w-4 h-4"/>
                </button>
              </div>
            )}
        </div>
    </div>
  );
};


const simulateAgiResponse = async (
    message: ChatMessageType,
    rooms: Room[],
    apiSettings: ApiSettings,
): Promise<{
    responseText: string;
    participantUnitIds: string[];
    generatedFile?: ChatFile;
    imageAnalysis?: ImageMetadata;
    audioAnalysis?: AudioMetadata;
    error?: string;
}> => {
    const participantUnitIds: string[] = [];
    let finalGeneratedFile: ChatFile | undefined = undefined;
    const { cloudConnections, localProviderConnections } = apiSettings;

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const findUnit = (unitName: string): (Unit | undefined) => rooms.flatMap(r => r.units).find(u => u.name === unitName);

    // --- DIAGNOSTIC WORKFLOW ---
    const diagnosticTriggers = ['run diagnostics', 'system check'];
    const isDiagnosticRequest = diagnosticTriggers.some(trigger => message.text.toLowerCase().includes(trigger));

    if (isDiagnosticRequest) {
        const adminManager = findUnit('Admin Manager');
        const systemTestUnit = findUnit('System Test Unit');
        const chatResponder = findUnit('Chat Responder');
        
        if (!adminManager || !systemTestUnit || !chatResponder) {
            return { responseText: '', participantUnitIds: [], error: 'Diagnostic-related units (Admin Manager, System Test Unit, Chat Responder) not found. Cannot perform system check.' };
        }

        participantUnitIds.push(adminManager.id, systemTestUnit.id);
        await delay(200);

        const misconfiguredUnits: string[] = [];
        const allUnits = rooms.flatMap(r => r.units);

        for (const unit of allUnits) {
            let errorReason = '';
            const { llmProvider } = unit;
            
            if (!llmProvider?.provider) {
                errorReason = 'Missing LLM provider selection.';
            } else if (!llmProvider?.model) {
                errorReason = 'Missing LLM model selection.';
            } else {
                const providerInfo = LLM_PROVIDERS.find(p => p.id === llmProvider.provider);
                if (!providerInfo) {
                    errorReason = `Invalid LLM provider ID '${llmProvider.provider}'.`;
                } else if (providerInfo.type === 'cloud') {
                    if (!llmProvider.connectionId || !cloudConnections.find(c => c.id === llmProvider.connectionId)) {
                        errorReason = 'Missing or invalid Cloud Connection.';
                    }
                } else if (providerInfo.type === 'local') {
                    if (!llmProvider.connectionId || !localProviderConnections.find(c => c.id === llmProvider.connectionId)) {
                        errorReason = 'Missing or invalid Local Provider Connection.';
                    }
                }
            }
            
            if (errorReason) {
                const roomName = rooms.find(r => r.units.some(u => u.id === unit.id))?.name || 'Unknown Room';
                misconfiguredUnits.push(`- Unit: "${unit.name}" (in ${roomName})\n  - Issue: ${errorReason}`);
            }
            await delay(25); // Simulate checking each unit
        }
        
        const commsChief = findUnit('Comms Chief');
        if (commsChief) participantUnitIds.push(commsChief.id);
        const chiefArbiter = findUnit('Chief Arbiter');
        if (chiefArbiter) participantUnitIds.push(chiefArbiter.id);
        
        participantUnitIds.push(chatResponder.id);
        await delay(150);

        let reportText = '';
        if (misconfiguredUnits.length === 0) {
            reportText = 'System diagnostics complete. All units are configured and ready for operation.';
        } else {
            reportText = 'System diagnostics complete. The following units have configuration issues:\n\n' + misconfiguredUnits.join('\n');
        }

        return {
            responseText: reportText,
            participantUnitIds,
        };
    }
    // --- END OF DIAGNOSTIC WORKFLOW ---

    // --- 0. Provider Configuration Check ---
    const keyUnitNames = ['Admin Manager', 'Lead Thinker', 'Chief Arbiter', 'Chat Responder'];
    for (const unitName of keyUnitNames) {
        const unit = findUnit(unitName);
        if (!unit) {
            return { responseText: '', participantUnitIds: [], error: `Critical unit '${unitName}' not found.` };
        }
        
        const provider = LLM_PROVIDERS.find(p => p.id === unit.llmProvider.provider);
        if (!provider || !unit.llmProvider.model) {
            return { responseText: '', participantUnitIds: [], error: `Provider settings are incomplete for '${unitName}'. Please select a provider and model.` };
        }
        
        if (provider.type === 'cloud') {
            const connectionId = unit.llmProvider.connectionId;
            if (!connectionId || !cloudConnections.find(c => c.id === connectionId)) {
                return { responseText: '', participantUnitIds: [], error: `Provider settings are incomplete for '${unitName}'. Please select a valid Cloud Connection.` };
            }
        } else if (provider.type === 'local') {
             const connectionId = unit.llmProvider.connectionId;
             if (!connectionId || !localProviderConnections.find(c => c.id === connectionId)) {
                return { responseText: '', participantUnitIds: [], error: `Provider settings are incomplete for '${unitName}'. Please select a valid Local Provider Connection.` };
            }
        }
    }


    const hasImage = message.files?.some(f => f.type.startsWith('image/'));
    const hasAudio = message.files?.some(f => f.type.startsWith('audio/'));
    let processedText = message.text;
    let imageAnalysis: ImageMetadata | undefined = undefined;
    let audioAnalysis: AudioMetadata | undefined = undefined;
    
    // --- 1. Admin Manager receives the request ---
    const adminManager = findUnit('Admin Manager');
    if (!adminManager) {
      const errorMsg = "Critical unit 'Admin Manager' not found.";
      return { responseText: '', participantUnitIds: [], error: errorMsg };
    }
    participantUnitIds.push(adminManager.id);
    await delay(150);
    
    // --- 1.5. Sensory Pre-processing & Initial Logging Step ---
    // Log the user's message AFTER sensory analysis but BEFORE the main cognitive loop
    let chatHistorian = findUnit('Chat Historian');
    let headLibrarian = findUnit('Head Librarian');

    if (hasImage) {
        const visualRoom = rooms.find(r => r.name === RoomName.Visual);
        const artDirector = visualRoom?.units.find(u => u.name === 'Art Director');
        if (artDirector && visualRoom) {
            participantUnitIds.push(artDirector.id);
            await delay(200);

            const visualSpecialists = visualRoom.units.filter(u => u.name !== 'Art Director' && u.isLoopOpen && u.name !== 'Image Generation Specialist');
            if (visualSpecialists.length > 0) {
                for (const unit of visualSpecialists) {
                    participantUnitIds.push(unit.id);
                    await delay(100);
                }
            }
            imageAnalysis = {
                description: 'A detailed analysis of the provided image.',
                sceneRelationships: 'The main subject is centered, with a clear foreground and background.',
            };
            processedText = `[Image Content Analysis: An analysis of the provided image is attached to this request.]\n\n${message.text}`;
            await delay(150);
        }
    } else if (hasAudio) {
        const soundRoom = rooms.find(r => r.name === RoomName.Sound);
        const audioDirector = soundRoom?.units.find(u => u.name === 'Audio Director');
        if (audioDirector && soundRoom) {
            participantUnitIds.push(audioDirector.id);
            await delay(200);

            const sttUnit = soundRoom.units.find(u => u.name === 'Speech-to-Text Transcriber');
            if(sttUnit) {
                await delay(200);
                participantUnitIds.push(sttUnit.id);
                const simulatedTranscription = `Hello world, what is the weather like in Istanbul today?`;
                audioAnalysis = {
                    transcription: simulatedTranscription,
                    wordTimestamps: simulatedTranscription.split(' ').map((word, index) => ({
                        word,
                        start: index * 0.5,
                        end: index * 0.5 + 0.4
                    }))
                };
                processedText = `[User Speech Transcription: ${simulatedTranscription}]\n\n${message.text}`;
            }
            await delay(150);
        }
    }
    
    // --- 2. Information Gathering Phase (Read from History) ---
    if(headLibrarian && chatHistorian) {
        participantUnitIds.push(headLibrarian.id);
        await delay(150);
        participantUnitIds.push(chatHistorian.id);
        await delay(200);
        processedText += `\n[Internal Context from Chat Historian: User has previously asked about AI safety protocols.]`;
    }

    // --- 3. Pass to Thought Room for Orchestration ---
    const thoughtRoom = rooms.find(r => r.name === RoomName.Thought);
    const leadThinker = findUnit('Lead Thinker');
    if (!leadThinker || !thoughtRoom) {
      const errorMsg = "Critical unit 'Lead Thinker' or its room not found.";
      return { responseText: '', participantUnitIds: [], error: errorMsg };
    }
    participantUnitIds.push(leadThinker.id);
    await delay(200);
    
    // --- 3b. External Knowledge (Information Search Room) ---
    const needsExternalInfo = processedText.toLowerCase().includes('weather in');
    if(needsExternalInfo) {
        const chiefExplorer = findUnit('Chief Explorer');
        const weatherUnit = findUnit('Weather Unit');
        if(chiefExplorer && weatherUnit) {
            participantUnitIds.push(chiefExplorer.id);
            await delay(150);
            participantUnitIds.push(weatherUnit.id);
            await delay(500); // Simulate web scraping
            processedText += `\n[External Data from Weather Unit: The weather in Istanbul is currently 25°C and sunny.]`;
        }
    }

    // --- 4. Synthesize Plan in Thought Room ---
    const thoughtSpecialists = thoughtRoom.units.filter(u => u.name !== 'Lead Thinker' && u.isLoopOpen);
    if (thoughtSpecialists.length > 0) {
        for (const unit of thoughtSpecialists) {
            participantUnitIds.push(unit.id);
            await delay(100);
        }
    }
    await delay(150); // Simulate final plan synthesis
    
    // --- 5. Pass to Sanctions Room ---
    const sanctionsRoom = rooms.find(r => r.name === RoomName.Sanctions);
    const chiefArbiter = findUnit('Chief Arbiter');
    if (!chiefArbiter || !sanctionsRoom) {
       const errorMsg = "Critical unit 'Chief Arbiter' or its room not found.";
       return { responseText: '', participantUnitIds: [], error: errorMsg };
    }
    participantUnitIds.push(chiefArbiter.id);
    await delay(200);

    const isImageGenRequest = processedText.toLowerCase().includes('generate an image') || processedText.toLowerCase().includes('draw a');
    
    if (isImageGenRequest) {
        const artDirector = findUnit('Art Director');
        const imageGenUnit = findUnit('Image Generation Specialist');
        if (artDirector && imageGenUnit) {
            participantUnitIds.push(artDirector.id);
            await delay(150);
            
            participantUnitIds.push(imageGenUnit.id);
            await delay(1500); // Simulate image generation time
            
            const base64Placeholder = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABTSURBVHhe7cEBAQAAAIIg/69uSEABAAAAAAAAAAAAAADg9wB2BwEAAAAAAACsCgAAAAAAAACwKgAAAAAAAACwKgAAAAAAAACsCgAAAAAAAMBvB+hnAQUAAAAAAAAAAAAAALx0AY4NBIeSU2QkAAAAAElFTkSuQmCC";
            finalGeneratedFile = { name: "aix-generated-image.png", type: "image/png", content: `data:image/png;base64,${base64Placeholder}` };
            imageAnalysis = { ...imageAnalysis, imageGenerated: true, description: 'An AI-generated placeholder image.' };
        }
    }
    
    // --- 6. Final Response Generation ---
    let finalResponseText = "Task completed successfully.";
    if (hasAudio) {
        const ttsUnit = findUnit('Text-to-Speech Synthesizer');
        if (ttsUnit) {
            participantUnitIds.push(ttsUnit.id);
            await delay(1000); // Simulate TTS generation
            
            const silentAudio = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
            finalGeneratedFile = { name: `response-${Date.now()}.wav`, type: "audio/wav", content: silentAudio };
            audioAnalysis = { ...audioAnalysis, ttsGenerated: true };
            finalResponseText = ""; // No text response needed when audio is generated
        }
    } else {
        const chatResponder = findUnit('Chat Responder');
        if (chatResponder) {
            participantUnitIds.push(chatResponder.id);
            await delay(250);
            
            if (isImageGenRequest) {
                finalResponseText = "As requested, I've generated an image for you.";
            } else if (needsExternalInfo) {
                finalResponseText = "According to my Weather Unit, the weather in Istanbul is 25°C and sunny.";
            } else {
                finalResponseText = "I have analyzed your request based on internal and external data, and completed the necessary actions. What is our next objective?";
            }
        }
    }
    
    // --- 7. Final Logging Step (Write to History) ---
    // The Chat Historian logs the final, user-facing response before it's sent.
    if (chatHistorian) {
        // We add it again to signify a separate "write" operation at the end of the protocol.
        participantUnitIds.push(chatHistorian.id);
        await delay(150);
    }

    return { 
        responseText: finalResponseText, 
        participantUnitIds, 
        generatedFile: finalGeneratedFile,
        imageAnalysis,
        audioAnalysis,
    };
};

const ChatInput: React.FC<{
    onSendMessage: (text: string, files: ChatFile[]) => void;
    isRecording: boolean;
    startRecording: () => void;
    stopRecording: () => void;
}> = ({ onSendMessage, isRecording, startRecording, stopRecording }) => {
    const [text, setText] = useState('');
    const [files, setFiles] = useState<ChatFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSendMessage = () => {
        if (!text.trim() && files.length === 0) return;
        onSendMessage(text, files);
        setText('');
        setFiles([]);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        const filePromises = Array.from(event.target.files).map(file => {
            return new Promise<ChatFile>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve({ name: file.name, type: file.type, content: e.target?.result as string });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });
        const newFiles = await Promise.all(filePromises);
        setFiles(prev => [...prev, ...newFiles]);
        if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
    };

    const removeFile = (fileName: string) => {
        setFiles(prev => prev.filter(f => f.name !== fileName));
    };

    return (
        <div className="p-4 bg-surface border-t border-border-color">
            {files.length > 0 && (
                <div className="mb-2 space-y-2">
                    {files.map(file => (
                        <div key={file.name} className="flex items-center justify-between p-2 bg-surface-light rounded-md text-sm">
                            <div className="flex items-center space-x-2 overflow-hidden">
                                <Icon name={file.type.startsWith('image') ? 'photo' : 'document-text'} className="w-5 h-5 flex-shrink-0 text-text-secondary" />
                                <span className="truncate">{file.name}</span>
                            </div>
                            <button onClick={() => removeFile(file.name)} className="p-1 hover:bg-surface rounded-full"><Icon name="x-mark" className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-center bg-surface-light rounded-lg">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    multiple 
                    className="hidden" 
                    accept=".txt,.doc,.docx,.pdf,.mp3,.wav,.jpg,.png"
                />
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-text-secondary hover:text-primary"><Icon name="paper-clip" className="w-5 h-5" /></button>
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="Type a message or drop files..."
                    rows={1}
                    className="flex-1 bg-transparent p-2 focus:outline-none resize-none max-h-40"
                />
                <button 
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`p-3 rounded-full transition-colors ${isRecording ? 'text-white bg-red-500 animate-pulse' : 'text-text-secondary hover:text-primary'}`}
                >
                    <Icon name="microphone" className="w-5 h-5" />
                </button>
                <button onClick={handleSendMessage} className="p-3 text-text-secondary hover:text-primary disabled:opacity-50" disabled={!text.trim() && files.length === 0}>
                    <Icon name="send" className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

const ImageZoomModal: React.FC<{ src: string | null; onClose: () => void }> = ({ src, onClose }) => {
    if (!src) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center" onClick={onClose}>
            <img src={src} alt="Zoomed view" className="max-w-[90vw] max-h-[90vh] object-contain" />
        </div>
    );
};

interface ChatWindowProps {
    rooms: Room[];
    apiSettings: ApiSettings;
    onAddUnit: (roomId: string, type: 'Standard' | 'RAG' | 'Code RAG' | 'Drive') => void;
    onDeleteUnit: (unitId: string) => void;
    onUpdateUnit: (unit: Unit) => void;
    onAddTool: (tool: any) => void;
    onDeleteTool: (toolId: string) => void;
    onDistributeFeedback: (message: ChatMessageType, rf: 'up' | 'down', reason: string) => void;
    onSystemFeedback: (message: ChatMessageType) => void;
    playAudioFromUrl: (url: string) => void;
    isRecording: boolean;
    startRecording: () => void;
    stopRecording: () => void;
    newlyRecordedFile: ChatFile | null;
    onNewRecordingConsumed: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = (props) => {
    const { 
        rooms, apiSettings, onDistributeFeedback, onSystemFeedback, 
        playAudioFromUrl, isRecording, startRecording, stopRecording,
        newlyRecordedFile, onNewRecordingConsumed
    } = props;
    
    const [messages, setMessages] = useState<ChatMessageType[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [feedbackModal, setFeedbackModal] = useState<{ messageId: string, feedback: 'up' | 'down' } | null>(null);
    const [feedbackReason, setFeedbackReason] = useState('');
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages, isThinking]);

    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.sender === 'ai' && !lastMessage.rf && !lastMessage.systemRf) {
            const timer = setTimeout(() => {
                onSystemFeedback(lastMessage);
                setMessages(prev => prev.map(m => m.id === lastMessage.id ? { ...m, systemRf: true } : m));
            }, 15000);
            return () => clearTimeout(timer);
        }
    }, [messages, onSystemFeedback]);
    
    const handleSendMessage = useCallback(async (text: string, files: ChatFile[]) => {
        const userMessage: ChatMessageType = {
            id: `msg-${new Date().toISOString()}`,
            sender: 'user',
            text,
            files,
            timestamp: new Date().toISOString(),
        };
        
        const chatHistorian = rooms.flatMap(r => r.units).find(u => u.name === 'Chat Historian');
        if (chatHistorian) {
            // Log user message immediately for chronological accuracy in the simulation
            // (This is a conceptual logging, not a real async op here)
        }

        setMessages(prev => [...prev, userMessage]);
        setIsThinking(true);

        const result = await simulateAgiResponse(userMessage, rooms, apiSettings);
        
        setIsThinking(false);
        
        if(result.error) {
            const errorMessage: ChatMessageType = {
                id: `err-${new Date().toISOString()}`,
                sender: 'ai',
                text: result.error,
                timestamp: new Date().toISOString(),
                participantUnitIds: []
            };
            setMessages(prev => [...prev, errorMessage]);
            return;
        }

        const aiMessage: ChatMessageType = {
            id: `ai-${new Date().toISOString()}`,
            sender: 'ai',
            text: result.responseText,
            timestamp: new Date().toISOString(),
            participantUnitIds: result.participantUnitIds,
            files: result.generatedFile ? [result.generatedFile] : [],
            imageAnalysis: result.imageAnalysis,
            audioAnalysis: result.audioAnalysis,
        };
        
        // Log AI response conceptually *before* setting state, as per protocol
        if(chatHistorian) {
            // The fact that chatHistorian.id is in aiMessage.participantUnitIds at the end
            // signifies this logging event took place.
        }

        setMessages(prev => [...prev, aiMessage]);
        
        if (result.generatedFile?.type.startsWith('audio/')) {
            playAudioFromUrl(result.generatedFile.content);
        }

    }, [rooms, apiSettings, playAudioFromUrl]);
    
    useEffect(() => {
        if(newlyRecordedFile) {
            handleSendMessage('', [newlyRecordedFile]);
            onNewRecordingConsumed();
        }
    }, [newlyRecordedFile, onNewRecordingConsumed, handleSendMessage]);

    const handleFeedback = (messageId: string, feedback: 'up' | 'down') => {
        setFeedbackModal({ messageId, feedback });
    };

    const submitFeedback = () => {
        if (!feedbackModal) return;
        const message = messages.find(m => m.id === feedbackModal.messageId);
        if (message) {
            onDistributeFeedback(message, feedbackModal.feedback, feedbackReason);
            setMessages(prev => prev.map(m => m.id === message.id ? { ...m, rf: feedbackModal.feedback, rfReason: feedbackReason, systemRf: false } : m));
        }
        setFeedbackModal(null);
        setFeedbackReason('');
    };

    return (
        <aside className="w-full lg:w-2/5 xl:w-1/3 bg-surface-light border-l border-border-color flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4">
                {messages.map(msg => (
                    <ChatMessage key={msg.id} message={msg} onFeedback={handleFeedback} onImageZoom={setZoomedImage} />
                ))}
                {isThinking && <ThinkingMessage />}
                <div ref={messagesEndRef} />
            </div>
            <ChatInput 
                onSendMessage={handleSendMessage} 
                isRecording={isRecording}
                startRecording={startRecording}
                stopRecording={stopRecording}
            />
            {feedbackModal && (
                <Modal isOpen={!!feedbackModal} onClose={() => setFeedbackModal(null)} title="Provide Feedback">
                    <p className="text-sm text-text-secondary mb-2">Why did you give this response a <span className={`font-bold ${feedbackModal.feedback === 'up' ? 'text-green-500' : 'text-red-500'}`}>{feedbackModal.feedback === 'up' ? 'thumbs up' : 'thumbs down'}</span>?</p>
                    <textarea value={feedbackReason} onChange={e => setFeedbackReason(e.target.value)} className="w-full h-24 p-2 bg-surface border border-border-color rounded-md" placeholder="e.g., The answer was very creative. / The code had a bug."/>
                    <div className="flex justify-end mt-4">
                        <button onClick={submitFeedback} className="bg-primary text-white px-4 py-2 rounded-md">Submit</button>
                    </div>
                </Modal>
            )}
            <ImageZoomModal src={zoomedImage} onClose={() => setZoomedImage(null)} />
        </aside>
    );
};

export default ChatWindow;
