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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { text, action } = req.body;

    if (action === 'analyze') {
      const result = await analyzeEntry(text, apiKey);
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function analyzeEntry(text, apiKey) {
  const prompt = `Analyze this journal entry and return ONLY a JSON object (no markdown):
"${text}"

Return JSON with:
{
  "category": "one of: Idea, Reflection, Planning, Learning, Health, Work, Random",
  "tags": ["tag1", "tag2", "tag3"],
  "sentiment": "positive or neutral or negative",
  "moodEmoji": "single emoji",
  "actionable": true or false,
  "nextSteps": ["step1", "step2", "step3"],
  "insightPrompt": "a reflective question"
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  try {
    const result = JSON.parse(responseText);
    if (result.tags) {
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

export const config = {
  api: {
    bodyParser: true,
  },
};
