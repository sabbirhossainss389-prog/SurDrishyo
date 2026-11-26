import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

const isServerless = Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
export const UPLOADS_DIR = isServerless
  ? path.join(os.tmpdir(), 'surdrishyo-uploads')
  : path.resolve(process.cwd(), 'uploads');

try {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch {
  // Ignore if filesystem is read-only until upload is attempted
}

// Read Firebase Web API key from firebase-applet-config.json for token verification
let firebaseApiKey = '';
try {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as { apiKey?: string };
    firebaseApiKey = cfg.apiKey || '';
  }
} catch {
  firebaseApiKey = '';
}

interface VerifiedUser {
  uid: string;
  emailVerified: boolean;
}

async function verifyFirebaseIdToken(authHeader: string | undefined): Promise<VerifiedUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ') || !firebaseApiKey) {
    return null;
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken || idToken.length > 4096) {
    return null;
  }
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      users?: Array<{ localId?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user?.localId) return null;
    return { uid: user.localId, emailVerified: Boolean(user.emailVerified) };
  } catch {
    return null;
  }
}

// Simple in-memory sliding-window rate limiter to protect API quotas
interface RateBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, RateBucket>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : '') ||
      req.ip ||
      'unknown';
    const now = Date.now();
    const existing = buckets.get(ip);

    if (!existing || now > existing.resetAt) {
      if (buckets.size > 2000) {
        buckets.clear();
      }
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      const retrySec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      res.status(429).json({
        error: 'অতিরিক্ত অনুরোধ পাঠানো হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
      });
      return;
    }

    existing.count += 1;
    next();
  };
}

const searchRateLimiter = createRateLimiter(60, 60_000);
const uploadRateLimiter = createRateLimiter(15, 60_000);

const ALLOWED_MEDIA_EXTS = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.flac',
]);
const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    } catch {
      // Handled by multer if write fails
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (file.fieldname === 'thumbnail') {
      if (!ALLOWED_IMAGE_EXTS.has(ext)) {
        cb(new Error('Unsupported thumbnail format. Use JPG, PNG, or WEBP.'));
        return;
      }
      cb(null, true);
      return;
    }
    if (!ALLOWED_MEDIA_EXTS.has(ext)) {
      cb(new Error('Unsupported media format.'));
      return;
    }
    cb(null, true);
  },
});

function parseDurationToSeconds(label: string): number {
  const parts = label
    .trim()
    .split(':')
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function parseIsoDurationToSeconds(iso: string): { seconds: number; label: string } {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { seconds: 0, label: '0:00' };
  const h = Number.parseInt(match[1] || '0', 10);
  const m = Number.parseInt(match[2] || '0', 10);
  const s = Number.parseInt(match[3] || '0', 10);
  const seconds = h * 3600 + m * 60 + s;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return { seconds, label };
}

function parseViewsText(text: string): number {
  const cleaned = text.replace(/,/g, '').toLowerCase();
  const numMatch = cleaned.match(/([\d.]+)\s*(k|m|b|হা|লা|কো)?/);
  if (!numMatch) return 0;
  const val = Number.parseFloat(numMatch[1]);
  if (Number.isNaN(val)) return 0;
  const unit = numMatch[2];
  if (unit === 'k' || unit === 'হা') return Math.round(val * 1_000);
  if (unit === 'লা') return Math.round(val * 100_000);
  if (unit === 'm') return Math.round(val * 1_000_000);
  if (unit === 'কো') return Math.round(val * 10_000_000);
  if (unit === 'b') return Math.round(val * 1_000_000_000);
  return Math.round(val);
}

export interface YouTubeSearchItem {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId: string;
  thumbnailUrl: string;
  durationLabel: string;
  durationSeconds: number;
  viewsLabel: string;
  viewsCount: number;
  publishedText: string;
}

function extractYtInitialData(html: string): unknown | null {
  const regexes = [
    /var ytInitialData = (\{.*?\});<\/script>/s,
    /window\["ytInitialData"\] = (\{.*?\});<\/script>/s,
  ];
  for (const rx of regexes) {
    const m = html.match(rx);
    if (m?.[1]) {
      try {
        return JSON.parse(m[1]);
      } catch {
        // Fall through to bracket walker
      }
    }
  }

  const markers = ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = '];
  for (const marker of markers) {
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) continue;
    const jsonStart = html.indexOf('{', startIdx + marker.length);
    if (jsonStart === -1) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = jsonStart; i < html.length; i++) {
      const ch = html[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
      } else {
        if (ch === '"') {
          inString = true;
        } else if (ch === '{') {
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0) {
            const rawJson = html.slice(jsonStart, i + 1);
            try {
              return JSON.parse(rawJson);
            } catch {
              return null;
            }
          }
        }
      }
    }
  }
  return null;
}

function collectVideoRenderers(node: unknown, out: Record<string, unknown>[], limit = 30): void {
  if (!node || typeof node !== 'object' || out.length >= limit) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectVideoRenderers(item, out, limit);
      if (out.length >= limit) return;
    }
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.videoRenderer && typeof obj.videoRenderer === 'object') {
    out.push(obj.videoRenderer as Record<string, unknown>);
    if (out.length >= limit) return;
  }
  for (const key of Object.keys(obj)) {
    collectVideoRenderers(obj[key], out, limit);
    if (out.length >= limit) return;
  }
}

// Short-lived YouTube search cache (2 minutes) to protect quota and speed up repeat queries
const ytSearchCache = new Map<string, { expiresAt: number; items: YouTubeSearchItem[] }>();

async function searchYouTubeLive(
  query: string,
  durationFilter: string,
  sortFilter: string
): Promise<YouTubeSearchItem[]> {
  const cacheKey = `${query.toLowerCase()}::${durationFilter}::${sortFilter}`;
  const cached = ytSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();

  // Path A: Official YouTube Data API v3 when YOUTUBE_API_KEY is configured
  if (apiKey) {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: '18',
      q: query,
      key: apiKey,
    });
    if (durationFilter === 'short' || durationFilter === 'medium' || durationFilter === 'long') {
      params.set('videoDuration', durationFilter);
    }
    if (sortFilter === 'viewCount' || sortFilter === 'date') {
      params.set('order', sortFilter);
    }
    const searchResp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (searchResp.ok) {
      const searchJson = (await searchResp.json()) as {
        items?: Array<{
          id?: { videoId?: string };
          snippet?: {
            title?: string;
            channelTitle?: string;
            channelId?: string;
            publishedAt?: string;
            thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
          };
        }>;
      };
      const ids = (searchJson.items || [])
        .map((it) => it.id?.videoId)
        .filter((id): id is string => Boolean(id));

      const statsMap = new Map<
        string,
        { durationSeconds: number; durationLabel: string; viewsCount: number; viewsLabel: string }
      >();

      if (ids.length > 0) {
        const statsResp = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${encodeURIComponent(
            ids.join(',')
          )}&key=${encodeURIComponent(apiKey)}`
        );
        if (statsResp.ok) {
          const statsJson = (await statsResp.json()) as {
            items?: Array<{
              id?: string;
              contentDetails?: { duration?: string };
              statistics?: { viewCount?: string };
            }>;
          };
          for (const v of statsJson.items || []) {
            if (!v.id) continue;
            const dur = parseIsoDurationToSeconds(v.contentDetails?.duration || '');
            const viewsCount = Number.parseInt(v.statistics?.viewCount || '0', 10) || 0;
            statsMap.set(v.id, {
              durationSeconds: dur.seconds,
              durationLabel: dur.label,
              viewsCount,
              viewsLabel: viewsCount > 0 ? `${viewsCount.toLocaleString()} views` : 'YouTube',
            });
          }
        }
      }

      const apiItems = (searchJson.items || [])
        .filter((it) => Boolean(it.id?.videoId))
        .map((it) => {
          const videoId = it.id!.videoId!;
          const st = statsMap.get(videoId);
          return {
            videoId,
            title: it.snippet?.title || 'YouTube Video',
            channelTitle: it.snippet?.channelTitle || 'YouTube Channel',
            channelId: it.snippet?.channelId || `yt_${videoId}`,
            thumbnailUrl:
              it.snippet?.thumbnails?.high?.url ||
              it.snippet?.thumbnails?.medium?.url ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            durationLabel: st?.durationLabel || 'HD',
            durationSeconds: st?.durationSeconds || 240,
            viewsLabel: st?.viewsLabel || 'YouTube',
            viewsCount: st?.viewsCount || 0,
            publishedText: it.snippet?.publishedAt ? it.snippet.publishedAt.slice(0, 10) : 'YouTube',
          };
        });

      if (ytSearchCache.size > 100) ytSearchCache.clear();
      ytSearchCache.set(cacheKey, { expiresAt: Date.now() + 120_000, items: apiItems });
      return apiItems;
    }
  }

  // Path B: Direct live YouTube search parsing (zero-config fallback)
  const ytUrl = new URL('https://www.youtube.com/results');
  ytUrl.searchParams.set('search_query', query);
  if (sortFilter === 'viewCount') {
    ytUrl.searchParams.set('sp', 'CAM%3D');
  } else if (sortFilter === 'date') {
    ytUrl.searchParams.set('sp', 'CAI%3D');
  }

  const resp = await fetch(ytUrl.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  if (!resp.ok) {
    throw new Error(`YouTube search responded with status ${resp.status}`);
  }

  const html = await resp.text();
  const initialData = extractYtInitialData(html);
  if (!initialData) {
    return [];
  }

  const renderers: Record<string, unknown>[] = [];
  collectVideoRenderers(initialData, renderers, 32);

  const seen = new Set<string>();
  const results: YouTubeSearchItem[] = [];

  for (const r of renderers) {
    const videoId = typeof r.videoId === 'string' ? r.videoId : '';
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);

    const titleObj = r.title as { runs?: Array<{ text?: string }>; simpleText?: string } | undefined;
    const title =
      titleObj?.runs?.map((x) => x.text || '').join('') || titleObj?.simpleText || 'Untitled Video';

    const ownerObj = r.ownerText as {
      runs?: Array<{ text?: string; navigationEndpoint?: { browseEndpoint?: { browseId?: string } } }>;
    } | undefined;
    const channelTitle = ownerObj?.runs?.[0]?.text || 'YouTube Creator';
    const channelId =
      ownerObj?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || `yt_ch_${videoId}`;

    const lengthObj = r.lengthText as { simpleText?: string } | undefined;
    const durationLabel = lengthObj?.simpleText || 'LIVE';
    const durationSeconds = parseDurationToSeconds(durationLabel);

    const viewsObj = r.shortViewCountText as { simpleText?: string; runs?: Array<{ text?: string }> } | undefined;
    const viewsLabel =
      viewsObj?.simpleText || viewsObj?.runs?.map((x) => x.text || '').join('') || 'YouTube';
    const viewsCount = parseViewsText(viewsLabel);

    const publishedObj = r.publishedTimeText as { simpleText?: string } | undefined;
    const publishedText = publishedObj?.simpleText || 'YouTube';

    results.push({
      videoId,
      title,
      channelTitle,
      channelId,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      durationLabel,
      durationSeconds,
      viewsLabel,
      viewsCount,
      publishedText,
    });
  }

  const filtered = results
    .filter((item) => {
      if (durationFilter === 'short') return item.durationSeconds > 0 && item.durationSeconds < 240;
      if (durationFilter === 'medium')
        return item.durationSeconds >= 240 && item.durationSeconds <= 1200;
      if (durationFilter === 'long') return item.durationSeconds > 1200;
      return true;
    })
    .slice(0, 20);

  if (sortFilter === 'viewCount') {
    filtered.sort((a, b) => b.viewsCount - a.viewsCount);
  }

  if (filtered.length > 0) {
    if (ytSearchCache.size > 100) ytSearchCache.clear();
    ytSearchCache.set(cacheKey, { expiresAt: Date.now() + 120_000, items: filtered });
  }
  return filtered;
}

interface SynthTrackConfig {
  id: string;
  durationSec: number;
  rootHz: number;
  scaleRatios: number[];
  tempoBpm: number;
  warmth: number;
  fileName: string;
}

const BUILTIN_SYNTH_TRACKS: Record<string, SynthTrackConfig> = {
  ghazal_chandni_raat: {
    id: 'ghazal_chandni_raat',
    durationSec: 42,
    rootHz: 146.83,
    scaleRatios: [1, 1.125, 1.25, 1.406, 1.5, 1.667, 1.875, 2],
    tempoBpm: 68,
    warmth: 0.72,
    fileName: 'chandni-raat-ghazal.wav',
  },
  bengali_megh_bristi: {
    id: 'bengali_megh_bristi',
    durationSec: 38,
    rootHz: 164.81,
    scaleRatios: [1, 1.125, 1.2, 1.333, 1.5, 1.667, 1.8, 2],
    tempoBpm: 76,
    warmth: 0.65,
    fileName: 'megh-bristi-ektara.wav',
  },
  sufi_rooh_e_ishq: {
    id: 'sufi_rooh_e_ishq',
    durationSec: 45,
    rootHz: 130.81,
    scaleRatios: [1, 1.067, 1.2, 1.333, 1.5, 1.6, 1.8, 2],
    tempoBpm: 64,
    warmth: 0.8,
    fileName: 'rooh-e-ishq-sufi.wav',
  },
  nasheed_subah_bakhair: {
    id: 'nasheed_subah_bakhair',
    durationSec: 36,
    rootHz: 174.61,
    scaleRatios: [1, 1.125, 1.25, 1.5, 1.667, 2],
    tempoBpm: 72,
    warmth: 0.75,
    fileName: 'subah-bakhair-nasheed.wav',
  },
};

const synthCache = new Map<string, Buffer>();

function generateWavBuffer(cfg: SynthTrackConfig): Buffer {
  const cached = synthCache.get(cfg.id);
  if (cached) return cached;

  const sampleRate = 22050;
  const numSamples = Math.floor(cfg.durationSec * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const beatSec = 60 / cfg.tempoBpm;
  const motif = [0, 2, 4, 3, 5, 4, 2, 1, 0, 4, 6, 7, 5, 4, 2, 0];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fadeIn = Math.min(1, t / 1.5);
    const fadeOut = Math.min(1, (cfg.durationSec - t) / 2.2);
    const masterEnv = fadeIn * fadeOut;

    const drone =
      0.24 * Math.sin(2 * Math.PI * cfg.rootHz * t) +
      0.14 * Math.sin(2 * Math.PI * cfg.rootHz * 1.5 * t + 0.4) +
      0.08 * Math.sin(2 * Math.PI * cfg.rootHz * 2 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.25 * t));

    const beatIndex = Math.floor(t / beatSec);
    const beatPos = (t % beatSec) / beatSec;
    const degree = motif[beatIndex % motif.length];
    const ratio = cfg.scaleRatios[degree % cfg.scaleRatios.length];
    const noteHz = cfg.rootHz * 2 * ratio;

    const pluckEnv = Math.min(1, beatPos * 25) * Math.exp(-3.4 * beatPos);
    const pluck =
      0.34 *
      pluckEnv *
      (Math.sin(2 * Math.PI * noteHz * t) +
        0.42 * cfg.warmth * Math.sin(2 * Math.PI * noteHz * 2 * t) +
        0.18 * Math.sin(2 * Math.PI * noteHz * 3 * t));

    const phrasePos = (t % (beatSec * 4)) / (beatSec * 4);
    const fluteEnv = Math.sin(Math.PI * phrasePos);
    const fluteHz = cfg.rootHz * 4 * cfg.scaleRatios[motif[(beatIndex + 2) % motif.length] % cfg.scaleRatios.length];
    const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 5.2 * t);
    const flute = 0.1 * fluteEnv * Math.sin(2 * Math.PI * fluteHz * vibrato * t);

    const sample = Math.max(-0.95, Math.min(0.95, (drone + pluck + flute) * masterEnv));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  synthCache.set(cfg.id, buffer);
  return buffer;
}

function sendBufferWithRange(req: Request, res: Response, buf: Buffer, mimeType: string, downloadName?: string): void {
  const total = buf.length;
  if (downloadName) {
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  }
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType);

  const range = req.headers.range;
  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = Number.parseInt(match[1], 10);
      const end = match[2] ? Math.min(Number.parseInt(match[2], 10), total - 1) : total - 1;
      if (start >= total || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        return;
      }
      const chunk = buf.subarray(start, end + 1);
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', chunk.length);
      res.end(chunk);
      return;
    }
  }
  res.status(200);
  res.setHeader('Content-Length', total);
  res.end(buf);
}

function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    case '.m4a':
    case '.aac':
      return 'audio/mp4';
    case '.flac':
      return 'audio/flac';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export function createApiApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  // Baseline security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      youtubeApiConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
      googleSearchConfigured: Boolean(
        process.env.GOOGLE_SEARCH_API_KEY?.trim() && process.env.GOOGLE_SEARCH_CX?.trim()
      ),
    });
  });

  // Live YouTube Search API (with rate limiting & server-side key isolation)
  app.get('/api/youtube/search', searchRateLimiter, async (req, res) => {
    try {
      const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
      const duration = typeof req.query.duration === 'string' ? req.query.duration.trim() : 'any';
      const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'relevance';

      const baseQuery = rawQ || category || 'Bangla Ghazal Nasheed Acoustic Music Documentary';
      const query = baseQuery.slice(0, 140);
      const items = await searchYouTubeLive(query, duration, sort);
      res.json({ items, query });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to query YouTube';
      res.status(502).json({ error: message, items: [] });
    }
  });

  // Personalized YouTube Recommendations based on preferred categories
  app.get('/api/youtube/feed', searchRateLimiter, async (req, res) => {
    try {
      const rawCats = typeof req.query.categories === 'string' ? req.query.categories.trim() : '';
      const query = rawCats
        ? `${rawCats.split(',').slice(0, 2).join(' ')} bangla video`
        : 'Bangla Ghazal Song Tech Documentary';
      const items = await searchYouTubeLive(query, 'any', 'relevance');
      res.json({ items });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load YouTube feed';
      res.status(502).json({ error: message, items: [] });
    }
  });

  // Optional Server-Side Google Custom Search API proxy (never exposes key to frontend)
  app.get('/api/search/google', searchRateLimiter, async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 140) : '';
      if (!q) {
        res.status(400).json({ error: 'Search query is required', items: [] });
        return;
      }

      const cseKey = process.env.GOOGLE_SEARCH_API_KEY?.trim();
      const cseCx = process.env.GOOGLE_SEARCH_CX?.trim();
      if (cseKey && cseCx) {
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        url.searchParams.set('key', cseKey);
        url.searchParams.set('cx', cseCx);
        url.searchParams.set('q', q);
        url.searchParams.set('num', '10');
        const cseResp = await fetch(url.toString());
        if (!cseResp.ok) {
          res.status(502).json({ error: `Google Search API error (${cseResp.status})`, items: [] });
          return;
        }
        const cseJson = (await cseResp.json()) as {
          items?: Array<{ title?: string; link?: string; snippet?: string; displayLink?: string }>;
        };
        res.json({
          source: 'google_custom_search',
          items: (cseJson.items || []).map((it) => ({
            title: it.title || '',
            link: it.link || '',
            snippet: it.snippet || '',
            displayLink: it.displayLink || '',
          })),
        });
        return;
      }

      // Fallback: return YouTube live results if Google Custom Search key is not configured
      const ytItems = await searchYouTubeLive(q, 'any', 'relevance');
      res.json({
        source: 'youtube_fallback',
        items: ytItems.map((it) => ({
          title: it.title,
          link: `https://www.youtube.com/watch?v=${it.videoId}`,
          snippet: `${it.channelTitle} · ${it.viewsLabel}`,
          displayLink: 'youtube.com',
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google search failed';
      res.status(502).json({ error: message, items: [] });
    }
  });

  // Built-in playable & downloadable Audio Songs / Ghazals
  app.get('/api/audio/track/:trackId', (req, res) => {
    const cfg = BUILTIN_SYNTH_TRACKS[req.params.trackId];
    if (!cfg) {
      res.status(404).json({ error: 'Audio track not found' });
      return;
    }
    const wavBuf = generateWavBuffer(cfg);
    const isDownload = req.query.download === '1';
    sendBufferWithRange(req, res, wavBuf, 'audio/wav', isDownload ? cfg.fileName : undefined);
  });

  // Authenticated Media & Thumbnail Upload Endpoint
  app.post(
    '/api/media/upload',
    uploadRateLimiter,
    async (req, res, next) => {
      const user = await verifyFirebaseIdToken(req.headers.authorization);
      if (!user || !user.emailVerified) {
        res.status(401).json({ error: 'Please sign in with a verified Google account to upload media.' });
        return;
      }
      next();
    },
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ]),
    (req, res) => {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const mediaFile = files?.file?.[0];
      const thumbFile = files?.thumbnail?.[0];
      if (!mediaFile) {
        res.status(400).json({ error: 'No media file received.' });
        return;
      }
      res.json({
        mediaUrl: `/api/uploads/${encodeURIComponent(mediaFile.filename)}`,
        thumbnailUrl: thumbFile ? `/api/uploads/${encodeURIComponent(thumbFile.filename)}` : '',
        sizeBytes: mediaFile.size,
      });
    }
  );

  // Safe Byte-Range Streaming & Download for Uploaded Files
  app.get('/api/uploads/:filename', (req, res) => {
    const safeBasename = path.basename(req.params.filename || '');
    if (!safeBasename || !/^[a-zA-Z0-9_.\-]+$/.test(safeBasename)) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }
    const resolvedPath = path.resolve(UPLOADS_DIR, safeBasename);
    if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const stat = fs.statSync(resolvedPath);
    const total = stat.size;
    const ext = path.extname(safeBasename);
    const mimeType = getMimeType(ext);

    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${safeBasename}"`);
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mimeType);

    const range = req.headers.range;
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = Number.parseInt(match[1], 10);
        const end = match[2] ? Math.min(Number.parseInt(match[2], 10), total - 1) : total - 1;
        if (start >= total || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
          return;
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', end - start + 1);
        fs.createReadStream(resolvedPath, { start, end }).pipe(res);
        return;
      }
    }

    res.status(200);
    res.setHeader('Content-Length', total);
    fs.createReadStream(resolvedPath).pipe(res);
  });

  // Centralized API Error Handler (never leaks internal stack traces)
  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: `আপলোড ত্রুটি: ${err.message}` });
      return;
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  });

  return app;
}
