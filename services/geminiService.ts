import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { JournalEntry, PatternInsight, RelatedContentItem, SmartAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to get a clear date string for context
const getCurrentDateContext = () => {
    return new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
};

// --- Retry Helper ---
// Automatically retries the operation if we hit a rate limit (429)
async function withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check for 429 (Too Many Requests) or "Quota" related messages
    const isRateLimit = error.status === 429 || 
                        (error.message && error.message.toLowerCase().includes('quota'));
    
    if (retries > 0 && isRateLimit) {
      console.warn(`Gemini Quota hit. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Exponential backoff: wait longer for each subsequent retry (1s, 2s, 4s)
      return withRetry(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

// --- 1. Smart Analysis & Coaching ---

export const analyzeEntry = async (text: string, images?: string[]): Promise<SmartAnalysis> => {
  try {
    const parts: any[] = [];
    
    // Add images if available
    if (images && images.length > 0) {
        images.forEach(base64Str => {
            // Remove data:image/xxx;base64, prefix if present for the API call
            const base64Data = base64Str.split(',')[1] || base64Str;
            // Detect mime type or default to jpeg (simple approach)
            const mimeType = base64Str.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
            
            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            });
        });
    }

    const today = getCurrentDateContext();

    // Add text prompt with strict date context
    parts.push({
        text: `Context: Today is ${today}.
        Analyze this journal entry: "${text}".
      
        1. Categorize it (Idea, Reflection, Planning, Learning, Health, Work, Random).
        2. Extract 3 tags.
        3. Determine sentiment.
        4. Select a single emoji that best represents the specific mood or content (e.g., 🏃 if running, 💡 if idea).
        5. If it's an Idea, Plan, or Work task: Generate 3 concrete, short, actionable "nextSteps". Ensure these steps are relevant to the current year (${today}) and context.
        6. If it's a Reflection, Emotion, or Learning: Generate 1 deep "insightPrompt" question.`
    });

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // Minimize latency
        systemInstruction: "You are a proactive life coach and executive assistant. Be concise, practical, and highly aware of the current date and time context.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            sentiment: { type: Type.STRING, enum: ["positive", "neutral", "negative"] },
            moodEmoji: { type: Type.STRING, description: "A single emoji representing the content" },
            actionable: { type: Type.BOOLEAN },
            nextSteps: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "A list of 3 immediate next actions if the entry is actionable/planning/idea." 
            },
            insightPrompt: {
              type: Type.STRING,
              description: "A single coaching question to deepen the thought if it is reflection/learning."
            }
          },
          required: ["category", "tags", "sentiment", "actionable", "moodEmoji"]
        }
      }
    }));

    const result = JSON.parse(response.text || "{}");
    
    // Enforce lowercase tags for consistency
    if (result.tags && Array.isArray(result.tags)) {
        result.tags = result.tags.map((t: any) => String(t).toLowerCase());
    }

    return result as SmartAnalysis;
  } catch (error) {
    console.error("Analysis failed", error);
    // Fallback
    return {
      category: "Uncategorized",
      tags: [],
      sentiment: "neutral",
      moodEmoji: "📝",
      actionable: false
    };
  }
};

// --- 2. Related Content Pulling (Grounding) ---

export const findRelatedContent = async (text: string, category: string, tags: string[] = []): Promise<RelatedContentItem[]> => {
  try {
    const today = getCurrentDateContext();
    const tagsContext = tags.length > 0 ? `Keywords/Tags identified: ${tags.join(', ')}.` : '';

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Context: Today is ${today}.
      The user wrote a journal entry categorized as "${category}": "${text}".
      ${tagsContext}

      Task: Use Google Search to find 6 specific, high-quality, relevant external resources. 
      
      CRITICAL SEARCH INSTRUCTIONS:
      1. IGNORE generic queries. Construct specific queries combining the user's specific topics (e.g. if they mention "product design portfolio", search for "best product design portfolio examples 2026", "portfolio case study structure").
      2. TARGET deep links: Look for specific articles, tools, templates, or guides. 
      3. AVOID generic homepages (e.g., do not return just "medium.com" or "youtube.com").
      4. If the user mentions a specific role or goal, prioritize authoritative guides or industry-standard examples for that specific role.
      5. Ensure you return enough variety to provide at least 3-5 distinct, valuable links.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // Minimize latency
        tools: [{ googleSearch: {} }],
        // Note: responseSchema and responseMimeType are not used with Google Search tools
      }
    }));

    // Extracting grounding chunks as per guidelines.
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Map grounding chunks to RelatedContentItem
    const items: RelatedContentItem[] = [];
    for (const chunk of chunks) {
      if (chunk.web?.uri && chunk.web?.title) {
        items.push({
          title: chunk.web.title,
          url: chunk.web.uri,
          snippet: "Related content found via Google Search", 
          source: "Google Search"
        });
      }
    }
    
    // Deduplicate by URL
    const uniqueItems = Array.from(new Map(items.map(item => [item.url, item])).values());

    return uniqueItems.slice(0, 5);

  } catch (error) {
    console.error("Related content search failed", error);
    return [];
  }
};

// --- 3. Pattern Detection & Nudges ---

export const detectPatterns = async (entries: JournalEntry[]): Promise<PatternInsight[]> => {
  if (entries.length < 3) return [];

  const today = getCurrentDateContext();

  // Prepare a summary of entries for context to save tokens, INCLUDING ID for linking
  const recentEntries = entries.slice(0, 20).map(e => ({
    id: e.id,
    date: new Date(e.timestamp).toDateString(),
    text: e.content,
    category: e.analysis?.category
  }));

  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Context: Today is ${today}.
      Here are recent journal entries: ${JSON.stringify(recentEntries)}.
      Identify up to 3 recurring patterns, habits, or themes.
      For each pattern found:
      1. Provide a title and description.
      2. Identify the specific 'id's of the entries that support this pattern (return as 'relatedEntryIds').
      3. Provide 3 specific, actionable recommendations on how to improve, achieve the goal, or maintain the habit.
      Be empathetic but direct. Ensure recommendations are temporally relevant to ${today}.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // Minimize latency
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["habit", "goal", "mood", "topic"] },
              frequency: { type: Type.NUMBER, description: "Estimated occurrence count" },
              suggestion: { type: Type.STRING, description: "A gentle nudge or question (summary)" },
              recommendations: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING }, 
                description: "List of 3 concrete things the user can do." 
              },
              relatedEntryIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "The exact IDs of the journal entries that triggered this pattern."
              }
            }
          }
        }
      }
    }));

    const rawResults = JSON.parse(response.text || "[]") as PatternInsight[];

    // Filter duplicates based on title (case-insensitive)
    const uniqueResults = rawResults.filter((insight, index, self) =>
      index === self.findIndex((t) => (
        t.title.toLowerCase() === insight.title.toLowerCase()
      ))
    );

    return uniqueResults;
  } catch (error) {
    console.error("Pattern detection failed", error);
    return [];
  }
};
