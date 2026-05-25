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

// Google OAuth2 token verification
const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
if (!GOOGLE_CLIENT_ID) console.warn('GOOGLE_CLIENT_ID not set — Google auth will not validate tokens.');
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

async function verifyGoogleIdToken(idToken) {
  const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  return payload;
}

async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing Authorization header with Bearer token.' });
    if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Server misconfigured: GOOGLE_CLIENT_ID missing.' });
    const payload = await verifyGoogleIdToken(token);
    if (!payload || !payload.email) return res.status(401).json({ error: 'Invalid Google ID token.' });
    // Optionally restrict to Gmail addresses only
    // if (!payload.email.endsWith('@gmail.com')) return res.status(403).json({ error: 'Gmail account required.' });
    req.user = { id: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
    next();
  } catch (err) {
    console.warn('Auth verification failed:', err && err.message ? err.message : err);
    return res.status(401).json({ error: 'Invalid or expired Google ID token.' });
  }
}

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

app.post('/api/tutor', requireAuth, async (req, res) => {
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

// Auth verify endpoint - accepts id_token in body or Authorization header
app.post('/auth/verify', async (req, res) => {
  try {
    const idToken = req.body.id_token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!idToken) return res.status(400).json({ error: 'id_token required in body or Authorization header' });
    if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Server misconfigured: GOOGLE_CLIENT_ID missing.' });
    const payload = await verifyGoogleIdToken(idToken);
    return res.json({ user: { id: payload.sub, email: payload.email, name: payload.name, picture: payload.picture } });
  } catch (err) {
    console.warn('Auth verify failed:', err && err.message ? err.message : err);
    return res.status(401).json({ error: 'Invalid id_token' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.all('/api/*', (_req, res) => res.status(404).json({ error: 'API route not found.' }));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

app.listen(PORT, () => console.log(`Express backend running on http://localhost:${PORT}`));
