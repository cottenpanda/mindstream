const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

module.exports = async function handler(req, res) {
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
    const { text, images, action, category, tags, entries } = req.body;

    if (action === 'analyze') {
      const result = await analyzeEntry(text, images);
      return res.status(200).json(result);
    }

    if (action === 'related') {
      const result = await findRelatedContent(text, category, tags || []);
      return res.status(200).json(result);
    }

    if (action === 'patterns') {
      const result = await detectPatterns(entries || []);
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

function getCurrentDateContext() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

async function analyzeEntry(text, images) {
  const parts = [];

  if (images && images.length > 0) {
    images.forEach(base64Str => {
      const base64Data = base64Str.split(',')[1] || base64Str;
      const mimeType = (base64Str.match(/data:([^;]+);/) || [])[1] || 'image/jpeg';
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
    3. Determine sentiment (positive, neutral, negative).
    4. Select a single emoji that best represents the mood.
    5. If actionable: Generate 3 short nextSteps.
    6. If reflective: Generate 1 insightPrompt question.

    Return JSON with: category, tags, sentiment, moodEmoji, actionable, nextSteps, insightPrompt`
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: { parts },
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    const result = JSON.parse(response.text || "{}");
    if (result.tags && Array.isArray(result.tags)) {
      result.tags = result.tags.map(t => String(t).toLowerCase());
    }
    return result;
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

async function findRelatedContent(text, category, tags = []) {
  return []; // Simplified for now
}

async function detectPatterns(entries) {
  return []; // Simplified for now
}
