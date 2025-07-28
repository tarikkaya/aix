

export interface Tool {
  id: string;
  name: string;
  language: 'javascript' | 'python' | 'powershell';
  content: string;
}

export interface TodoItem {
  id: string;
  text: string;
  status: 'Pending' | 'In Progress' | 'Completed';
}

export interface Step {
  id: string;
  unitId: string; // The ID of the unit to activate
}

export interface Scheduler {
  enabled: boolean;
  type: 'datetime' | 'interval';
  datetime?: string; // ISO 8601 format
  intervalValue?: number;
  intervalUnit?: 'minutes' | 'hours' | 'days';
}

export interface Room {
  id: string;
  name: string;
  manager?: string;
  units: Unit[];
  tools?: Tool[];
  stepMaker?: Step[];
}

export interface DataConnector {
  id:string;
  type: 'notion' | 'github';
  name: string;
  connected: boolean;
}

export interface Unit {
  id:string;
  name: string;
  type: 'Standard' | 'Manager' | 'RAG' | 'Code RAG' | 'Drive';
  purpose: string;
  isLoopOpen: boolean;
  todo: {
    items: TodoItem[];
  };
  todoVector: {
    provider: 'sqlite';
    path: string;
  };
  llmProvider: {
    provider: string; // ID of the LLM provider
    model: string;
    apiKey?: string;
    path?: string;
  };
  prompt: string;
  trainingVector: {
    enabled: boolean;
    provider: string; // ID of the vector DB provider
    neurons: number;
    apiKey?: string;
    path?: string;
  };
  experienceVector: {
    provider: string; // ID of the vector DB provider
    rf: number;
    apiKey?: string;
    path?: string;
  };
  standardDb: {
    provider: string; // ID of the standard DB provider
    enabled: boolean;
    apiKey?: string;
    path?: string;
  };
  scaleVector: {
    enabled: boolean;
    provider: string; // ID of the standard DB provider
    apiKey?: string;
    path?: string;
    values: ScaleValue[];
  };
  ragBaseId?: string;
  tools: string[]; // Array of Tool IDs
  scheduler?: Scheduler;
}

export interface RAGBase {
  id: string;
  name: string;
  embedding: {
    provider: string;
    model: string;
    apiKey?: string;
    path?: string;
  };
  vectorStore: {
    provider: string;
    apiKey?: string;
    path?: string;
  };
  chunking: {
    chunkSize: number;
    overlap: number;
  };
  retrieval: {
    topK: number;
  };
  reranker: {
    enabled: boolean;
    provider?: string;
    model?: string;
    apiKey?: string;
    path?: string;
  };
  useTranscript: boolean;
  dataConnectors?: DataConnector[];
}

export interface ScaleValue {
    id: string;
    name: string;
    score: number;
    min: number;
    max: number;
    defaultValue: number;
}

export interface ChatFile {
  name: string;
  type: string; // MIME type
  content: string; // Base64 encoded content
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  files?: ChatFile[];
  timestamp: number;
  rf?: 'up' | 'down';
  rfReason?: string;
  systemRf?: boolean;
  isThinking?: boolean;
}

export interface ProviderOption {
    id: string;
    name: string;
}

export interface ModelOption extends ProviderOption {
    provider: 'local' | 'cloud';
}

export interface ApiKey {
  id: string;
  key: string;
  createdAt: number;
}

export interface InputDevice {
  id: string;
  name: string;
}

export interface ApiSettings {
  apiKeys: ApiKey[];
  apiPort: number;
  micId: string | null;
  speakerId: string | null;
  pushToTalkKey: string | null;
  webhookUrl: string | null;
  noiseSuppression: boolean;
  micGain: number;
  speakerGain: number;
}

export interface Model {
    id: string;
    name: string;
}

export interface Provider {
    id:string;
    name: string;
    type: 'cloud' | 'local' | 'local-embedded';
    models?: Model[];
    embeddingModels?: Model[];
}