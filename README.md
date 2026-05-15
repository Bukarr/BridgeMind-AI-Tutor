# BridgeMind 2.0

BridgeMind is an AI-powered learning equalizer designed for African students. It provides personalized tutoring, adaptive practice assessments, and a comprehensive knowledge library tailored to various African curricula.

## Features

- **Personalized AI Tutor**: Chat with an AI that understands your local curriculum and context.
- **Adaptive Practice**: Generate challenges based on specific topics and subjects.
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
