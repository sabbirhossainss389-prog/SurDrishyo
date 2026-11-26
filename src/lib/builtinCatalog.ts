import type { AudioTrackItem } from '../types/media';

export const HERO_STUDIO_IMAGE = '/src/assets/images/hero_cinema_studio_1795656272035.jpg';

export const BUILTIN_AUDIO_TRACKS: AudioTrackItem[] = [
  {
    id: 'ghazal_chandni_raat',
    title: 'চাঁদনী রাতের গজল (Chandni Raat)',
    artist: 'উস্তাদ আরিফ হাসান',
    category: 'গজল ও নাশিদ',
    durationSeconds: 42,
    durationLabel: '0:42',
    audioUrl: '/api/audio/track/ghazal_chandni_raat',
    downloadUrl: '/api/audio/track/ghazal_chandni_raat?download=1',
    coverUrl: '/src/assets/images/cover_ghazal_moonlight_1795656271885.jpg',
    description: 'রাগ ইয়ামন-ভিত্তিক প্রশান্তিদায়ক সন্ধ্যার গজল ও সেতার সুর। অফলাইনে শোনার ও ডাউনলোডের জন্য প্রস্তুত।',
    sourceType: 'builtin',
  },
  {
    id: 'bengali_megh_bristi',
    title: 'মেঘ ও বৃষ্টির একতারা',
    artist: 'সুরমঞ্জরি ফোক কালেক্টিভ',
    category: 'বাংলা গান',
    durationSeconds: 38,
    durationLabel: '0:38',
    audioUrl: '/api/audio/track/bengali_megh_bristi',
    downloadUrl: '/api/audio/track/bengali_megh_bristi?download=1',
    coverUrl: '/src/assets/images/cover_bengali_folk_1795656272768.jpg',
    description: 'বাংলার বর্ষা ও ভাটিয়ালি লোকসুরের আধুনিক অ্যাকুস্টিক পরিবেশনা।',
    sourceType: 'builtin',
  },
  {
    id: 'sufi_rooh_e_ishq',
    title: 'রুহ-এ-ইশক (সুফি ইনস্ট্রুমেন্টাল গজল)',
    artist: 'মেহফিল-এ-সুর',
    category: 'গজল ও নাশিদ',
    durationSeconds: 45,
    durationLabel: '0:45',
    audioUrl: '/api/audio/track/sufi_rooh_e_ishq',
    downloadUrl: '/api/audio/track/sufi_rooh_e_ishq?download=1',
    coverUrl: '/src/assets/images/cover_acoustic_sitar_1795656273097.jpg',
    description: 'গভীর রাতের ধ্যান ও সুফি মেহফিলের জন্য ক্লাসিক্যাল ভৈরবী সুর।',
    sourceType: 'builtin',
  },
  {
    id: 'nasheed_subah_bakhair',
    title: 'সুবহ বখায়ের — ভোরের নাশিদ',
    artist: 'কাফেলা অডিও স্টুডিও',
    category: 'গজল ও নাশিদ',
    durationSeconds: 36,
    durationLabel: '0:36',
    audioUrl: '/api/audio/track/nasheed_subah_bakhair',
    downloadUrl: '/api/audio/track/nasheed_subah_bakhair?download=1',
    coverUrl: '/src/assets/images/cover_ghazal_moonlight_1795656271885.jpg',
    description: 'ভোরের প্রশান্ত মেলোডি ও অ্যাম্বিয়েন্ট নাশিদ সুর।',
    sourceType: 'builtin',
  },
];

export function isSafeMediaUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('/api/') || url.startsWith('/src/')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function sanitizeIdSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
}
