# BridgeMind 2.0

BridgeMind is an AI-powered learning equalizer designed for African students. It provides personalized tutoring, adaptive practice assessments, and a comprehensive knowledge library tailored to various African curricula.

## Features

- **Personalized AI Tutor**: Chat with an AI that understands your local curriculum and context.

- **Adaptive Practice**: Generate challenges based on specific topics and subjects.

## Local development

This app uses an Express backend for `/api/tutor` routing. Run locally with:

```bash
npm install
npm run dev
```

The backend serves the tutor API and the frontend is served by Vite in development.

To run the simplified Express backend directly (CommonJS):

```bash
# Ensure GEMINI_API_KEY is set in your environment or in a .env file
export GEMINI_API_KEY="your_key_here"
npm run start:express
```

Notes:
- `npm run dev` uses `server.ts` via `tsx` for a TypeScript dev server (hot reload).
- `npm run start:express` runs the standalone `express-backend.cjs` (useful for simple local testing).

Auth (Google Sign-In)
----------------------
This backend verifies Google ID tokens issued by the Google Identity Services on the frontend.

1. Create a Google OAuth Client ID in Google Cloud Console and set it in your environment:

```bash
export GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
```

2. On the frontend, obtain an `id_token` using Google Identity Services (GSI) and send it to the backend as an Authorization header:

```
Authorization: Bearer <ID_TOKEN>
```

3. The backend exposes `POST /auth/verify` to validate an `id_token` (in body `id_token` or Authorization header) and `POST /api/tutor` is now protected — include the `Authorization` header with the ID token when calling the tutor API.

Example curl to verify token:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"id_token":"<ID_TOKEN>"}' http://localhost:3000/auth/verify
```

- **Knowledge HUB**: Explore a wide range of subjects including Mathematics, English, Sciences (Biology, Chemistry, Physics), and Social Sciences.
- **Offline First**: Built with Progressive Web App (PWA) technology for seamless access even without a stable internet connection.
- **Multilingual Support**: Learn in your preferred language (Hausa, Swahili, English, etc.).
- **Dark Obsidian Aesthetic**: A focused "blueblack" design optimized for deep study sessions.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Motion.
- **State Management**: Zustand (with IndexedDB persistence).
- **AI**: Google Gemini API (2.0 Flash).
- **Backend**: Express (Server-side AI proxy).
- **Database**: IndexedDB (via `idb`).

## PWA (Progressive Web App)

BridgeMind is fully installable as a PWA. To install:
1. Open the app in your browser.
2. Look for the "Install BridgeMind" prompt.
3. Once installed, it will appear in your app drawer and work with offline caching.

## Developer Instructions

- **Environment Variables**: Requires `GEMINI_API_KEY` in your `.env` file.
- **Build**: `npm run build`
- **Dev**: `npm run dev`

---
*Bridging the gap between potential and excellence.*
