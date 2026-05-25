import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'bridgemind-express-backend',
    },
  },
});

const AI_ENABLED = Boolean(process.env.GEMINI_API_KEY);
if (!AI_ENABLED) {
  console.warn('Gemini API key is missing. /api/tutor will return 503 until GEMINI_API_KEY is configured.');
}

const PRIMARY_MODEL = "gemini-3-flash-preview";
const FALLBACK_MODEL = "gemini-flash-latest";
const EMERGENCY_MODEL = "gemini-3.1-flash-lite";

async function generateAIContent(
  generateFn: (modelName: string) => Promise<any>,
  logPrefix: string,
  attempt = 0
): Promise<any> {
  const modelName = attempt === 0 ? PRIMARY_MODEL : attempt === 1 ? FALLBACK_MODEL : EMERGENCY_MODEL;

  try {
    return await generateFn(modelName);
  } catch (error: any) {
    const errorStr = JSON.stringify(error);
    const isRateLimit = error.status === 429 || error.message?.includes('429') || errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED');

    if (isRateLimit) {
      if (attempt < 2) {
        console.warn(`${logPrefix}: Rate limited on ${modelName}. Falling back to next model...`);
        return generateAIContent(generateFn, logPrefix, attempt + 1);
      }

      const delay = Math.pow(2, attempt - 2) * 1000 + Math.random() * 1000;
      console.warn(`${logPrefix}: Rate limited on emergency model. Retrying attempt ${attempt} in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return generateAIContent(generateFn, logPrefix, attempt + 1);
    }

    throw error;
  }
}

function buildTutorSystemPrompt(learner: any, subject?: string, lowBandwidth?: boolean) {
  const level = learner?.comprehensionLevel || 5;
  const complexity = learner?.complexityPreference || 'standard';
  const style = learner?.learningStyle || 'balanced academic';

  let complexityInstruction = '';
  if (complexity === 'simple') {
    complexityInstruction = 'Simplify explanations, use everyday analogies, and avoid jargon unless you define it clearly.';
  } else if (complexity === 'complex') {
    complexityInstruction = 'Use advanced terminology and deeper conceptual explanations appropriate for an advanced learner.';
  } else {
    complexityInstruction = 'Maintain a balanced, accessible academic style that is detailed but clear.';
  }

  return `You are BridgeMind — an AI academic tutor.
- Language: ${learner?.language || 'English'}
- Curriculum: ${learner?.curriculum || 'General'}
- Region: ${learner?.country || 'Africa'}
- Subject: ${subject || 'General'}
- Learner Level: ${level}/10
- Learning Style: ${style}
- Complexity: ${complexityInstruction}
- Bandwidth: ${lowBandwidth ? 'low' : 'standard'}

Provide a structured, step-by-step explanation with clear local examples and end with a short concept-check question.`;
}

app.post('/api/tutor', async (req, res) => {
  if (!AI_ENABLED) {
    return res.status(503).json({ error: 'AI is not configured. Set GEMINI_API_KEY to enable the tutor API.' });
  }

  const { messages, learnerProfile, subject, lowBandwidth } = req.body;
  const chatMessages = Array.isArray(messages) ? messages : [];

  const generateWithModel = async (modelName: string) => {
    const systemInstruction = buildTutorSystemPrompt(learnerProfile || {}, subject, lowBandwidth);
    const contents = chatMessages.length > 0
      ? chatMessages.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content || ' ' }]
        }))
      : [{ role: 'user', parts: [{ text: 'Hello, please help me with a topic.' }] }];

    return ai.models.generateContentStream({
      model: modelName,
      contents,
      config: { systemInstruction }
    });
  };

  try {
    const responseStream = await generateAIContent(generateWithModel, 'Tutor API');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }

    res.end();
  } catch (error: any) {
    console.error('Tutor API Error:', error);
    if (!res.headersSent) {
      const status = error.status === 429 ? 429 : 500;
      res.status(status).json({ error: 'Failed to generate tutor response. Please try again.' });
    }
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const shutdown = () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 30000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer();
