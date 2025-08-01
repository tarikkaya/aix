

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage as ChatMessageType, ChatFile, Room, Unit, Tool } from '../../types';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { RoomName, PROTECTED_UNITS, PROTECTED_TOOLS, LLM_PROVIDERS } from '../../constants';


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
        // AI audio is played automatically by the app, so we just show an indicator.
        if (isAiMessage) {
            return (
                <div key={file.name} className="flex items-center space-x-2 my-1 p-2 bg-surface rounded-md">
                    <Icon name="speaker-wave" className="w-5 h-5 text-text-secondary" />
                    <span className="text-sm text-text-secondary">Audio response played</span>
                </div>
            );
        }
        // User audio gets a playable media player.
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


const simulateAgiResponse = (message: ChatMessageType, rooms: Room[], webhookUrl: string | null): { trace: string; participantUnitIds: string[]; generatedFile?: ChatFile } => {
    let trace = `**Cognitive Process Trace: Dynamic Protocol**\n\n`;
    let step = 1;
    const participantUnitIds: string[] = [];
    let generatedFile: ChatFile | undefined = undefined;

    const lowerCaseText = message.text.toLowerCase();
    const isImageRequest = lowerCaseText.includes('generate an image') || lowerCaseText.includes('draw a') || lowerCaseText.includes('create a picture of');
    const isShortResponse = message.text.length < 100 && !message.text.includes('```');

    // 1. Admin Manager receives the request
    const adminManager = rooms.find(r => r.name === RoomName.Admin)?.units.find(u => u.name === 'Admin Manager');
    if (adminManager) participantUnitIds.push(adminManager.id);
    trace += `${step++}. **[Admin Manager]**: Input received. Passing to Comms Chief.\n`;

    // 2. Comms Chief broadcasts a Task Announcement
    const commsChief = rooms.find(r => r.name === RoomName.Communication)?.units.find(u => u.name === 'Comms Chief');
    if (commsChief) participantUnitIds.push(commsChief.id);
    trace += `${step++}. **[Comms Chief]**: Broadcasting "Task Announcement" to all Room Managers.\n`;

    // 3. Bidding Phase: Determine which rooms are relevant
    let bids: { roomName: RoomName, manager: string, relevance: string }[] = [];
    const hasImageFile = message.files?.some(f => f.type.startsWith('image/'));
    const hasAudio = message.files?.some(f => f.type.startsWith('audio/'));
    const isComplexQuery = message.text.length > 30 || message.text.includes('?');
    const isSearchQuery = lowerCaseText.includes('search for') || lowerCaseText.includes('what is the latest');

    if (hasImageFile || isImageRequest) bids.push({ roomName: RoomName.Visual, manager: 'Art Director', relevance: 'High (Image Detected)' });
    if (hasAudio || isShortResponse) bids.push({ roomName: RoomName.Sound, manager: 'Audio Director', relevance: 'High (Audio Detected or TTS Candidate)' });
    if (isSearchQuery) bids.push({ roomName: RoomName.InformationSearch, manager: 'Chief Explorer', relevance: 'High (External Search Required)' });
    if (isComplexQuery) {
      bids.push({ roomName: RoomName.Information, manager: 'Head Librarian', relevance: 'Medium (Internal Knowledge)' });
      bids.push({ roomName: RoomName.Thought, manager: 'Lead Thinker', relevance: 'Medium (Reasoning Required)' });
    }
    bids.push({ roomName: RoomName.Sanctions, manager: 'Chief Arbiter', relevance: 'High (Final Authorization)' });
    
    trace += `${step++}. **[Bidding Phase]**: Collecting bids from managers...\n`;
    bids.forEach(bid => {
        trace += `   - **BID RECEIVED** from **[${bid.manager}]**. Relevance: ${bid.relevance}.\n`;
    });
    const otherRooms = rooms.filter(r => !bids.some(b => b.roomName === r.name) && r.manager).map(r => r.manager);
    if(otherRooms.length > 0) {
        trace += `   - Bids ignored from: ${otherRooms.join(', ')} (Relevance: None).\n`;
    }

    const itinerary = bids.sort((a,b) => (a.relevance.startsWith('High') ? -1 : 1)).map(b => b.roomName);
    const finalItinerary = [...new Set(itinerary.filter(r => r !== RoomName.Sanctions)), RoomName.Sanctions];

    trace += `${step++}. **[Comms Chief]**: Bids finalized. Dynamically creating itinerary: **${finalItinerary.join(' → ')}**.\n`;
    
    let ttsEngaged = false;
    let soundcastEngaged = false;

    finalItinerary.forEach(roomName => {
        const room = rooms.find(r => r.name === roomName);
        if (!room || !room.manager) return;
        
        const managerUnit = room.units.find(u => u.name === room.manager);
        if(managerUnit) participantUnitIds.push(managerUnit.id);
        
        trace += `${step++}. **[Comms Chief]** → **[${room.manager}]**: Activating *${roomName}*.\n`;
        
        if (roomName === RoomName.Sound && (isShortResponse || hasAudio)) {
            if(hasAudio){
                 const sttUnit = room.units.find(u => u.name === 'Speech-to-Text Transcriber');
                 if(sttUnit) {
                    participantUnitIds.push(sttUnit.id);
                    trace += `   - **[${room.manager}]**: Tasking [${sttUnit.name}] to transcribe audio.\n`;
                 }
            }
            if (isShortResponse) {
                const ttsUnit = room.units.find(u => u.name === 'Text-to-Speech Synthesizer');
                if (ttsUnit) {
                    participantUnitIds.push(ttsUnit.id);
                    trace += `   - **[${room.manager}]**: Tasking [${ttsUnit.name}] to synthesize audio.\n`;
                    ttsEngaged = true;
                }
                if (webhookUrl) {
                    const streamerUnit = room.units.find(u => u.name === 'Soundcast Streamer');
                    if (streamerUnit) {
                        participantUnitIds.push(streamerUnit.id);
                        trace += `   - **[${room.manager}]**: Tasking [${streamerUnit.name}] to stream synthesized audio to webhook.\n`;
                        soundcastEngaged = true;
                    }
                }
            }
        } else if (roomName === RoomName.Visual && isImageRequest) {
            const imageGenSpecialist = room.units.find(u => u.name === 'Image Generation Specialist');
            if (imageGenSpecialist) {
                participantUnitIds.push(imageGenSpecialist.id);
                trace += `   - **[${room.manager}]**: Tasking [${imageGenSpecialist.name}] to generate image.\n`;
                const svgContent = `<svg width="256" height="256" viewBox="0 0 100 100" fill="hsl(var(--color-primary))"><rect width="100" height="100" rx="10" fill="hsl(var(--color-surface))" /><path d="M42,30 A10,10 0 1,1 58,30 M50,30 V50 M50,50 L40,60 M50,50 L60,60 M40,75 H60 M35,70 V80 M65,70 V80" stroke="hsl(var(--color-primary))" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
                const base64Svg = btoa(svgContent);
                generatedFile = { name: "generated-image.svg", type: "image/svg+xml", content: `data:image/svg+xml;base64,${base64Svg}` };
                trace += `     - **[${imageGenSpecialist.name}]**: Image generated successfully. Attaching to data packet.\n`;
            }
        } else {
             const specialists = room.units.filter(u => u.name !== room.manager && u.isLoopOpen);
             if (specialists.length > 0) {
                 trace += `   - **[${room.manager}]**: Consulting specialist units...\n`;
                 specialists.forEach(unit => {
                     participantUnitIds.push(unit.id);
                     const providerInfo = LLM_PROVIDERS.find(p => p.id === unit.llmProvider.provider);
                     const providerType = providerInfo?.type ?? 'local';
                     
                     if (providerType === 'local') {
                         trace += `     - **[${unit.name}]**: Loading... executing... unloading. Providing insight.\n`;
                     } else { // cloud
                         trace += `     - **[${unit.name}]**: Activating API... providing insight.\n`;
                     }

                     const embeddingProviderId = unit.trainingVector?.embedding?.provider;
                     if (embeddingProviderId) {
                         const embeddingProviderInfo = LLM_PROVIDERS.find(p => p.id === embeddingProviderId);
                         const embeddingProviderType = embeddingProviderInfo?.type ?? 'local';
                         if (embeddingProviderType === 'local') {
                             trace += `       - Local embedding model activated as part of the "load" cycle for vector operations.\n`;
                         } else { // cloud
                             trace += `       - Cloud embedding model is always-on and available for vector operations.\n`;
                         }
                     }
                 });
                 trace += `   - **[${room.manager}]**: Synthesizing specialist findings.\n`;
             } else {
                  trace += `   - **[${room.manager}]**: No active specialists to consult. Performing primary function.\n`;
             }
        }
        
        if (roomName !== RoomName.Sanctions) {
            trace += `   - **[${room.manager}]** → **[Comms Chief]**: Task complete. Passing enriched data forward.\n`;
        }
    });

    if (ttsEngaged) {
        const audioContent = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
        generatedFile = { name: "response.wav", type: "audio/wav", content: audioContent };
        trace += `     - **[Text-to-Speech Synthesizer]**: Audio synthesized successfully.\n`;
        if (soundcastEngaged) {
            trace += `     - **[Soundcast Streamer]**: POSTing audio to configured webhook.\n`;
        }
    }

    const chiefArbiter = rooms.find(r => r.name === RoomName.Sanctions)?.units.find(u => u.name === 'Chief Arbiter');
    const chatResponder = rooms.find(r => r.name === RoomName.Sanctions)?.units.find(u => u.name === 'Chat Responder');
    if(chatResponder) participantUnitIds.push(chatResponder.id);

    const actionIsExecution = lowerCaseText.includes('run') || lowerCaseText.includes('execute');

    if (chiefArbiter) {
        if (actionIsExecution) {
            trace += `   - **[${chiefArbiter.name}]**: Plan involves system execution. **ACTION AUTHORIZED**. Tasking relevant executor unit.\n`;
        } else {
            trace += `   - **[${chiefArbiter.name}]**: Plan approved. Tasking **[${chatResponder?.name}]** to formulate final text response.\n`;
        }
    }
    
    trace += `${step++}. **[AIX System]**: Cognitive cycle complete. Final response delivered.\n`;

    return { trace, participantUnitIds: [...new Set(participantUnitIds)], generatedFile };
};


interface ChatWindowProps {
    rooms: Room[];
    webhookUrl: string | null;
    onAddUnit: (roomId: string, type: 'Standard' | 'RAG' | 'Code RAG' | 'Drive') => void;
    onDeleteUnit: (unitId: string) => void;
    onUpdateUnit: (unit: Unit) => void;
    onAddTool: (tool: Omit<Tool, 'id'>) => void;
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
        rooms, webhookUrl, onAddUnit, onDeleteUnit, 
        onUpdateUnit, onAddTool, onDeleteTool, onDistributeFeedback,
        onSystemFeedback, playAudioFromUrl, isRecording, startRecording,
        stopRecording, newlyRecordedFile, onNewRecordingConsumed
    } = props;
    const [messages, setMessages] = useState<ChatMessageType[]>([]);
    const [input, setInput] = useState('');
    const [files, setFiles] = useState<ChatFile[]>([]);
    const [isFeedbackModalOpen, setFeedbackModalOpen] = useState(false);
    const [feedbackReason, setFeedbackReason] = useState('');
    const [activeFeedback, setActiveFeedback] = useState<{id: string, type: 'up' | 'down'} | null>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [input]);
    
    const handleSendMessage = useCallback(async (text: string, filesToSend: ChatFile[]) => {
        if (!text.trim() && filesToSend.length === 0) return;

        const lastAiMessage = messages.filter(m => m.sender === 'ai').pop();
        
        if (lastAiMessage && !lastAiMessage.rf && !lastAiMessage.isThinking) {
            onSystemFeedback(lastAiMessage);
        }

        const newUserMessage: ChatMessageType = { 
            id: Date.now().toString(), 
            sender: 'user', 
            text: text,
            files: filesToSend.length > 0 ? filesToSend : undefined,
            timestamp: Date.now()
        };
        
        const thinkingMessage: ChatMessageType = {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: '',
            isThinking: true,
            timestamp: Date.now() + 1
        };
        
        setMessages(currentMessages => [...currentMessages, newUserMessage, thinkingMessage]);
        setInput('');
        setFiles([]);
        
        let aiResponseText = '';
        let commandProcessed = false;
        const lowerInput = text.trim().toLowerCase();
        const allTools = rooms.find(r => r.name === RoomName.Tools)?.tools || [];
        const aiResponseMessage: ChatMessageType = {
            id: thinkingMessage.id, 
            sender: 'ai',
            text: '', 
            timestamp: Date.now()
        };

        const deleteUnitMatch = lowerInput.match(/(?:delete|remove) unit "([^"]+)"/i);
        if (deleteUnitMatch) {
            commandProcessed = true;
            const unitName = deleteUnitMatch[1];
            const unitToDelete = rooms.flatMap(r => r.units).find(u => u.name.toLowerCase() === unitName.toLowerCase());
            if (!unitToDelete) {
                aiResponseText = `**Coalition Manager**: Error. Unit "${unitName}" not found.`;
            } else if (PROTECTED_UNITS.includes(unitToDelete.name)) {
                aiResponseText = `**Coalition Manager**: Action denied. Unit "${unitName}" is a protected core component and cannot be deleted.`;
            } else {
                onDeleteUnit(unitToDelete.id);
                aiResponseText = `**Coalition Manager**: Action successful. Unit "${unitName}" has been deleted.`;
            }
        }

        const createUnitMatch = !commandProcessed && lowerInput.match(/(?:create|add) (?:a|an|new)?\s*(standard|rag|code rag|drive)?\s*unit in (?:the)?\s*"?([^"]+?)"?\s*$/i);
        if (createUnitMatch) {
            commandProcessed = true;
            const typeMatch = (createUnitMatch[1] || 'standard').toLowerCase();
            const unitType: 'Standard' | 'RAG' | 'Code RAG' | 'Drive' = 
                typeMatch === 'rag' ? 'RAG' :
                typeMatch === 'code rag' ? 'Code RAG' :
                typeMatch === 'drive' ? 'Drive' : 'Standard';
            const roomNameInput = createUnitMatch[2].trim();
            const targetRoom = rooms.find(r => r.name.toLowerCase().includes(roomNameInput.toLowerCase()));
            if (!targetRoom) {
                aiResponseText = `**Coalition Manager**: Error. Room matching "${roomNameInput}" not found. Cannot create unit.`;
            } else {
                onAddUnit(targetRoom.id, unitType);
                aiResponseText = `**Coalition Manager**: Action successful. A new ${unitType} unit has been created in the ${targetRoom.name}.`;
            }
        }
        
        const updateUnitMatch = !commandProcessed && lowerInput.match(/update unit "([^"]+)" set (prompt|purpose) to "([^"]+)"/i);
        if (updateUnitMatch) {
            commandProcessed = true;
            const unitName = updateUnitMatch[1];
            const property = updateUnitMatch[2] as 'prompt' | 'purpose';
            const value = updateUnitMatch[3];
            const unitToUpdate = rooms.flatMap(r => r.units).find(u => u.name.toLowerCase() === unitName.toLowerCase());
            if (!unitToUpdate) {
                aiResponseText = `**Coalition Manager**: Error. Unit "${unitName}" not found.`;
            } else {
                onUpdateUnit({ ...unitToUpdate, [property]: value });
                aiResponseText = `**Coalition Manager**: Action successful. Unit "${unitName}" has been updated.`;
            }
        }

        const deleteToolMatch = !commandProcessed && lowerInput.match(/(?:delete|remove) tool "([^"]+)"/i);
        if (deleteToolMatch) {
            commandProcessed = true;
            const toolName = deleteToolMatch[1];
            const toolToDelete = allTools.find(t => t.name.toLowerCase() === toolName.toLowerCase());
            if (!toolToDelete) {
                aiResponseText = `**Coalition Manager**: Error. Tool "${toolName}" not found.`;
            } else if (PROTECTED_TOOLS.includes(toolToDelete.name)) {
                aiResponseText = `**Coalition Manager**: Action denied. Tool "${toolName}" is a protected core script and cannot be deleted.`;
            } else {
                onDeleteTool(toolToDelete.id);
                aiResponseText = `**Coalition Manager**: Action successful. Tool "${toolName}" has been deleted.`;
            }
        }

        const createToolMatch = !commandProcessed && lowerInput.match(/(?:create|add) (?:a|an|new)?\s*(javascript|python|powershell)?\s*tool "([^"]+)" with content "([^"]+)"/i);
        if (createToolMatch) {
            commandProcessed = true;
            const language = (createToolMatch[1] || 'javascript') as 'javascript' | 'python' | 'powershell';
            const name = createToolMatch[2];
            const content = createToolMatch[3];
            onAddTool({ name, language, content });
            aiResponseText = `**Coalition Manager**: Action successful. A new ${language} tool named "${name}" has been created.`;
        }

        if (!commandProcessed) {
            const { trace, participantUnitIds, generatedFile } = simulateAgiResponse(newUserMessage, rooms, webhookUrl);
            aiResponseText = trace;
            aiResponseMessage.participantUnitIds = participantUnitIds;
            if (generatedFile) {
                aiResponseMessage.files = [generatedFile];
            }
        }
        aiResponseMessage.text = aiResponseText;
        
        setTimeout(() => {
            setMessages(prev => prev.map(m => m.id === thinkingMessage.id ? aiResponseMessage : m));
            
            const audioFile = aiResponseMessage.files?.find(f => f.type.startsWith('audio/'));
            if (audioFile) {
                if (isRecording) {
                    stopRecording();
                }
                playAudioFromUrl(audioFile.content);
            }
        }, 1500 + Math.random() * 500);

    }, [messages, rooms, webhookUrl, onAddUnit, onDeleteUnit, onUpdateUnit, onAddTool, onDeleteTool, onSystemFeedback, isRecording, playAudioFromUrl, stopRecording]);
    
    // Effect to auto-send recorded audio from PTT or mic button
    useEffect(() => {
        if (newlyRecordedFile) {
            handleSendMessage('', [newlyRecordedFile]);
            onNewRecordingConsumed(); // Clear the trigger in App.tsx
        }
    }, [newlyRecordedFile, onNewRecordingConsumed, handleSendMessage]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles) return;

        const allowedTypes = [
            'image/png', 'image/jpeg', 'text/plain', 
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'audio/mpeg', 'audio/wav', 'audio/ogg'
        ];

        Array.from(selectedFiles).forEach(file => {
            if (allowedTypes.includes(file.type) && file.size < 10 * 1024 * 1024) { // 10MB limit
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFiles(prev => [...prev, {
                        name: file.name,
                        type: file.type,
                        content: reader.result as string
                    }]);
                };
                reader.readAsDataURL(file);
            } else {
                alert(`File "${file.name}" is not supported or is too large.`);
            }
        });
        
        if (e.target) e.target.value = ''; 
    };

    const removeFile = (fileName: string) => {
        setFiles(prev => prev.filter(f => f.name !== fileName));
    };

    const handleFeedback = useCallback((id: string, type: 'up' | 'down') => {
        setActiveFeedback({ id, type });
        setFeedbackModalOpen(true);
    }, []);

    const submitFeedback = () => {
        if (!activeFeedback) return;

        const targetMessage = messages.find(m => m.id === activeFeedback!.id);
        if (targetMessage) {
            onDistributeFeedback(targetMessage, activeFeedback.type, feedbackReason);
        }
        
        setMessages(prev => prev.map(msg => 
            msg.id === activeFeedback.id ? { ...msg, rf: activeFeedback.type, rfReason: feedbackReason, systemRf: false } : msg
        ));
        
        setFeedbackModalOpen(false);
        setFeedbackReason('');
        setActiveFeedback(null);
    };

    const handleMicClick = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <>
            <aside className="w-[450px] bg-surface flex-shrink-0 border-l border-border-color flex flex-col">
                <div className="p-4 border-b border-border-color">
                    <h2 className="text-lg font-bold text-text-primary text-center">CHAT</h2>
                </div>
                <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto min-h-0">
                    {messages.map(msg => (
                        <ChatMessage key={msg.id} message={msg} onFeedback={handleFeedback} onImageZoom={setZoomedImage} />
                    ))}
                    {isRecording && !messages.some(m => m.isThinking) && (
                         <div className="flex flex-col my-4 items-end">
                            <div className="text-xs font-bold mb-1 text-text-secondary px-1 text-right">
                                USER
                            </div>
                            <div className="max-w-xl p-3 rounded-lg bg-primary text-white rounded-br-none">
                                <div className="flex items-center space-x-2 text-sm text-white">
                                    <Icon name="microphone" className="w-4 h-4 text-red-400 animate-pulse" />
                                    <span>Recording...</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-border-color flex-shrink-0">
                    {files.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                           {files.map(file => (
                               <div key={file.name} className="flex items-center space-x-2 bg-surface-light text-xs text-text-primary px-2 py-1 rounded-full">
                                   <span>{file.name}</span>
                                   <button onClick={() => removeFile(file.name)} className="text-text-secondary hover:text-white">
                                       <Icon name="x-mark" className="w-3 h-3"/>
                                   </button>
                               </div>
                           ))}
                        </div>
                    )}
                    <div className="flex items-end bg-surface-light rounded-lg">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept=".png, .jpg, .jpeg, .txt, .pdf, .doc, .docx, .mp3, .wav, .ogg" className="hidden"/>
                        <button onClick={() => fileInputRef.current?.click()} className="p-3 text-text-secondary hover:text-primary self-center" title="Attach files">
                            <Icon name="paper-clip" className="w-5 h-5"/>
                        </button>
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(input, files);
                                }
                            }}
                            placeholder="Type your message..."
                            rows={1}
                            className="flex-1 bg-transparent p-3 resize-none focus:outline-none text-sm max-h-40 overflow-y-auto"
                        />
                        <button 
                            onClick={handleMicClick}
                            className={`p-3 self-center text-text-secondary ${isRecording ? 'text-red-500 animate-pulse' : 'hover:text-primary'}`} 
                            title={isRecording ? "Stop recording" : "Start recording (Push-to-Talk)"}
                        >
                            <Icon name="microphone" className="w-5 h-5"/>
                        </button>
                        <button onClick={() => handleSendMessage(input, files)} className="p-3 self-center text-primary hover:text-primary/80 disabled:text-text-secondary disabled:cursor-not-allowed" disabled={!input.trim() && files.length === 0}>
                            <Icon name="send" className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </aside>
            <Modal isOpen={isFeedbackModalOpen} onClose={() => setFeedbackModalOpen(false)} title={`Reason for ${activeFeedback?.type === 'up' ? 'Positive' : 'Negative'} Feedback`}>
                <div className="space-y-4">
                    <p className="text-sm text-text-secondary">Please provide a brief explanation for your feedback. This helps the Admin Room evaluate unit performance.</p>
                    <textarea 
                        value={feedbackReason}
                        onChange={(e) => setFeedbackReason(e.target.value)}
                        className="w-full p-2 bg-surface border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        rows={4}
                        placeholder="e.g., The response was very creative..."
                    />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setFeedbackModalOpen(false)} className="px-4 py-2 text-sm font-medium rounded-md bg-surface hover:bg-surface-light transition-colors">Cancel</button>
                        <button onClick={submitFeedback} className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/80 transition-colors">Submit</button>
                    </div>
                </div>
            </Modal>

            {zoomedImage && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center"
                    onClick={() => setZoomedImage(null)}
                >
                    <img 
                        src={zoomedImage} 
                        alt="Zoomed view" 
                        className="max-w-[90vw] max-h-[90vh] object-contain"
                        onClick={e => e.stopPropagation()} 
                    />
                     <button 
                        onClick={() => setZoomedImage(null)} 
                        className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full hover:bg-black/80 transition-colors"
                        aria-label="Close zoomed image"
                    >
                        <Icon name="x-mark" className="w-6 h-6" />
                    </button>
                </div>
            )}
        </>
    );
};

export default ChatWindow;