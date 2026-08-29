export type PromptMode = 'chat' | 'freeform' | 'structured' | 'gallery';

export type AppLanguage = 'uz' | 'en' | 'ru';

export interface AttachedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // base64
  previewUrl?: string;
  type: 'image' | 'audio' | 'document';
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  searchEntryPoint?: {
    renderedContent?: string;
  };
  groundingChunks?: GroundingChunk[];
  groundingSupports?: any[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  files?: AttachedFile[];
  timestamp: number;
  tokenCount?: number;
  groundingMetadata?: GroundingMetadata;
  isStreaming?: boolean;
  error?: string;
}

export interface SafetySetting {
  category: string;
  threshold: string;
}

export interface ModelConfig {
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  systemInstruction: string;
  responseMimeType: string;
  responseSchema?: string;
  enableGoogleSearch: boolean;
  thinkingLevel: 'LOW' | 'HIGH' | 'MINIMAL';
  safetySettings: SafetySetting[];
}

export interface StructuredRow {
  id: string;
  input: string;
  output: string;
}

export interface VariableTestCase {
  id: string;
  variables: Record<string, string>;
  result?: string;
  isLoading?: boolean;
  error?: string;
}

export interface SavedPrompt {
  id: string;
  title: string;
  mode: PromptMode;
  date: string;
  config: ModelConfig;
  chatMessages?: ChatMessage[];
  freeformText?: string;
  testCases?: VariableTestCase[];
  structuredRows?: StructuredRow[];
  structuredInputPrefix?: string;
  structuredOutputPrefix?: string;
}

export interface PresetTemplate {
  id: string;
  title: string;
  description: string;
  category: 'code' | 'nlp' | 'vision' | 'business' | 'creative' | 'uzbek';
  mode: PromptMode;
  iconName: string;
  badge?: string;
  config: Partial<ModelConfig>;
  initialChat?: { role: 'user' | 'model'; text: string }[];
  freeformText?: string;
  testCases?: VariableTestCase[];
  structuredRows?: StructuredRow[];
}
