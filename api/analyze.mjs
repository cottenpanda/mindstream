import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, action } = req.body;

    if (action === 'analyze') {
      const result = await analyzeEntry(text);
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function analyzeEntry(text) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const prompt = `Analyze this journal entry: "${text}".
Return a JSON object with these exact fields:
- category: one of (Idea, Reflection, Planning, Learning, Health, Work, Random)
- tags: array of 3 lowercase tags
- sentiment: one of (positive, neutral, negative)
- moodEmoji: a single emoji
- actionable: boolean
- nextSteps: array of 3 action items (if actionable)
- insightPrompt: a reflective question (if not actionable)`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch {
    return {
      category: "Uncategorized",
      tags: [],
      sentiment: "neutral",
      moodEmoji: "📝",
      actionable: false
    };
  }
}
