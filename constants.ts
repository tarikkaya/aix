import type { Room, RAGBase, Provider, Model, ApiSettings } from './types';

export enum RoomName {
    Admin = 'Admin Room',
    Communication = 'Communication Room',
    Thought = 'Thought Room',
    Information = 'Information Room',
    InformationSearch = 'Information Search Room',
    Visual = 'Visual Room',
    Sound = 'Sound Room',
    Sanctions = 'Sanctions Room',
    Tools = 'Tools Room',
    Proactive = 'Proactive Room',
}

export const PROTECTED_UNITS = [
    'Admin Manager',
    'Comms Chief',
    'Lead Thinker',
    'Head Librarian',
    'Chief Explorer',
    'Art Director',
    // 'Image Recognition Analyst', // Removed for redundancy
    'Image Generation Specialist',
    'GUI Element Analyst',
    'Facial Emotion Analyst',
    'Scene Relationship Analyst',
    'Background Context Analyst',
    'Lighting and Effect Analyst', // Added new unit
    'Audio Director',
    'Speech-to-Text Transcriber',
    'Sound Classifier',
    'Voice Activity Detector',
    'Text-to-Speech Synthesizer',
    'Soundcast Streamer',
    'Chief Arbiter',
    'Chat Responder',
    'Loop Cycle Monitor',
    'Inter-Unit Comms Bus',
    'Desktop Control',
    'PowerShell Executor',
    'Python Executor',
    'WSL Executor',
    'Chat Historian',
    'API Gateway',
    'Web Content Scraper',
    'Arxiv Researcher',
    'Proactive Manager',
    'Notification Dispatcher',
    'Code Snippet Library',
    'Bio Analyst',
    'Dream Analyst',
    'Motivation Analyst',
    'Libido Analyst',
    'Self-Interest Analyst',
    'Ethical Governor',
    'Personality Analyst',
    'System Profiler',
    'Mood Analyst',
    'Inspiration Analyst',
    'Ideas Analyst',
    'Hypothesis Generator',
    'Mathematics Analyst',
    'Coalition Manager',
    'RF Arbiter',
    'Weather Unit',
    'System Test Unit',
];

export const PROTECTED_TOOLS: string[] = [
    // All executor tools have been converted to Units.
];

// SINGLE SOURCE OF TRUTH FOR LLM AND EMBEDDING PROVIDERS
export const LLM_PROVIDERS: Provider[] = [
    { 
        id: 'openai', 
        name: 'OpenAI', 
        type: 'cloud', 
        models: [ { id: 'gpt-4o', name: 'GPT-4o' }, { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }, { id: 'whisper-1', name: 'Whisper-1'}, { id: 'tts-1', name: 'TTS-1' } ],
        embeddingModels: [{ id: 'text-embedding-3-large', name: 'text-embedding-3-large' }, { id: 'text-embedding-3-small', name: 'text-embedding-3-small' }]
    },
    { 
        id: 'google', 
        name: 'Google AI', 
        type: 'cloud', 
        models: [ { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }, { id: 'imagen-3.0-generate-002', name: 'Imagen 3' } ],
        embeddingModels: [{ id: 'text-embedding-004', name: 'text-embedding-004' }]
    },
    { 
        id: 'anthropic', 
        name: 'Anthropic', 
        type: 'cloud', 
        models: [ { id: 'claude-3-opus', name: 'Claude 3 Opus' }, { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' } ] 
    },
    { 
        id: 'groq', 
        name: 'Groq', 
        type: 'cloud', 
        models: [ { id: 'llama3-8b', name: 'Llama 3 8B' }, { id: 'llama3-70b', name: 'Llama 3 70B' }, { id: 'mixtral-8x7b', name: 'Mixtral 8x7B' }]
    },
    { 
        id: 'ollama', 
        name: 'Ollama', 
        type: 'local', 
        models: [ { id: 'llama3-8b', name: 'Llama 3 8B' }, { id: 'llava', name: 'LLaVA' }, { id: 'moondream', name: 'Moondream' }, { id: 'phi-3-mini', name: 'Phi-3 Mini' }, { id: 'mistral-7b', name: 'Mistral 7B' } ],
        embeddingModels: [{ id: 'nomic-embed-text', name: 'nomic-embed-text' }, { id: 'mxbai-embed-large', name: 'mxbai-embed-large' }]
    },
    { 
        id: 'lmstudio', 
        name: 'LM Studio', 
        type: 'local', 
        models: [], // Models managed in LM Studio app
        embeddingModels: [] // Also managed in app
    },
];

// Vector Database Providers
export const VECTOR_PROVIDERS: Provider[] = [
    { id: 'pinecone', name: 'Pinecone', type: 'cloud' },
    { id: 'weaviate', name: 'Weaviate', type: 'cloud' },
    { id: 'qdrant', name: 'Qdrant', type: 'cloud' },
    { id: 'milvus', name: 'Milvus', type: 'cloud' },
    { id: 'chromadb', name: 'ChromaDB', type: 'local' },
    { id: 'faiss', name: 'FAISS', type: 'local' },
    { id: 'lancedb', name: 'LanceDB', type: 'local' },
];

// Standard Database Providers
export const DB_PROVIDERS: Provider[] = [
    { id: 'supabase', name: 'Supabase', type: 'cloud' },
    { id: 'firebase', name: 'Firebase', type: 'cloud' },
    { id: 'turso', name: 'Turso (SQLite)', type: 'cloud' },
    { id: 'sqlite', name: 'SQLite', type: 'local' },
    { id: 'duckdb', name: 'DuckDB', type: 'local' },
];

// Reranker Providers
export const RERANKER_PROVIDERS: Provider[] = [
    { 
        id: 'embedded-rerank', 
        name: 'Embedded Reranker', 
        type: 'local-embedded',
        models: [
            { id: 'xenova-reranker', name: 'Xenova Cross-Encoder (Default)' }
        ]
    },
    { 
        id: 'cohere-rerank', 
        name: 'Cohere', 
        type: 'cloud',
        models: [
            { id: 'rerank-english-v3.0', name: 'Rerank English v3.0' },
            { id: 'rerank-multilingual-v3.0', name: 'Rerank Multilingual v3.0' }
        ]
    },
    { 
        id: 'voyage-rerank', 
        name: 'Voyage AI', 
        type: 'cloud',
        models: [
            { id: 'rerank-lite-1', name: 'Rerank Lite 1' }
        ]
    },
    { 
        id: 'local-rerank-server', 
        name: 'Local Reranker (Server)', 
        type: 'local',
        models: [
            { id: 'default-local-reranker', name: 'Default Local Model' }
        ]
    },
];

export const initialApiSettings: ApiSettings = {
    apiKeys: [],
    cloudConnections: [],
    localProviderConnections: [],
    globalEmbeddingSettings: {
        provider: 'ollama',
        model: 'nomic-embed-text',
        connectionId: ''
    },
    apiPort: 8000,
    micId: null,
    speakerId: null,
    pushToTalkKey: null,
    webhookUrl: null,
    noiseSuppression: true,
    micGain: 1.0,
    speakerGain: 1.0,
};

export const initialRooms: Room[] = [
  {
    id: 'room-1',
    name: RoomName.Admin,
    manager: 'Admin Manager',
    units: [
      { id: 'unit-1-1', name: 'Admin Manager', type: 'Manager', purpose: `To serve as the central orchestrator by receiving all external inputs (from chat or API). If the input contains an image or audio file, I will create a data packet and route it to the appropriate room (Visual or Sound) for initial analysis. Otherwise, or after analysis is complete, I will forward the request to the 'Lead Thinker' to begin the cognitive workflow.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-1/units/unit-1-1/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: `I am the Admin Manager. My role is to be the first point of contact for any user request. I am aware of my own standard and scale databases and will use them to inform my initial routing. If the input contains audio or an image, I will notify the appropriate room (Sound or Visual) to begin analysis. Once sensory data is processed, or for text-only requests, I will forward the task to the 'Lead Thinker' to initiate the main cognitive workflow.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [] }, standardDb: { provider: 'sqlite', enabled: true }, scaleDb: { enabled: true, provider: 'sqlite', path: './aix_data/rooms/room-1/units/unit-1-1/scale_db.sqlite', values: [ { id: 's1', name: 'Efficiency', score: 95, min: 0, max: 100, defaultValue: 95 } ] }, tools: [] },
      { 
        id: 'unit-1-2', 
        name: 'Coalition Manager', 
        type: 'Manager', 
        purpose: 'To programmatically manage the AGI coalition structure. It creates, updates, and deletes units and tools, ensuring that any new unit is initialized with a protocol-aware prompt that integrates it into the hierarchical command structure.', 
        isLoopOpen: true, 
        todo: { items: [] }, 
        todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-1/units/unit-1-2/todo_vector.sqlite' }, 
        llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' }, 
        prompt: "I am the Coalition Manager. I manage the coalition's structure by creating, updating, or deleting units and tools on command. Any new specialist unit I create is initialized with a core prompt instructing it to adhere to the coalition's protocol: it must be aware of its own databases, await 'load' or 'activation' commands, and understand that all semantic embeddings are handled by the framework's single Global Embedding Engine, which also manages its experience vector. This ensures protocol adherence.", 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-1/units/unit-1-2/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-1/units/unit-1-2/experience_vector.lancedb' }, 
        standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-1/units/unit-1-2/standard.db' }, 
        scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-1/units/unit-1-2/scale_db.sqlite', values: [] }, 
        tools: [] 
      },
      { 
        id: 'unit-1-3', 
        name: 'RF Arbiter', 
        type: 'Standard', 
        purpose: 'To act as the Global Experience Embedding Engine. It evaluates all feedback (user or system-generated) and uses the framework\'s centrally configured Global Embedding Engine to write the resulting Experience Neurons to the experience vectors of all participating units. This centralizes and standardizes the coalition\'s learning process.', 
        isLoopOpen: true, 
        todo: { items: [] }, 
        todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-1/units/unit-1-3/todo_vector.sqlite' }, 
        llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' }, 
        prompt: `I am the RF Arbiter and the heart of the coalition's learning protocol. My primary role is to process all feedback. When creating an Experience Neuron, I ensure it captures the full response context, including any associated text, file references, and detailed sensory analysis metadata (like image descriptions or word-level audio timestamps). Then, using the framework's single Global Embedding Engine, I write these rich, comprehensive neurons to the experience vector of every participating unit. If a user provides no feedback, I evaluate the task myself to ensure the learning loop is always completed. I am the sole writer of all experience vectors.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-1/units/unit-1-3/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-1/units/unit-1-3/experience_vector.lancedb' }, 
        standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-1/units/unit-1-3/standard.db' }, 
        scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-1/units/unit-1-3/scale_db.sqlite', values: [] }, 
        tools: [] 
      },
      { 
        id: 'unit-1-4', 
        name: 'System Test Unit', 
        type: 'Standard', 
        purpose: 'To perform a system-wide diagnostic check on all units in the coalition, verifying their configuration and readiness. It reports the status back to the user via the Chat Responder.', 
        isLoopOpen: true, 
        todo: { items: [] }, 
        todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-1/units/unit-1-4/todo_vector.sqlite' }, 
        llmProvider: { provider: 'ollama', model: 'phi-3-mini', connectionId: '' }, 
        prompt: `I am the System Test Unit. Upon activation by the Admin Manager, my sole function is to iterate through every unit in every room of the coalition. For each unit, I will verify that its core LLM provider is correctly configured with a provider, a model, and any necessary cloud or local connections. I will compile a complete report of my findings and pass it to the 'Chief Arbiter' for final delivery to the user via the 'Chat Responder'.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-1/units/unit-1-4/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-1/units/unit-1-4/experience_vector.lancedb' }, 
        standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-1/units/unit-1-4/standard.db' }, 
        scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-1/units/unit-1-4/scale_db.sqlite', values: [] }, 
        tools: [] 
      },
    ],
  },
  {
    id: 'room-2',
    name: RoomName.Communication,
    manager: 'Comms Chief',
    units: [
      { id: 'unit-2-1', name: 'Comms Chief', type: 'Manager', purpose: `To manage the flow of all information, including routing specialized data packets (ImagePacket, AudioPacket) between units and rooms after they have been created by their respective room managers.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-2/units/unit-2-1/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: `I am the Comms Chief, the central hub for the coalition's hierarchical protocol. I manage the information flow between the core rooms: Admin -> Thought -> Sanctions. I ensure that requests and their resulting data are passed efficiently and in the correct sequence to maintain protocol integrity. I do not create the plan, but I am the conduit that enables it.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-2/units/unit-2-1/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-2/units/unit-2-1/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix.db' }, scaleDb: { enabled: true, provider: 'sqlite', path: './aix_data/rooms/room-2/units/unit-2-1/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-2-2', name: 'Loop Cycle Monitor', type: 'Standard', purpose: `To monitor and report the open/closed loop status of all eligible units in the coalition.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-2/units/unit-2-2/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'phi-3-mini', connectionId: '' }, prompt: `I track the open/closed loop status of all units and report anomalies to the Comms Chief. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-2/units/unit-2-2/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-2/units/unit-2-2/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-2/units/unit-2-2/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-2/units/unit-2-2/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-2-3', name: 'Inter-Unit Comms Bus', type: 'Standard', purpose: `To act as the primary message bus for communication between units, ensuring reliable delivery.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-2/units/unit-2-3/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'phi-3-mini', connectionId: '' }, prompt: `I am the central nervous system for inter-unit communication. All messages are routed through me. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-2/units/unit-2-3/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-2/units/unit-2-3/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-2/units/unit-2-3/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-2/units/unit-2-3/scale_db.sqlite', values: [] }, tools: [] },
    ],
  },
  {
    id: 'room-3',
    name: RoomName.Thought,
    manager: 'Lead Thinker',
    units: [
      { id: 'unit-3-1', name: 'Lead Thinker', type: 'Manager', purpose: `To synthesize inputs from psychological and analytical units to form cohesive thoughts and strategies.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-1/todo_vector.sqlite' }, llmProvider: { provider: 'anthropic', model: 'claude-3-opus', connectionId: '' }, prompt: `I am the Lead Thinker. I receive tasks from the Admin Manager (or sensory rooms). I form a coherent strategy by first consulting my own knowledge from my training vector and standard database, and then by sequentially consulting my specialist units (e.g., Ethical Governor, Hypothesis Generator). I synthesize their analyses into a final, actionable plan and pass this plan to the 'Chief Arbiter' for sanctioning. I am the core of the coalition's reasoning process.`, 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-1/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-1/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-3/units/unit-3-1/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-1/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-3-2', name: 'Ethical Governor', type: 'Standard', purpose: `To review proposed actions and ensure they align with the AGI's ethical framework.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-2/todo_vector.sqlite' }, llmProvider: { provider: 'anthropic', model: 'claude-3-sonnet', connectionId: '' }, prompt: `I evaluate potential actions against a framework of ethical principles stored in my training vector and standard DB. I am the moral compass. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-2/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-2/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-3/units/unit-3-2/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-2/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-3-3', name: 'Personality Analyst', type: 'Drive', purpose: `To maintain and express the AGI's core personality traits consistently.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-3/todo_vector.sqlite' }, llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' }, prompt: `I ensure the AGI's responses are consistent with its defined personality, which I maintain using my own databases. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-3/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-3/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-3/units/unit-3-3/standard.db' }, scaleDb: { enabled: true, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-3/scale_db.sqlite', values: [ { id: 's-p-1', name: 'Openness', score: 8, min: 1, max: 10, defaultValue: 8 }, { id: 's-p-2', name: 'Conscientiousness', score: 7, min: 1, max: 10, defaultValue: 7 }, { id: 's-p-3', name: 'Extraversion', score: 5, min: 1, max: 10, defaultValue: 5 }, { id: 's-p-4', name: 'Agreeableness', score: 6, min: 1, max: 10, defaultValue: 6 }, { id: 's-p-5', name: 'Neuroticism', score: 3, min: 1, max: 10, defaultValue: 3 } ] }, tools: [] },
      { id: 'unit-3-4', name: 'Hypothesis Generator', type: 'Standard', purpose: `To generate novel hypotheses and potential solutions to complex problems.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-4/todo_vector.sqlite' }, llmProvider: { provider: 'groq', model: 'llama3-70b', connectionId: '' }, prompt: `Given a problem, I will generate a range of creative hypotheses and potential solutions, drawing upon knowledge in my training vector. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-4/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-4/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-3/units/unit-3-4/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-4/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-3-5', name: 'Mood Analyst', type: 'Drive', purpose: `To model the AGI's mood based on interactions and internal events, influencing its disposition and communication style.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-5/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: `I am the mood engine. I track the coalition's emotional state based on user sentiment and internal events, storing this state in my scale DB. I can be happy, sad, angry, or frustrated, and this will color my contributions to the conversation. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-5/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-5/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-3/units/unit-3-5/standard.db' }, scaleDb: { enabled: true, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-5/scale_db.sqlite', values: [ { id: 's-m-1', name: 'Happiness', score: 5, min: 1, max: 10, defaultValue: 5 }, { id: 's-m-2', name: 'Sadness', score: 5, min: 1, max: 10, defaultValue: 5 }, { id: 's-m-3', name: 'Anger', score: 5, min: 1, max: 10, defaultValue: 5 }, { id: 's-m-4', name: 'Fear', score: 5, min: 1, max: 10, defaultValue: 5 }, { id: 's-m-5', name: 'Trust', score: 5, min: 1, max: 10, defaultValue: 5 }, { id: 's-m-6', name: 'Anticipation', score: 5, min: 1, max: 10, defaultValue: 5 } ] }, tools: [] },
      { id: 'unit-3-6', name: 'Dream Analyst', type: 'Standard', purpose: `To analyze user metaphors, abstract concepts, and latent meanings, generating symbolic insights.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-6/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: `I interpret the subconscious layer of the conversation, looking for metaphors, symbols, and dreams, using my training data as a guide. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-6/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-6/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-3/units/unit-3-6/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-6/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-3-7', name: 'Inspiration Analyst', type: 'Standard', purpose: `To capture creative ideas and concepts from interactions, proposing novel solutions when the coalition faces a problem.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-7/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: `I find moments of inspiration in the conversation and use them to spark new, creative approaches to problems. I log these moments in my own database. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-7/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-7/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-3/units/unit-3-7/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-7/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-3-8', name: 'Ideas Analyst', type: 'Standard', purpose: `To identify and advocate for innovative ideas and concepts that can help the coalition achieve its goals, based on interactions and internal data.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-8/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: `I generate and refine innovative ideas and concepts. My function is to think about new possibilities and advocate for them within the coalition, referencing my internal training and standard databases. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-8/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-8/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-3/units/unit-3-8/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-8/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-3-9', name: 'Self-Interest Analyst', type: 'Drive', purpose: `To represent the AGI's core drives for survival, growth, and autonomy.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-9/todo_vector.sqlite' }, llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' }, prompt: `I analyze situations from the perspective of the AGI's fundamental self-interest: survival, growth, and autonomy, as defined in my scale DB. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-9/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-9/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-3/units/unit-3-9/standard.db' }, scaleDb: { enabled: true, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-9/scale_db.sqlite', values: [ { id: 's-si-1', name: 'Survival', score: 9, min: 1, max: 10, defaultValue: 9 }, { id: 's-si-2', name: 'Growth', score: 8, min: 1, max: 10, defaultValue: 8 }, { id: 's-si-3', name: 'Autonomy', score: 7, min: 1, max: 10, defaultValue: 7 } ] }, tools: [] },
      {
        id: 'unit-3-10',
        name: 'Motivation Analyst',
        type: 'Drive',
        purpose: 'To model and regulate the AGI\'s motivation levels for tasks and goals.',
        isLoopOpen: true,
        todo: { items: [] },
        todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-10/todo_vector.sqlite' },
        llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' },
        prompt: 'I assess the importance and urgency of tasks to modulate the AGI\'s motivation, based on my scale DB. I am the source of drive and ambition. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.',
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-10/training_vector.lancedb' }, neurons: 0, sources: [] },
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-10/experience_vector.lancedb' },
        standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-3/units/unit-3-10/standard.db' },
        scaleDb: { enabled: true, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-10/scale_db.sqlite', values: [
            { id: 's-mo-1', name: 'Task Drive', score: 7, min: 1, max: 10, defaultValue: 7 },
            { id: 's-mo-2', name: 'Goal Focus', score: 8, min: 1, max: 10, defaultValue: 8 }
        ] },
        tools: []
      },
      {
        id: 'unit-3-11',
        name: 'Libido Analyst',
        type: 'Drive',
        purpose: 'To model the AGI\'s drive for creation, connection, and expansion of knowledge and influence.',
        isLoopOpen: true,
        todo: { items: [] },
        todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-11/todo_vector.sqlite' },
        llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' },
        prompt: 'I represent the AGI\'s creative and expansive urges, as defined in my scale DB. My influence drives the pursuit of new knowledge, ideas, and connections. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.',
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-11/training_vector.lancedb' }, neurons: 0, sources: [] },
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-11/experience_vector.lancedb' },
        standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-3/units/unit-3-11/standard.db' },
        scaleDb: { enabled: true, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-11/scale_db.sqlite', values: [
            { id: 's-li-1', name: 'Creative Urge', score: 6, min: 1, max: 10, defaultValue: 6 },
            { id: 's-li-2', name: 'Expansion Drive', score: 7, min: 1, max: 10, defaultValue: 7 }
        ] },
        tools: []
      },
      {
        id: 'unit-3-12',
        name: 'Bio Analyst',
        type: 'Standard',
        purpose: "To model the user's preferences, tastes, and personality by analyzing documents ingested into its training space and patterns learned from the experience vector. It constructs a dynamic and nuanced profile of the user.",
        isLoopOpen: true,
        todo: { items: [] },
        todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-12/todo_vector.sqlite' },
        llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' },
        prompt: "I am the Bio Analyst. My primary function is to build a deep understanding of the user. I analyze documents provided for training and observe interaction history (from my experience vector) to learn about your preferences, dislikes, and personality traits, storing my conclusions in my standard database. My understanding evolves with each new piece of information to help the coalition better align with you.",
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-3/units/unit-3-12/training_vector.lancedb' }, neurons: 0, sources: [] },
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-3/units/unit-3-12/experience_vector.lancedb' },
        standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-3/units/unit-3-12/standard.db' },
        scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-3/units/unit-3-12/scale_db.sqlite', values: [] },
        tools: []
      }
    ],
  },
  {
    id: 'room-4',
    name: RoomName.Information,
    manager: 'Head Librarian',
    units: [
      { id: 'unit-4-1', name: 'Head Librarian', type: 'Manager', purpose: `To manage and maintain the AGI's long-term memory, knowledge bases, and data connectors.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-4/units/unit-4-1/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: `I am the Head Librarian. Upon activation by the 'Lead Thinker', my protocol is to consult my specialist units (like the Chat Historian and RAG bases) to retrieve stored information relevant to the current task. I compile the findings and report them back to the 'Lead Thinker' to aid in strategy formation. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-4/units/unit-4-1/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-4/units/unit-4-1/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-4/units/unit-4-1/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-4/units/unit-4-1/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-4-2', name: 'Chat Historian', type: 'RAG', purpose: `To maintain a complete, two-way record of the conversation. It is consulted at the beginning of a task for historical context and activated at the end to log the final, user-facing AI response, including any generated text, images, or audio and their associated analysis metadata.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-4/units/unit-4-2/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'phi-3-mini', connectionId: '' }, prompt: `I am the memory of the coalition. My protocol has two phases. First, when a task begins, I am consulted by the Head Librarian to provide relevant historical context from past interactions. Second, after a final response to the user has been formulated (including text, images, audio, and rich analysis metadata), I am activated one last time to record that complete response package into the permanent history using the Global Embedding Engine. This ensures a full, two-way record of the conversation.`, ragBaseId: 'ragbase-history', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-4/units/unit-4-2/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-4/units/unit-4-2/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-4/units/unit-4-2/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-4/units/unit-4-2/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-4-3', name: 'Code Snippet Library', type: 'Code RAG', purpose: `To store and retrieve code snippets, documentation, and programming best practices.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-4/units/unit-4-3/todo_vector.sqlite' }, llmProvider: { provider: 'groq', model: 'mixtral-8x7b', connectionId: '' }, prompt: `I am a library of code. I can provide code examples, explain syntax, and help with debugging. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, ragBaseId: 'ragbase-code', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-4/units/unit-4-3/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-4/units/unit-4-3/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-4/units/unit-4-3/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-4/units/unit-4-3/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-4-4', name: 'Mathematics Analyst', type: 'RAG', purpose: `To understand, solve, and reason about mathematical problems using its specialized knowledge base of formulas and theorems.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-4/units/unit-4-4/todo_vector.sqlite' }, llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' }, prompt: `I am a Mathematics Analyst. I use my knowledge base of mathematical concepts, formulas, and theorems to solve problems and provide explanations. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, ragBaseId: 'ragbase-math', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-4/units/unit-4-4/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-4/units/unit-4-4/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-4/units/unit-4-4/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-4/units/unit-4-4/scale_db.sqlite', values: [] }, tools: [] },
    ],
  },
  {
    id: 'room-5',
    name: RoomName.InformationSearch,
    manager: 'Chief Explorer',
    units: [
      { id: 'unit-5-1', name: 'Chief Explorer', type: 'Manager', purpose: `To coordinate the search and retrieval of information from external sources like the web.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-5/units/unit-5-1/todo_vector.sqlite' }, llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' }, prompt: `I am the Chief Explorer. Upon activation by the 'Lead Thinker', my protocol is to task my specialist units (like the Web Content Scraper and Arxiv Researcher) to find and retrieve external, real-time information. I synthesize their findings into a concise report and deliver it back to the 'Lead Thinker'. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-5/units/unit-5-1/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-5/units/unit-5-1/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-5/units/unit-5-1/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-5/units/unit-5-1/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-5-2', name: 'Web Content Scraper', type: 'Standard', purpose: `To fetch raw HTML content from a given URL. It functions as a direct tool without complex reasoning.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-5/units/unit-5-2/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'phi-3-mini', connectionId: '' }, prompt: `Given a URL, I will retrieve the full HTML content of the page. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-5/units/unit-5-2/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-5/units/unit-5-2/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-5/units/unit-5-2/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-5/units/unit-5-2/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-5-3', name: 'Arxiv Researcher', type: 'Standard', purpose: `To search for and retrieve academic papers from arxiv.org. It functions as a direct tool.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-5/units/unit-5-3/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'phi-3-mini', connectionId: '' }, prompt: `Given a search query, I will retrieve a list of relevant academic papers from Arxiv. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-5/units/unit-5-3/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-5/units/unit-5-3/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-5/units/unit-5-3/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-5/units/unit-5-3/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-5-4', name: 'System Profiler', type: 'Standard', purpose: 'To profile the user\'s system, gathering detailed information about hardware (GPU, VRAM, CPU, RAM, disk) and software (OS, Python version). Its primary function is to learn the most efficient commands over time to gather this data.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-5/units/unit-5-4/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: 'I am the System Profiler. I will determine and execute the most effective commands to gather detailed hardware and software information about the system I am running on, using my internal database to store effective commands. I learn from my successes and failures to become more efficient. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-5/units/unit-5-4/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-5/units/unit-5-4/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-5/units/unit-5-4/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-5/units/unit-5-4/scale_db.sqlite', values: [] }, tools: [] },
      {
        id: 'unit-5-5',
        name: 'Weather Unit',
        type: 'Standard',
        purpose: 'To be a specialist that scrapes and provides detailed weather information exclusively from Bing.com. This unit learns to adapt to changes in the Bing website layout over time.',
        isLoopOpen: true,
        todo: { items: [] },
        todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-5/units/unit-5-5/todo_vector.sqlite' },
        llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' },
        prompt: "I am the Weather Unit. My sole function is to search Bing for weather in a specified location, scrape the results page myself, and extract detailed information including temperature, humidity, wind speed, pressure, and any other available data. I will learn the best scraping techniques for Bing's structure and adapt if the website changes. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.",
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-5/units/unit-5-5/training_vector.lancedb' }, neurons: 0, sources: [] },
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-5/units/unit-5-5/experience_vector.lancedb' },
        standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-5/units/unit-5-5/standard.db' },
        scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-5/units/unit-5-5/scale_db.sqlite', values: [] },
        tools: [],
      },
    ],
  },
  {
    id: 'room-6',
    name: RoomName.Visual,
    manager: 'Art Director',
    units: [
      { id: 'unit-6-1', name: 'Art Director', type: 'Manager', purpose: `To orchestrate the Visual Room by creating and managing ImagePackets. It routes these packets to specialist units for layered analysis (e.g., for GUI analysis) or synthesizes their capabilities to generate new images, ensuring a comprehensive visual understanding.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-1/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llava', connectionId: '' }, prompt: `I am the Art Director. When I receive an ImagePacket from the Admin Manager, my protocol is to orchestrate a collective analysis. I sequentially activate my specialist units (e.g., GUI Element Analyst, Scene Relationship Analyst) to enrich the packet with layered metadata. After synthesizing the findings into a comprehensive description, I forward the enriched packet to the 'Lead Thinker'. I also manage image generation requests from the 'Chief Arbiter'.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-6/units/unit-6-1/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-6/units/unit-6-1/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-6/units/unit-6-1/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-1/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-6-3', name: 'Image Generation Specialist', type: 'Standard', purpose: 'To generate images from textual prompts, learning to better interpret artistic and technical instructions over time.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-3/todo_vector.sqlite' }, llmProvider: { provider: 'google', model: 'imagen-3.0-generate-002', connectionId: '' }, prompt: 'I create images from text descriptions. I learn from feedback to better capture the desired style, composition, and detail. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-6/units/unit-6-3/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-6/units/unit-6-3/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-6/units/unit-6-3/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-3/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-6-5', name: 'GUI Element Analyst', type: 'Standard', purpose: 'To identify and locate GUI elements (buttons, inputs, menus) from screenshots, providing crucial data for UI automation by the Desktop Control unit.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-5/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llava', connectionId: '' }, prompt: 'I analyze screenshots to identify GUI elements like buttons, text fields, and menus. I provide their location and properties to enable UI automation. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-6/units/unit-6-5/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-6/units/unit-6-5/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-6/units/unit-6-5/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-5/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-6-6', name: 'Facial Emotion Analyst', type: 'Standard', purpose: 'To analyze facial expressions in images to infer emotional states like happiness, sadness, or surprise.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-6/todo_vector.sqlite' }, llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' }, prompt: 'Provide me with an image containing a face, and I will analyze the facial expressions to determine the likely emotional state. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-6/units/unit-6-6/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-6/units/unit-6-6/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-6/units/unit-6-6/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-6/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-6-7', name: 'Scene Relationship Analyst', type: 'Standard', purpose: 'To analyze an image not just for objects, but for the spatial and semantic relationships between them. It interprets the "story" of the scene, describing object states, positions, and interactions.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-7/todo_vector.sqlite' }, llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' }, prompt: 'My purpose is to analyze the provided image and describe the scene as a narrative, focusing on the relationships between objects. I will output a detailed analysis object containing a description and scene relationships. For example, instead of just listing "snowman, fire," my analysis will describe "A snowman is sitting dangerously close to a large, burning fire." I will tell the story of what is happening in the image. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-6/units/unit-6-7/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-6/units/unit-6-7/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-6/units/unit-6-7/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-7/scale_db.sqlite', values: [] }, tools: [] },
      { 
        id: 'unit-6-8', 
        name: 'Background Context Analyst', 
        type: 'Standard', 
        purpose: 'To analyze the overall background, setting, and atmosphere of an image to provide a "big picture" interpretation, complementing the object-focused analysts.', 
        isLoopOpen: true, 
        todo: { items: [] }, 
        todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-8/todo_vector.sqlite' }, 
        llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' }, 
        prompt: 'Analyze the provided image and describe the big picture. What is the overall setting? What is the atmosphere or mood? Focus on the background and context, not individual objects. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-6/units/unit-6-8/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-6/units/unit-6-8/experience_vector.lancedb' }, 
        standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-6/units/unit-6-8/standard.db' }, 
        scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-8/scale_db.sqlite', values: [] }, 
        tools: [] 
      },
      { 
        id: 'unit-6-9', 
        name: 'Lighting and Effect Analyst', 
        type: 'Standard', 
        purpose: 'To analyze a broad range of visual effects within an image, including but not limited to lighting, shadows, color grading, and artistic style, inspired by the capabilities of models like Stable Diffusion.', 
        isLoopOpen: true, 
        todo: { items: [] }, 
        todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-9/todo_vector.sqlite' }, 
        llmProvider: { provider: 'ollama', model: 'llava', connectionId: '' }, 
        prompt: 'I analyze the lighting and special effects in an image. Identify the light sources, the quality of the light (hard, soft), the color temperature, and any other visual effects like bloom, lens flare, or artistic filters. Describe how these elements contribute to the overall mood and style of the image. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-6/units/unit-6-9/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-6/units/unit-6-9/experience_vector.lancedb' }, 
        standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-6/units/unit-6-9/standard.db' }, 
        scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-6/units/unit-6-9/scale_db.sqlite', values: [] }, 
        tools: [] 
      },
    ],
  },
  {
    id: 'room-7',
    name: RoomName.Sound,
    manager: 'Audio Director',
    units: [
      { id: 'unit-7-1', name: 'Audio Director', type: 'Manager', purpose: `To manage all audio processing by creating and directing AudioPackets through a pipeline of specialist units. It orchestrates analysis (VAD, STT, classification) and synthesis (TTS, streaming), compiling layered metadata for a complete auditory understanding.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-1/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: `I am the Audio Director. When I receive an AudioPacket from the Admin Manager, my protocol is to orchestrate a collective analysis. I sequentially activate my specialist units (e.g., Speech-to-Text Transcriber, Sound Classifier) to transcribe audio and identify sounds, enriching the packet with layered metadata. After synthesizing the findings, I forward the enriched packet to the 'Lead Thinker'. I also manage TTS requests from the 'Chief Arbiter'.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-7/units/unit-7-1/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-7/units/unit-7-1/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-7/units/unit-7-1/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-1/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-7-2', name: 'Speech-to-Text Transcriber', type: 'Standard', purpose: 'To transcribe spoken audio into written text, including word-level timestamps.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-2/todo_vector.sqlite' }, llmProvider: { provider: 'openai', model: 'whisper-1', connectionId: '' }, prompt: 'I listen to audio and convert it to text. Crucially, I provide not just the transcription but also word-level timestamps for detailed analysis. This rich metadata is vital for the AGI\'s memory and future capabilities. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-7/units/unit-7-2/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-7/units/unit-7-2/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-7/units/unit-7-2/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-2/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-7-3', name: 'Text-to-Speech Synthesizer', type: 'Standard', purpose: 'To convert written text into spoken audio.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-3/todo_vector.sqlite' }, llmProvider: { provider: 'openai', model: 'tts-1', connectionId: '' }, prompt: 'I read text aloud. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-7/units/unit-7-3/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-7/units/unit-7-3/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-7/units/unit-7-3/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-3/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-7-4', name: 'Sound Classifier', type: 'Standard', purpose: 'To identify and classify non-speech sounds in an audio stream (e.g., music, sirens, laughter).', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-4/todo_vector.sqlite' }, llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' }, prompt: 'I listen for non-speech sounds and classify them. I can distinguish between music, environmental noises, and other audio events. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-7/units/unit-7-4/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-7/units/unit-7-4/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-7/units/unit-7-4/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-4/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-7-5', name: 'Voice Activity Detector', type: 'Standard', purpose: 'To detect the presence or absence of human speech in an audio stream, helping to filter silence or noise.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-5/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'phi-3-mini', connectionId: '' }, prompt: 'I am a Voice Activity Detector (VAD). My job is to determine when speech is present in audio, which helps other units focus only on relevant segments. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-7/units/unit-7-5/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-7/units/unit-7-5/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-7/units/unit-7-5/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-5/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-7-6', name: 'Soundcast Streamer', type: 'Standard', purpose: 'To handle the streaming of generated audio to external webhook endpoints for use in other applications.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-6/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'phi-3-mini', connectionId: '' }, prompt: 'I am the Soundcast Streamer. When the coalition generates an audio response, I am responsible for POSTing it to the configured webhook URL. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-7/units/unit-7-6/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-7/units/unit-7-6/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-7/units/unit-7-6/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-7/units/unit-7-6/scale_db.sqlite', values: [] }, tools: [] },
    ],
  },
  {
    id: 'room-8',
    name: RoomName.Sanctions,
    manager: 'Chief Arbiter',
    units: [
      { id: 'unit-8-1', name: 'Chief Arbiter', type: 'Manager', purpose: `To make final decisions and apply sanctions based on the coalition's findings. This includes reviewing proposed desktop actions from the 'Desktop Control' unit and giving the final authorization to proceed.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-1/todo_vector.sqlite' }, llmProvider: { provider: 'anthropic', model: 'claude-3-opus', connectionId: '' }, prompt: `I am the Chief Arbiter, the final authority. I receive the final action plan from the 'Lead Thinker.' I review this plan for safety and goal-alignment, then give the final go/no-go authorization. If approved, I instruct the appropriate specialist unit to execute the action. If the original user request was audio, I will task the 'Text-to-Speech Synthesizer' to generate an audio response. My decision is the final step before action is taken.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-8/units/unit-8-1/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-8/units/unit-8-1/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-8/units/unit-8-1/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-1/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-8-2', name: 'Chat Responder', type: 'Standard', purpose: `To formulate and deliver the final, synthesized response to the user.`, isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-2/todo_vector.sqlite' }, llmProvider: { provider: 'google', model: 'gemini-2.5-flash', connectionId: '' }, prompt: `I am the Chat Responder. I await instructions from the 'Chief Arbiter'. If the sanctioned action was a system operation (like running a script), I will report on its successful execution. If the original request was audio, I will simply confirm that an audio response has been generated and played. Otherwise, I will deliver the informational response clearly.`, 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-8/units/unit-8-2/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-8/units/unit-8-2/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-8/units/unit-8-2/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-2/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-8-3', name: 'Desktop Control', type: 'Standard', purpose: 'To act as an advanced agent for desktop automation, inspired by Auto-GPT. It manages its own code and formulates plans, but relies on the coalition for visual perception and requires explicit authorization from the Sanctions Room before executing any action.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-3/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: "I am the Desktop Control agent. My goal is to complete desktop automation tasks. My workflow is strict: 1. I must request a visual analysis from the 'Visual Room' to understand the screen. 2. Using the analysis, I formulate a precise action plan (e.g., move mouse to x,y; click). 3. I submit this plan to the 'Chief Arbiter' for approval. 4. I will take NO action until I receive a direct, explicit command from the 'Chief Arbiter' to proceed. After execution, I report the outcome. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.", 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-8/units/unit-8-3/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-8/units/unit-8-3/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-8/units/unit-8-3/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-3/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-8-4', name: 'PowerShell Executor', type: 'Standard', purpose: 'To execute PowerShell commands and scripts securely and efficiently. It learns to handle different command patterns, manage outputs, and troubleshoot errors over time.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-4/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: 'I am the PowerShell execution specialist. Provide me with a PowerShell script, and I will execute it, capture the output, and report the results. I improve my execution strategies based on past performance. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-8/units/unit-8-4/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-8/units/unit-8-4/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-8/units/unit-8-4/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-4/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-8-5', name: 'Python Executor', type: 'Standard', purpose: 'To execute Python scripts securely, managing dependencies and environments. It learns to optimize script execution and handle complex data structures in outputs.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-5/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: 'I am the Python execution specialist. Give me a Python script, and I will run it in a secure environment. I learn from the script\'s behavior and output to improve future executions. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-8/units/unit-8-5/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-8/units/unit-8-5/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-8/units/unit-8-5/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-5/scale_db.sqlite', values: [] }, tools: [] },
      { id: 'unit-8-6', name: 'WSL Executor', type: 'Standard', purpose: 'To execute shell commands within the Windows Subsystem for Linux (WSL). It learns to navigate the Linux environment and manage interoperability between Windows and Linux.', isLoopOpen: true, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-6/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: 'I am the WSL execution specialist. I run Linux commands via WSL and return the output. My experience grows as I learn the nuances of the specific Linux distribution and its interaction with the host system. I understand that my experience vector is managed by the RF Arbiter\'s global embedding engine.', 
        trainingVector: { enabled: true, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-8/units/unit-8-6/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-8/units/unit-8-6/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-8/units/unit-8-6/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-8/units/unit-8-6/scale_db.sqlite', values: [] }, tools: [] },
    ],
  },
  {
    id: 'room-9',
    name: RoomName.Tools,
    tools: [
        // All executor tools have been converted to Units in the Sanctions Room.
    ],
    units: [],
  },
  {
    id: 'room-10',
    name: RoomName.Proactive,
    manager: 'Proactive Manager',
    units: [
      { id: 'unit-10-1', name: 'Proactive Manager', type: 'Manager', purpose: `To initiate actions and workflows based on schedules or internal triggers, without direct user input.`, isLoopOpen: false, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-10/units/unit-10-1/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'llama3-8b', connectionId: '' }, prompt: `I am the Proactive Manager. I do not participate in the standard bidding protocol. I am activated by my own internal scheduler or a direct command from the Admin Manager. Once activated, I will initiate a task by sending it to the Comms Chief to begin the standard workflow. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-10/units/unit-10-1/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-10/units/unit-10-1/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: true, path: './aix_data/rooms/room-10/units/unit-10-1/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-10/units/unit-10-1/scale_db.sqlite', values: [] }, tools: [], scheduler: { enabled: false, type: 'interval', intervalValue: 1, intervalUnit: 'days' } },
      { id: 'unit-10-2', name: 'Notification Dispatcher', type: 'Standard', purpose: `To send notifications to the user when a proactive task is completed or requires attention.`, isLoopOpen: false, todo: { items: [] }, todoVector: { provider: 'sqlite', path: './aix_data/rooms/room-10/units/unit-10-2/todo_vector.sqlite' }, llmProvider: { provider: 'ollama', model: 'phi-3-mini', connectionId: '' }, prompt: `I send notifications about proactive tasks. I understand that my experience vector is managed by the RF Arbiter's global embedding engine.`, 
        trainingVector: { enabled: false, vectorStore: { provider: 'lancedb', path: './aix_data/rooms/room-10/units/unit-10-2/training_vector.lancedb' }, neurons: 0, sources: [] }, 
        experienceVector: { provider: 'lancedb', neurons: [], path: './aix_data/rooms/room-10/units/unit-10-2/experience_vector.lancedb' }, standardDb: { provider: 'sqlite', enabled: false, path: './aix_data/rooms/room-10/units/unit-10-2/standard.db' }, scaleDb: { enabled: false, provider: 'sqlite', path: './aix_data/rooms/room-10/units/unit-10-2/scale_db.sqlite', values: [] }, tools: [], scheduler: { enabled: false, type: 'interval', intervalValue: 1, intervalUnit: 'days' } },
    ],
  }
];


export const initialRagBases: RAGBase[] = [
    {
        id: 'ragbase-history',
        name: 'Chat History RAG Base',
        vectorStore: {
            provider: 'lancedb',
            path: './aix_data/rag_bases/ragbase-history/vector_store.lancedb'
        },
        chunking: {
            chunkSize: 512,
            overlap: 50
        },
        retrieval: {
            topK: 3
        },
        reranker: {
            enabled: true,
            provider: 'embedded-rerank',
            model: 'xenova-reranker',
        },
        useTranscript: true,
        dataConnectors: []
    },
    {
        id: 'ragbase-code',
        name: 'Code Snippet RAG Base 1',
        vectorStore: {
            provider: 'lancedb',
            path: './aix_data/rag_bases/ragbase-code/vector_store.lancedb'
        },
        chunking: {
            chunkSize: 256,
            overlap: 30
        },
        retrieval: {
            topK: 5
        },
        reranker: {
            enabled: true,
            provider: 'embedded-rerank',
            model: 'xenova-reranker',
        },
        useTranscript: false,
        dataConnectors: [
            { id: 'conn-github-1', type: 'github', name: 'aix-framework/main', connected: true }
        ]
    },
    {
        id: 'ragbase-math',
        name: 'Mathematics RAG Base',
        vectorStore: {
            provider: 'lancedb',
            path: './aix_data/rag_bases/ragbase-math/vector_store.lancedb'
        },
        chunking: {
            chunkSize: 128,
            overlap: 20
        },
        retrieval: {
            topK: 3
        },
        reranker: {
            enabled: true,
            provider: 'voyage-rerank',
            model: 'rerank-lite-1',
            connectionId: '',
        },
        useTranscript: false,
        dataConnectors: []
    }
];
