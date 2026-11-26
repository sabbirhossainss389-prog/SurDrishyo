export type MediaType = 'video' | 'audio';
export type SourceType = 'upload' | 'youtube' | 'builtin';
export type AppSection = 'discover' | 'for-you' | 'audio' | 'offline' | 'subscriptions';

export interface MediaItem {
  id: string;
  title: string;
  description?: string;
  mediaType: MediaType;
  sourceType: 'upload' | 'youtube';
  mediaUrl: string;
  thumbnailUrl?: string;
  category: string;
  artistOrChannel: string;
  durationSeconds: number;
  durationLabel: string;
  tags?: string[];
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface YouTubeVideoItem {
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

export interface AudioTrackItem {
  id: string;
  title: string;
  artist: string;
  category: string;
  durationSeconds: number;
  durationLabel: string;
  audioUrl: string;
  downloadUrl: string;
  coverUrl: string;
  description: string;
  sourceType: 'builtin' | 'upload';
  authorId?: string;
  likesCount?: number;
}

export interface OfflineAudioRecord {
  id: string;
  title: string;
  artist: string;
  category: string;
  durationLabel: string;
  durationSeconds: number;
  coverUrl: string;
  mimeType: string;
  sizeBytes: number;
  savedAt: number;
  blob: Blob;
}

export interface CommentItem {
  id: string;
  targetId: string;
  targetType: 'media' | 'youtube';
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
  createdAt?: { seconds?: number; toDate?: () => Date } | null;
}

export interface SubscriptionItem {
  id: string;
  userId: string;
  channelId: string;
  channelName: string;
  channelPhoto?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  preferredCategories: string[];
  recentSearches?: string[];
}

export interface SearchFilters {
  query: string;
  source: 'all' | 'youtube' | 'upload';
  category: string;
  duration: 'any' | 'short' | 'medium' | 'long';
  sort: 'relevance' | 'viewCount' | 'date';
}

export type ActiveVideoSelection =
  | {
      kind: 'youtube';
      video: YouTubeVideoItem;
      categoryHint?: string;
    }
  | {
      kind: 'upload';
      media: MediaItem;
    };

export const MEDIA_CATEGORIES = [
  { id: 'all', label: 'সব ক্যাটাগরি', ytQuery: 'Bangla Video Music Ghazal Tech' },
  { id: 'গজল ও নাশিদ', label: 'গজল ও নাশিদ', ytQuery: 'Bangla Ghazal Islamic Nasheed' },
  { id: 'বাংলা গান', label: 'বাংলা গান', ytQuery: 'Bangla Acoustic Song Folk' },
  { id: 'প্রযুক্তি', label: 'প্রযুক্তি ও টিউটোরিয়াল', ytQuery: 'Tech Review Programming Bangla' },
  { id: 'ইসলামিক', label: 'ইসলামিক আলোচনা', ytQuery: 'Islamic Lecture Tafsir Bangla' },
  { id: 'শিক্ষা', label: 'শিক্ষা ও ডকুমেন্টারি', ytQuery: 'Documentary Science Education Bangla' },
  { id: 'ভ্লগ ও ভ্রমণ', label: 'ভ্লগ ও ভ্রমণ', ytQuery: 'Bangladesh Travel Vlog Cinematic' },
] as const;
