# SurDrishyo — Video & Audio Streaming Platform

A full-stack video and audio streaming platform built with React 19, Vite, TypeScript, Tailwind CSS v4, Express, Firebase (Auth + Firestore), live YouTube search & official embed playback, and PWA offline audio caching.

## Features

- **Video Streaming & Community Uploads**: Upload and stream local video/audio files with HTTP byte-range seeking (`206 Partial Content`) and Firestore metadata sync.
- **Live YouTube Search & Official Embeds**: Real-time YouTube search powered by YouTube Data API v3 (server-side) with automatic fallback, duration/sort filtering, and policy-compliant YouTube iframe playback.
- **Google Sign-In & Social Engagement**: Verified Google authentication via Firebase Auth, real-time Firestore comments, atomic likes, channel subscriptions, and customized feeds.
- **Audio & Ghazal Studio with Offline Playback**: Stream curated or uploaded audio, download directly to your device, or save tracks into browser IndexedDB + PWA Cache Storage for offline listening.
- **Installable PWA**: Install directly on Android, iOS, and Desktop browsers with offline connectivity detection.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, `vite-plugin-pwa`
- **Backend**: Node.js 22+, Express 4, Multer (authenticated multipart uploads)
- **Database & Auth**: Firebase Authentication (Google) & Cloud Firestore (`firestore.rules`)
- **Hosting Targets**: Vercel (`vercel.json` + `/api/index.ts`), Netlify (`netlify.toml` + `/netlify/functions/api.ts`), Render (`render.yaml`), Docker (`Dockerfile`)

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` and fill in your server-side keys (never commit `.env`):
   ```bash
   cp .env.example .env
   ```

3. **Run development server** (Express + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```

4. **Typecheck & production build**:
   ```bash
   npm run lint
   npm run build
   ```

## Environment Variables (Server-Side Only)

Configure these in your hosting dashboard (**never** prefix private keys with `VITE_`):

| Variable | Required | Description |
| :--- | :--- | :--- |
| `YOUTUBE_API_KEY` | Recommended | YouTube Data API v3 key (server-side). Restrict in Google Cloud Console to YouTube Data API v3. |
| `GOOGLE_SEARCH_API_KEY` | Optional | Google Custom Search JSON API key (server-side). |
| `GOOGLE_SEARCH_CX` | Optional | Programmable Search Engine ID (`cx`) for Google Custom Search. |
| `GEMINI_API_KEY` | Optional | Gemini API key (server-side). |
| `APP_URL` | Optional | Public URL of your deployed site. |
| `NODE_ENV` | Production | Set to `production` when running `npm start`. |

## Deployment

### 1. Vercel
- **Framework Preset**: Vite (or Other; `vercel.json` is pre-configured)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **API Routes**: Automatically routed via `vercel.json` -> `/api/index.ts`

### 2. Netlify
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Functions Directory**: `netlify/functions` (configured automatically in `netlify.toml`)

### 3. Render / Railway / Cloud Run
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### Post-Deploy Step (Mandatory for Google Sign-In)
After deploying to Vercel, Netlify, or Render, add your live domain (for example `your-app.vercel.app` or `your-app.netlify.app`) in:
**Firebase Console → Authentication → Settings → Authorized domains**
