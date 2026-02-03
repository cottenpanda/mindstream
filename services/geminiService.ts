import { JournalEntry, PatternInsight, RelatedContentItem, SmartAnalysis } from "../types";

const API_URL = '/api/analyze';

// --- 1. Smart Analysis & Coaching ---
export const analyzeEntry = async (text: string, images?: string[]): Promise<SmartAnalysis> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'analyze', text, images })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    return result as SmartAnalysis;
  } catch (error) {
    console.error("Analysis failed", error);
    return {
      category: "Uncategorized",
      tags: [],
      sentiment: "neutral",
      moodEmoji: "📝",
      actionable: false
    };
  }
};

// --- 2. Related Content Pulling ---
export const findRelatedContent = async (text: string, category: string, tags: string[] = []): Promise<RelatedContentItem[]> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'related', text, category, tags })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Related content search failed", error);
    return [];
  }
};

// --- 3. Pattern Detection & Nudges ---
export const detectPatterns = async (entries: JournalEntry[]): Promise<PatternInsight[]> => {
  if (entries.length < 3) return [];

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'patterns', entries })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Pattern detection failed", error);
    return [];
  }
};
