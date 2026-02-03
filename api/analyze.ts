import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text, images, action } = await req.json();

    if (action === 'analyze') {
      const result = await analyzeEntry(text, images);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'related') {
      const { category, tags } = await req.json();
      const result = await findRelatedContent(text, category, tags);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'patterns') {
      const { entries } = await req.json();
      const result = await detectPatterns(entries);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Helper to get date context
const getCurrentDateContext = () => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Analyze entry
async function analyzeEntry(text: string, images?: string[]) {
  const parts: any[] = [];

  if (images && images.length > 0) {
    images.forEach(base64Str => {
      const base64Data = base64Str.split(',')[1] || base64Str;
      const mimeType = base64Str.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
      parts.push({
        inlineData: { mimeType, data: base64Data }
      });
    });
  }

  const today = getCurrentDateContext();
  parts.push({
    text: `Context: Today is ${today}.
    Analyze this journal entry: "${text}".

    1. Categorize it (Idea, Reflection, Planning, Learning, Health, Work, Random).
    2. Extract 3 tags.
    3. Determine sentiment.
    4. Select a single emoji that best represents the specific mood or content.
    5. If it's an Idea, Plan, or Work task: Generate 3 concrete, short, actionable "nextSteps".
    6. If it's a Reflection, Emotion, or Learning: Generate 1 deep "insightPrompt" question.`
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          sentiment: { type: Type.STRING, enum: ["positive", "neutral", "negative"] },
          moodEmoji: { type: Type.STRING },
          actionable: { type: Type.BOOLEAN },
          nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          insightPrompt: { type: Type.STRING }
        },
        required: ["category", "tags", "sentiment", "actionable", "moodEmoji"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  if (result.tags && Array.isArray(result.tags)) {
    result.tags = result.tags.map((t: any) => String(t).toLowerCase());
  }
  return result;
}

// Find related content
async function findRelatedContent(text: string, category: string, tags: string[] = []) {
  const today = getCurrentDateContext();
  const tagsContext = tags.length > 0 ? `Keywords/Tags: ${tags.join(', ')}.` : '';

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Context: Today is ${today}.
    Journal entry (${category}): "${text}". ${tagsContext}
    Find 5 relevant external resources (articles, tools, guides).`,
    config: {
      tools: [{ googleSearch: {} }],
    }
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const items = chunks
    .filter((chunk: any) => chunk.web?.uri && chunk.web?.title)
    .map((chunk: any) => ({
      title: chunk.web.title,
      url: chunk.web.uri,
      snippet: "Related content via Google Search",
      source: "Google Search"
    }));

  return [...new Map(items.map((item: any) => [item.url, item])).values()].slice(0, 5);
}

// Detect patterns
async function detectPatterns(entries: any[]) {
  if (entries.length < 3) return [];

  const today = getCurrentDateContext();
  const recentEntries = entries.slice(0, 20).map(e => ({
    id: e.id,
    date: new Date(e.timestamp).toDateString(),
    text: e.content,
    category: e.analysis?.category
  }));

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Context: Today is ${today}.
    Journal entries: ${JSON.stringify(recentEntries)}.
    Identify up to 3 recurring patterns, habits, or themes with recommendations.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["habit", "goal", "mood", "topic"] },
            frequency: { type: Type.NUMBER },
            suggestion: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            relatedEntryIds: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
}
