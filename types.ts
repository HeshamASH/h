export enum MessageRole {
    USER = 'user',
    MODEL = 'model',
}

export enum AppMode {
    CODEBASE = 'Codebase',
    RESEARCH = 'Research Papers',
    SUPPORT = 'Support Tickets',
    CUSTOM = 'Custom Dataset',
}

export enum Intent {
    QUERY_DOCUMENTS = 'query_documents',
    GENERATE_CODE = 'generate_code',
    CHIT_CHAT = 'chit_chat',
    UNKNOWN = 'unknown',
}

export enum ResponseType {
    RAG = 'RAG',
    CHIT_CHAT = 'Chit-Chat',
    CODE_GENERATION = 'Code Generation',
}

export enum ModelId {
    GEMINI_FLASH_LITE = 'gemini-flash-lite',
    GEMINI_PRO_VERTEX = 'gemini-pro-vertex',
}

export type FileViewType = 'code' | 'document';

export interface ModelDefinition {
  id: ModelId;
  name: string;
  model: string;
}

export const MODELS: ModelDefinition[] = [
  {
    id: ModelId.GEMINI_FLASH_LITE,
    name: 'Gemini Flash Lite',
    model: 'gemini-flash-lite-latest'
  },
  {
    id: ModelId.GEMINI_PRO_VERTEX,
    name: 'Gemini Pro (Advanced)',
    model: 'gemini-2.5-pro'
  }
];

export interface Source {
  id: string;
  fileName: string;
  path: string;
}

export interface CodeSuggestion {
  file: Source;
  thought: string;
  originalContent: string;
  suggestedContent: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  sources?: Source[];
  suggestion?: CodeSuggestion;
  editedFile?: Source;
  responseType?: ResponseType;
  modelId?: ModelId;
}

export interface ElasticResult {
  source: Source;
  contentSnippet: string;
  score: number;
}
