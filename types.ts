
export interface LocationData {
  latitude: number;
  longitude: number;
  displayName?: string;
}

export interface RelatedContentItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface SmartAnalysis {
  category: string;
  tags: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  moodEmoji?: string; // New: AI selected emoji/sticker
  actionable: boolean;
  nextSteps?: string[]; 
  insightPrompt?: string; 
}

export interface JournalEntry {
  id: string;
  content: string;
  images?: string[]; // Array of base64 strings
  timestamp: number;
  location?: LocationData;
  analysis?: SmartAnalysis;
  relatedContent?: RelatedContentItem[];
  isAnalyzed: boolean;
  isPinned?: boolean;
}

export interface PatternInsight {
  title: string;
  description: string;
  type: 'habit' | 'goal' | 'mood' | 'topic';
  frequency: number;
  suggestion?: string; // Short nudge
  recommendations?: string[]; // List of actionable advice
  relatedEntryIds?: string[]; // IDs of entries that contributed to this pattern
}

export type ViewState = 'capture' | 'journal' | 'insights' | 'calendar';

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}