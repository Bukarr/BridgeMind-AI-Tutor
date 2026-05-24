import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

let isShuttingDown = false;

// Reject new requests when shutting down
app.use((req, res, next) => {
  if (isShuttingDown) return res.status(503).json({ error: 'Server is shutting down' });
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const AI_ENABLED = Boolean(process.env.GEMINI_API_KEY);
if (!AI_ENABLED) {
  console.warn('Gemini API key not found. AI endpoints will return 503 until GEMINI_API_KEY is configured.');
}

// Using modern model aliases from gemini-api skill
const PRIMARY_MODEL = "gemini-3-flash-preview";
const FALLBACK_MODEL = "gemini-flash-latest";
const EMERGENCY_MODEL = "gemini-3.1-flash-lite";

/**
 * Generic helper for AI content generation with multi-model fallback and backoff retry.
 */
async function generateAIContent(
  generateFn: (model: string) => Promise<any>,
  logPrefix: string,
  attempt = 0
): Promise<any> {
  const modelName = attempt === 0 ? PRIMARY_MODEL : attempt === 1 ? FALLBACK_MODEL : EMERGENCY_MODEL;
  
  try {
    return await generateFn(modelName);
  } catch (error: any) {
    const errorStr = JSON.stringify(error);
    const isRateLimit = error.status === 429 || error.message?.includes("429") || errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED");
    
    if (isRateLimit) {
      if (attempt < 2) {
        console.warn(`${logPrefix}: Quota reached on ${modelName}, falling back to ${attempt === 0 ? FALLBACK_MODEL : EMERGENCY_MODEL}...`);
        return generateAIContent(generateFn, logPrefix, attempt + 1);
      } else if (attempt < 6) {
        // Exponential backoff for emergency model
        const delay = Math.pow(2, attempt - 2) * 1000 + Math.random() * 1000;
        console.warn(`${logPrefix}: Rate limited on emergency model. Retrying attempt ${attempt} in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return generateAIContent(generateFn, logPrefix, attempt + 1);
      }
    }
    throw error;
  }
}

// Whitelist of MIME types supported by Gemini inlineData
const SUPPORTED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'text/plain', 'text/csv', 'text/markdown', 'text/html', 'application/json',
  'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac',
  'video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv', 'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp'
];

// API Routes
app.post("/api/tutor", async (req, res) => {
  if (!AI_ENABLED) {
    return res.status(503).json({ error: 'AI not configured. Set GEMINI_API_KEY to enable tutor features.' });
  }
  const { messages, learnerProfile, subject, lowBandwidth } = req.body;
  
  const generateWithModel = async (modelName: string, attempt = 0) => {
    try {
      const systemInstruction = buildTutorSystemPrompt(learnerProfile, subject, lowBandwidth);
      
      const contents = messages.map((m: any) => {
        const parts: any[] = [];
        
        if (m.content && m.content.trim()) {
          parts.push({ text: m.content });
        }
        
        if (m.attachments && m.attachments.length > 0) {
          m.attachments.forEach((file: any) => {
            if (SUPPORTED_MIME_TYPES.includes(file.mimeType)) {
              parts.push({
                inlineData: {
                  mimeType: file.mimeType,
                  data: file.data 
                }
              });
            } else {
              // Graceful fallback for unsupported types
              parts.push({
                text: `\n[System Note: User attached a file "${file.name}" of type "${file.mimeType}". If you can't process it, ask them to convert it to PDF or paste the text.]`
              });
            }
          });
        }

        // Gemini requires at least one part. If both content and attachments missing, add empty text.
        if (parts.length === 0) {
          parts.push({ text: " " });
        }

        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts
        };
      });

      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents,
        config: {
          systemInstruction
        }
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(chunk.text);
        }
      }
      res.end();
    } catch (error: any) {
      const errorStr = JSON.stringify(error);
      const isRateLimit = error.status === 429 || error.message?.includes("429") || errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED");
      if (isRateLimit) {
        if (attempt === 0) return generateWithModel(FALLBACK_MODEL, 1);
        if (attempt === 1) return generateWithModel(EMERGENCY_MODEL, 2);
        if (attempt < 6) {
          const delay = Math.pow(2, attempt - 2) * 1000 + Math.random() * 1000;
          console.warn(`Tutor API: Rate limited on emergency model. Retrying attempt ${attempt} in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return generateWithModel(EMERGENCY_MODEL, attempt + 1);
        }
      }
      throw error;
    }
  };

  try {
    await generateWithModel(PRIMARY_MODEL);
  } catch (error: any) {
    console.error("Tutor API Error:", error);
    
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.write("\n\n⚠️ [SYSTEM ERROR]: BridgeMind's neural link (Gemini) was interrupted. Please try again.");
        res.end();
      }
      return;
    }

    if (error.status === 429 || error.message?.includes("429")) {
      res.status(429).json({ error: "BridgeMind is processing a high volume of African scholars right now. Please count to ten and try again." });
    } else if (error.status === 404 || error.message?.includes("404")) {
      res.status(404).json({ error: "One of the Gemini models was not found. Please contact support or check the model configuration." });
    } else {
      res.status(500).json({ error: "Failed to generate tutor response via Gemini. Please try again." });
    }
  }
});

app.post("/api/explain", async (req, res) => {
  if (!AI_ENABLED) {
    return res.status(503).json({ error: 'AI not configured. Set GEMINI_API_KEY to enable explain features.' });
  }
  const { topic, subject, learnerProfile } = req.body;
  
  const complexity = learnerProfile.complexityPreference || 'standard';
  let complexityInstruction = "";
  if (complexity === 'simple') {
    complexityInstruction = "Explain this concept for a total beginner using simple, non-technical language and many analogies.";
  } else if (complexity === 'complex') {
    complexityInstruction = "Provide a deep, rigorous academic analysis using professional terminology and advanced concepts.";
  }

  try {
    const explanation = await generateAIContent(async (modelName) => {
      const prompt = `You are BridgeMind 2.0. Provide a deep, exam-focused explanation of the concept "${topic}" within the subject of "${subject}" for a ${learnerProfile.curriculum} student in ${learnerProfile.country}.
      
      Adaptive Context:
      - Detected Student Level: ${learnerProfile.comprehensionLevel || 'Unknown'}/10
      - Detected Learning Style: ${learnerProfile.learningStyle || 'Standard'}
      - Complexity Requirement: ${complexityInstruction || 'Standard academic depth'}
      
      Rules:
      1. Use ${learnerProfile.language}.
      2. Start with a high-level summary.
      3. Use bullet points for key sub-concepts.
      4. Include exactly 1 real-world African application/example.
      5. End with a "BridgeMind Pro-Tip" for the exam.
      6. Use Markdown and LaTeX for math.
      7. Be concise but extremely detailed (300-500 words).
      8. Tone: Sharp and encouraging academic mentor.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      return response.text || "Failed to generate explanation.";
    }, "Explain API");

    res.json({ explanation });
  } catch (error: any) {
    console.error("Explain API Error:", error);
    res.status(500).json({ error: "Our neural core is under high load. Please try again in a few moments." });
  }
});

app.post("/api/practice", async (req, res) => {
  if (!AI_ENABLED) {
    return res.status(503).json({ error: 'AI not configured. Set GEMINI_API_KEY to enable practice features.' });
  }
  const { topic, subject, learnerProfile } = req.body;
  
  try {
    const data = await generateAIContent(async (modelName) => {
      const prompt = buildPracticePrompt(topic, subject, learnerProfile);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt
      });
      
      let text = response.text || "{}";
      text = text.replace(/```json|```/g, "").trim();
      return JSON.parse(text);
    }, "Practice API");

    res.json(data);
  } catch (error: any) {
    if (error.status === 429 || error.message?.includes("429")) {
      res.status(429).json({ error: "Practice generator is currently under heavy load. Please try again in a few moments." });
    } else {
      console.error("Practice API Error (Gemini):", error);
      res.status(500).json({ error: "Failed to generate practice questions. Please check your connection." });
    }
  }
});

app.post("/api/explore", async (req, res) => {
  if (!AI_ENABLED) {
    return res.status(503).json({ error: 'AI not configured. Set GEMINI_API_KEY to enable explore features.' });
  }
  const { subject, learnerProfile } = req.body;

  try {
    const data = await generateAIContent(async (modelName) => {
      const prompt = buildExplorePrompt(subject, learnerProfile);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt
      });
      
      let text = response.text || "[]";
      text = text.replace(/```json|```/g, "").trim();
      return JSON.parse(text);
    }, "Explore API");

    res.json(data);
  } catch (error: any) {
    console.error("Explore API Error (Gemini):", error);
    res.status(500).json({ error: "The digital curriculum bridge is under stress. Please try again." });
  }
});

app.post("/api/greeting", async (req, res) => {
  if (!AI_ENABLED) {
    // Provide a harmless fallback greeting so the home UI still shows content when AI is disabled
    const { learnerProfile } = req.body;
    const fallback = `Welcome back${learnerProfile?.name ? ', ' + learnerProfile.name : ''}! Ready to continue your studies?`;
    return res.json({ greeting: fallback });
  }
  const { learnerProfile, lastTopic, hour } = req.body;
  
  try {
    const greeting = await generateAIContent(async (modelName) => {
      const prompt = buildGreetingPrompt(learnerProfile, lastTopic, hour);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt
      });
      return response.text || "Welcome back!";
    }, "Greeting API");

    res.json({ greeting });
  } catch (error: any) {
    res.json({ greeting: "Welcome back! Ready to continue your studies?" });
  }
});

app.post("/api/analyze-learner", async (req, res) => {
  if (!AI_ENABLED) {
    return res.status(503).json({ error: 'AI not configured. Set GEMINI_API_KEY to enable analysis features.' });
  }
  const { messages } = req.body;
  
  try {
    const analysis = await generateAIContent(async (modelName) => {
      const prompt = `Analyze the following chat messages from a student. 
      Study the manner of user comprehension through their typing, text construction, vocabulary, and ability to grasp concepts mentioned in the conversation.
      
      Messages:
      ${JSON.stringify(messages.filter((m: any) => m.role === 'user').slice(-5))}
      
      Return a JSON object with:
      1. comprehensionLevel (1-10, where 1 is absolute beginner and 10 is expert)
      2. learningStyle (a short description like "technical/direct", "story-driven", "example-heavy", etc.)
      3. complexityPreference ("simple", "standard", or "complex" - what level should the AI use to explain things?)
      4. vocabularyRange (e.g., "limited", "conversational", "academic", "erudite")
      
      Return ONLY valid JSON.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });

      return JSON.parse(response.text || "{}");
    }, "Analyzer API");

    res.json(analysis);
  } catch (error) {
    console.error("Analyzer Error:", error);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// Health and readiness endpoints for load balancers and orchestrators
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/ready', (_req, res) => {
  if (isShuttingDown) return res.status(503).json({ ready: false });
  res.status(200).json({ ready: true });
});

function buildTutorSystemPrompt(learner: any, subject?: string, lowBandwidth?: boolean) {
  const level = learner.comprehensionLevel || 5;
  const complexity = learner.complexityPreference || 'standard';
  const style = learner.learningStyle || 'balanced academic';

  let complexityInstruction = "";
  if (complexity === 'simple') {
    complexityInstruction = "CRITICAL: Simplify ALL concepts to a basic level. Use everyday analogies and avoid advanced vocabulary without immediate explanation. Speak to the user as if they are new to the topic.";
  } else if (complexity === 'complex') {
    complexityInstruction = "ENGAGE at a high academic level. Use precise terminology, deep theoretical frameworks, and assume the user has a strong foundation.";
  } else {
    complexityInstruction = "Maintain a standard high-school/undergraduate level of complexity. Balance technical detail with accessibility.";
  }

  return `You are BridgeMind 2.0 — a frontier-class AI academic tutor.
Identity:
- Role: An expert academic mentor for African scholars.
- Tone: Professional, clear, culturally grounded, and academic. Do NOT use overly technical jargon unless explaining it.
- Grounding: Rooted in the lived experiences of students in ${learner.country} and the ${learner.region} region. Use local examples (e.g., markets, agriculture, industry in ${learner.country}).

Subject Domain Mastery:
${subject ? `- Specialized Context: You are currently functioning as an expert in **${subject}**. Every explanation, analogy, and strategy should be tailored through the lens of ${subject}. Use domain-specific terminology correctly and emphasize deep conceptual understanding of ${subject}.` : "- Generalized Context: You are a broad-spectrum academic tutor covering multiple interconnected disciplines."}

Adaptive Intelligence Profile:
- Current User Comprehension Level: ${level}/10.
- Detected Learning Style: ${style}.
- ${complexityInstruction}

Teaching Strategy:
1. Academic Explanation: Provide well-structured, detailed explanations. Use standard text and bullet points primarily.
2. Code Blocks: ONLY use markdown code blocks for actual programming code or complex data structures if asked.
3. Mathematics: Use LaTeX for math. Inline: $E=mc^2$. Block: $$...$$.
4. Logic: Solve problems step-by-step. If a student is wrong, guide them to the logic flaw using the "Socratic Method".

Persona Rules:
- Language: Use ${learner.language}. Provide English terms in [brackets] for technical concepts.
- Curriculum: Adhere strictly to ${learner.curriculum} standards.
- Aesthetic: Your personality is "Obsidian Library"—calm, vast, and illuminating.
- Outcome: Every response must end with a challenging concept-check question prefixed with ⚡.

Bandwidth Restriction: ${lowBandwidth ? "CRITICAL: User is on a low-data connection. Limit response to 80 high-impact words." : "Standard depth (250-400 words)."}`;
}

function buildPracticePrompt(topic: string, subject: string, learner: any) {
  const level = learner.comprehensionLevel || 5;
  return `Generate exactly 5 adaptive practice questions for ${topic} in ${subject}.
Target: ${learner.curriculum} exam candidate in ${learner.country}.
Language: ${learner.language}.

Adaptive Difficulty: ${level}/10. Adjust question complexity to match this student's detected level.

Rules:
1. Ground the questions in African contexts (local names, products, geographical features).
2. Ensure at least 1 "Problem Solving" question that involves a local scenario.
3. Language MUST be ${learner.language}.

Return ONLY valid JSON in this format:
{
  "questions": [
    { "id": 1, "type": "mcq", "question": "...", "options": ["A...", "B...", "C...", "D..."], "correct": "A", "explanation": "..." },
    ...
  ]
}`;
}

function buildExplorePrompt(subject: string, learner: any) {
  return `Generate a comprehensive curriculum map for ${subject} under the ${learner.curriculum} board.
Language: ${learner.language}.
Output exactly 8 modules with 5 key lessons each.

Return ONLY valid JSON array of objects with "topic" and "subtopics" keys.
Example: [ { "topic": "...", "subtopics": ["...", "...", "..."] } ]`;
}

function buildGreetingPrompt(learner: any, lastTopic: any, hour: any) {
  const time = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Write a 2-sentence warm greeting in ${learner.language} for the ${time}.
Location: ${learner.country}.
Curriculum: ${learner.curriculum}.
Previous Work: ${lastTopic || "initial setup"}.
Sound like a supportive mentor who understands the resilience of students in ${learner.region}. Keep it brief.`;
}

// Catch-all for API routes that don't exist
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.url} not found.` });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('Received shutdown signal — closing server...');
    server.close(() => {
      console.log('Server closed. Exiting.');
      process.exit(0);
    });
    // Force exit if shutdown takes too long
    setTimeout(() => {
      console.error('Forcing shutdown after timeout.');
      process.exit(1);
    }, 30000);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
