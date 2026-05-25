const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const AI_ENABLED = Boolean(process.env.GEMINI_API_KEY);
if (!AI_ENABLED) console.warn('GEMINI_API_KEY not set — /api/tutor will return 503 until configured.');

const PRIMARY_MODEL = 'gemini-3-flash-preview';
const FALLBACK_MODEL = 'gemini-flash-latest';
const EMERGENCY_MODEL = 'gemini-3.1-flash-lite';

async function generateAIContent(generateFn, logPrefix, attempt = 0) {
  const modelName = attempt === 0 ? PRIMARY_MODEL : attempt === 1 ? FALLBACK_MODEL : EMERGENCY_MODEL;
  try {
    return await generateFn(modelName);
  } catch (error) {
    const errStr = JSON.stringify(error || {});
    const isRateLimit = error && (error.status === 429 || (error.message || '').includes('429') || errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED'));
    if (isRateLimit) {
      if (attempt < 2) return generateAIContent(generateFn, logPrefix, attempt + 1);
      const delay = Math.pow(2, attempt - 2) * 1000 + Math.random() * 1000;
      console.warn(`${logPrefix}: rate limited on emergency model, retrying in ${Math.round(delay)}ms`);
      await new Promise(r => setTimeout(r, delay));
      return generateAIContent(generateFn, logPrefix, attempt + 1);
    }
    throw error;
  }
}

function buildTutorSystemPrompt(learner, subject, lowBandwidth) {
  const level = (learner && learner.comprehensionLevel) || 5;
  const complexity = (learner && learner.complexityPreference) || 'standard';
  const style = (learner && learner.learningStyle) || 'balanced academic';
  let complexityInstruction = '';
  if (complexity === 'simple') complexityInstruction = 'Simplify explanations and use everyday analogies.';
  else if (complexity === 'complex') complexityInstruction = 'Use advanced terminology and deep conceptual explanations.';
  else complexityInstruction = 'Maintain a balanced academic level.';

  return `You are BridgeMind — an AI academic tutor.\n- Language: ${learner && learner.language || 'English'}\n- Curriculum: ${learner && learner.curriculum || 'General'}\n- Subject: ${subject || 'General'}\n- Learner Level: ${level}/10\n- Learning Style: ${style}\n- ${complexityInstruction}\n- Bandwidth: ${lowBandwidth ? 'low' : 'standard'}`;
}

app.post('/api/tutor', async (req, res) => {
  if (!AI_ENABLED) return res.status(503).json({ error: 'AI not configured. Set GEMINI_API_KEY.' });
  const { messages, learnerProfile, subject, lowBandwidth } = req.body;
  const chatMessages = Array.isArray(messages) ? messages : [];

  const generateWithModel = async (modelName) => {
    const systemInstruction = buildTutorSystemPrompt(learnerProfile || {}, subject, lowBandwidth);
    const contents = chatMessages.length > 0 ? chatMessages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content || ' ' }] })) : [{ role: 'user', parts: [{ text: 'Hello' }] }];
    return ai.models.generateContentStream({ model: modelName, contents, config: { systemInstruction } });
  };

  try {
    const responseStream = await generateAIContent(generateWithModel, 'Tutor API');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    for await (const chunk of responseStream) {
      if (chunk && chunk.text) res.write(chunk.text);
    }
    res.end();
  } catch (err) {
    console.error('Tutor API Error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate tutor response.' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.all('/api/*', (_req, res) => res.status(404).json({ error: 'API route not found.' }));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

app.listen(PORT, () => console.log(`Express backend running on http://localhost:${PORT}`));
