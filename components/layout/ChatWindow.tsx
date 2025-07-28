







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
import { RoomName, PROTECTED_UNITS, PROTECTED_TOOLS } from '../../constants';


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
                <Icon name="spinner" className="w-4 h-4" />
                <span>Thinking...</span>
            </div>
        </div>
    </div>
);


const ChatMessage: React.FC<{ message: ChatMessageType; onFeedback: (id: string, feedback: 'up' | 'down') => void }> = ({ message, onFeedback }) => {
  const isUser = message.sender === 'user';
  
  if (message.isThinking) {
      return <ThinkingMessage />;
  }

  const renderFile = (file: ChatFile) => {
    if (file.type.startsWith('image/')) {
        return <img key={file.name} src={file.content} alt={file.name} className="rounded-md my-2 max-h-60" />;
    }
    if (file.type.startsWith('audio/')) {
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
                    {message.files.map(renderFile)}
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


const simulateAgiResponse = (message: ChatMessageType, rooms: Room[]): string => {
    const engagedUnits: { name: string, room: string }[] = [];
    const skippedUnits: { name: string, room: string }[] = [];

    rooms.forEach(room => {
        room.units.forEach(unit => {
            // Managers are always conceptually 'active' for routing, but we check the loop for execution.
            // For this simulation, we'll respect the loop toggle for all.
            if (unit.isLoopOpen) {
                engagedUnits.push({ name: unit.name, room: room.name });
            } else {
                skippedUnits.push({ name: unit.name, room: room.name });
            }
        });
    });

    let thoughtProcess = `**Cognitive Loop Trace:**\n\n`;
    thoughtProcess += `**Engaged Units (Loop Open):**\n`;
    if (engagedUnits.length > 0) {
        thoughtProcess += engagedUnits.map(u => `*   **${u.name}** (*${u.room}*)`).join('\n');
    } else {
        thoughtProcess += `*   None`;
    }

    thoughtProcess += `\n\n**Skipped Units (Loop Closed):**\n`;
     if (skippedUnits.length > 0) {
        thoughtProcess += skippedUnits.map(u => `*   **${u.name}** (*${u.room}*)`).join('\n');
    } else {
        thoughtProcess += `*   None`;
    }
    
    thoughtProcess += `\n\n**Analysis:** The final response would be synthesized from the outputs of the engaged units. This simulation confirms that only units with an open loop would consume resources and participate in generating the response.`;
    
    // Add specific logic for math example as a demonstration
    if (/[$$]/.test(message.text)) {
        thoughtProcess += `\n\n**Note**: Mathematical notation detected. The 'Mathematics Analyst' was engaged to provide the following solution:\n$$E=mc^2$$`
    }

    return thoughtProcess;
};

interface ChatWindowProps {
    rooms: Room[];
    micId: string | null;
    micGain: number;
    onAddUnit: (roomId: string, type: 'Standard' | 'RAG' | 'Code RAG' | 'Drive') => void;
    onDeleteUnit: (unitId: string) => void;
    onUpdateUnit: (unit: Unit) => void;
    onAddTool: (tool: Omit<Tool, 'id'>) => void;
    onDeleteTool: (toolId: string) => void;
}


const ChatWindow: React.FC<ChatWindowProps> = (props) => {
    const { rooms, micId, micGain, onAddUnit, onDeleteUnit, onUpdateUnit, onAddTool, onDeleteTool } = props;
    const [messages, setMessages] = useState<ChatMessageType[]>([]);
    const [input, setInput] = useState('');
    const [files, setFiles] = useState<ChatFile[]>([]);
    const [isFeedbackModalOpen, setFeedbackModalOpen] = useState(false);
    const [feedbackReason, setFeedbackReason] = useState('');
    const [activeFeedback, setActiveFeedback] = useState<{id: string, type: 'up' | 'down'} | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

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
    
    const handleSendMessage = useCallback(() => {
        if (!input.trim() && files.length === 0) return;

        const lastAiMessage = messages.filter(m => m.sender === 'ai').pop();
        if (lastAiMessage && !lastAiMessage.rf && !lastAiMessage.isThinking) {
            setMessages(prev => prev.map(m => m.id === lastAiMessage.id ? { ...m, systemRf: true } : m));
        }

        const newUserMessage: ChatMessageType = { 
            id: Date.now().toString(), 
            sender: 'user', 
            text: input,
            files: files.length > 0 ? files : undefined,
            timestamp: Date.now()
        };
        
        const thinkingMessage: ChatMessageType = {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: '',
            isThinking: true,
            timestamp: Date.now() + 1
        };
        
        setMessages(prev => [...prev, newUserMessage, thinkingMessage]);
        setInput('');
        setFiles([]);
        
        // --- Coalition Manager Command Processing ---
        let aiResponseText = '';
        let commandProcessed = false;
        const lowerInput = input.trim().toLowerCase();
        const allTools = rooms.find(r => r.name === RoomName.Tools)?.tools || [];

        // DELETE UNIT
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

        // CREATE UNIT
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
        
        // UPDATE UNIT
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

        // DELETE TOOL
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

        // CREATE TOOL
        const createToolMatch = !commandProcessed && lowerInput.match(/(?:create|add) (?:a|an|new)?\s*(javascript|python|powershell)?\s*tool "([^"]+)" with content "([^"]+)"/i);
        if (createToolMatch) {
            commandProcessed = true;
            const language = (createToolMatch[1] || 'javascript') as 'javascript' | 'python' | 'powershell';
            const name = createToolMatch[2];
            const content = createToolMatch[3];
            onAddTool({ name, language, content });
            aiResponseText = `**Coalition Manager**: Action successful. A new ${language} tool named "${name}" has been created.`;
        }

        // Fallback to original simulation
        if (!commandProcessed) {
            aiResponseText = simulateAgiResponse(newUserMessage, rooms);
        }
        
        setTimeout(() => {
            const aiResponseMessage: ChatMessageType = {
                id: thinkingMessage.id, // Replace the thinking message with the same ID
                sender: 'ai',
                text: aiResponseText,
                timestamp: Date.now()
            };
            setMessages(prev => prev.map(m => m.id === thinkingMessage.id ? aiResponseMessage : m));
        }, 1000);

    }, [input, files, messages, rooms, onAddUnit, onDeleteUnit, onUpdateUnit, onAddTool, onDeleteTool]);
    
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
        
        if (e.target) e.target.value = ''; // Allow re-uploading the same file
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
        setMessages(prev => prev.map(msg => 
            msg.id === activeFeedback.id ? { ...msg, rf: activeFeedback.type, rfReason: feedbackReason, systemRf: false } : msg
        ));
        setFeedbackModalOpen(false);
        setFeedbackReason('');
        setActiveFeedback(null);
    };

    const startRecording = async () => {
        if (!micId) {
            alert("Please select a microphone in the settings.");
            return;
        }
        try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: micId } } });
            
            // Create audio context and apply gain
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
            const gainNode = audioContextRef.current.createGain();
            const destination = audioContextRef.current.createMediaStreamDestination();
            
            gainNode.gain.value = micGain;
            source.connect(gainNode);
            gainNode.connect(destination);

            mediaRecorderRef.current = new MediaRecorder(destination.stream);
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = event => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const reader = new FileReader();
                reader.onloadend = () => {
                     setFiles(prev => [...prev, {
                        name: `recording-${Date.now()}.wav`,
                        type: 'audio/wav',
                        content: reader.result as string
                    }]);
                };
                reader.readAsDataURL(audioBlob);
                streamRef.current?.getTracks().forEach(track => track.stop());
                audioContextRef.current?.close();
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error starting recording:", err);
            alert("Could not start recording. Please check microphone permissions.");
        }
    };
    
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    return (
        <>
            <aside className="w-[450px] bg-surface flex-shrink-0 border-l border-border-color flex flex-col">
                <div className="p-4 border-b border-border-color">
                    <h2 className="text-lg font-bold text-text-primary text-center">CHAT</h2>
                </div>
                <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto min-h-0">
                    {messages.map(msg => (
                        <ChatMessage key={msg.id} message={msg} onFeedback={handleFeedback} />
                    ))}
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
                    <div className="flex items-center bg-surface-light rounded-lg">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept=".png, .jpg, .jpeg, .txt, .pdf, .doc, .docx, .mp3, .wav, .ogg" className="hidden"/>
                        <button onClick={() => fileInputRef.current?.click()} className="p-3 text-text-secondary hover:text-primary" title="Attach files">
                            <Icon name="paper-clip" className="w-5 h-5"/>
                        </button>
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Type your message..."
                            rows={1}
                            className="flex-1 bg-transparent p-3 resize-none focus:outline-none text-sm max-h-40 overflow-y-auto"
                        />
                        <button 
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onTouchStart={startRecording}
                            onTouchEnd={stopRecording}
                            className={`p-3 text-text-secondary ${isRecording ? 'text-red-500 animate-pulse' : 'hover:text-primary'}`} 
                            title="Hold to record audio"
                        >
                            <Icon name="microphone" className="w-5 h-5"/>
                        </button>
                        <button onClick={handleSendMessage} className="p-3 text-primary hover:text-primary/80 disabled:text-text-secondary disabled:cursor-not-allowed" disabled={!input.trim() && files.length === 0}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                            </svg>
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
        </>
    );
};

export default ChatWindow;