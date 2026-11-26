import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Headphones, Play, Sparkles, Upload, UserCheck } from 'lucide-react';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { AudioStudioSection } from './components/AudioStudioSection';
import { FeedPreferencesModal } from './components/FeedPreferencesModal';
import { MediaThumbnail } from './components/MediaThumbnail';
import { OfflineBanner } from './components/OfflineBanner';
import { OfflineLibrarySection } from './components/OfflineLibrarySection';
import { SearchFilterBar } from './components/SearchFilterBar';
import { TopBar } from './components/TopBar';
import { UploadModal } from './components/UploadModal';
import { VideoCard } from './components/VideoCard';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { BUILTIN_AUDIO_TRACKS, HERO_STUDIO_IMAGE } from './lib/builtinCatalog';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutGoogle,
  testFirestoreConnection,
} from './lib/firebase';
import {
  downloadAudioToDevice,
  getAllOfflineAudio,
  getOfflineAudioRecord,
  removeOfflineAudio,
  saveAudioOffline,
} from './lib/offlineAudio';
import {
  MEDIA_CATEGORIES,
  type ActiveVideoSelection,
  type AppSection,
  type AudioTrackItem,
  type MediaItem,
  type OfflineAudioRecord,
  type SearchFilters,
  type SubscriptionItem,
  type YouTubeVideoItem,
} from './types/media';

const DEFAULT_PREFERENCES = ['গজল ও নাশিদ', 'বাংলা গান', 'প্রযুক্তি'];

export default function App() {
  const isOnline = useOnlineStatus();

  // Auth & User Preferences
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [preferredCategories, setPreferredCategories] = useState<string[]>(DEFAULT_PREFERENCES);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [likedYtIds, setLikedYtIds] = useState<Set<string>>(new Set());

  // Navigation & Modals
  const [activeSection, setActiveSection] = useState<AppSection>('discover');
  const [activeVideo, setActiveVideo] = useState<ActiveVideoSelection | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Search & Catalog State
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    source: 'all',
    category: 'all',
    duration: 'any',
    sort: 'relevance',
  });
  const [communityMedia, setCommunityMedia] = useState<MediaItem[]>([]);
  const [youtubeResults, setYoutubeResults] = useState<YouTubeVideoItem[]>([]);
  const [personalizedYtResults, setPersonalizedYtResults] = useState<YouTubeVideoItem[]>([]);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [ytError, setYtError] = useState('');

  // Audio Player & Offline State
  const [offlineRecords, setOfflineRecords] = useState<OfflineAudioRecord[]>([]);
  const [savingOfflineId, setSavingOfflineId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<AudioTrackItem | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isOfflinePlayback, setIsOfflinePlayback] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0.85);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Startup Firestore connection validation
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Load IndexedDB Offline Audio Library
  const refreshOfflineLibrary = useCallback(async () => {
    try {
      const list = await getAllOfflineAudio();
      setOfflineRecords(list);
    } catch (err) {
      console.error('Failed to load offline audio records:', err);
    }
  }, []);

  useEffect(() => {
    refreshOfflineLibrary();
  }, [refreshOfflineLibrary]);

  // Firebase Auth listener + load private user preferences
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setSubscriptions([]);
        setLikedYtIds(new Set());
        return;
      }

      const userPath = `users/${nextUser.uid}`;
      try {
        const snap = await getDoc(doc(db, 'users', nextUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.preferredCategories) && data.preferredCategories.length > 0) {
            setPreferredCategories(data.preferredCategories);
          }
        } else {
          await setDoc(doc(db, 'users', nextUser.uid), {
            uid: nextUser.uid,
            displayName: (nextUser.displayName || 'Google User').slice(0, 100),
            photoURL: (nextUser.photoURL || '').slice(0, 500),
            preferredCategories: DEFAULT_PREFERENCES,
            recentSearches: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, userPath);
      }
    });
    return unsub;
  }, []);

  // Real-time Community Media Catalog (public read)
  useEffect(() => {
    const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: MediaItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MediaItem, 'id'>),
        }));
        setCommunityMedia(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'media');
      }
    );
    return unsub;
  }, []);

  // Real-time User Subscriptions & YouTube Likes
  useEffect(() => {
    if (!user) return;
    const subQ = query(collection(db, 'subscriptions'), where('userId', '==', user.uid));
    const unsubSubs = onSnapshot(
      subQ,
      (snap) => {
        setSubscriptions(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<SubscriptionItem, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptions')
    );

    const ytLikeQ = query(collection(db, 'yt_likes'), where('userId', '==', user.uid));
    const unsubYtLikes = onSnapshot(
      ytLikeQ,
      (snap) => {
        const ids = new Set<string>();
        snap.docs.forEach((d) => {
          const vid = d.data().videoId;
          if (typeof vid === 'string') ids.add(vid);
        });
        setLikedYtIds(ids);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'yt_likes')
    );

    return () => {
      unsubSubs();
      unsubYtLikes();
    };
  }, [user]);

  const subscribedChannelIds = useMemo(
    () => new Set(subscriptions.map((s) => s.channelId)),
    [subscriptions]
  );

  // Live YouTube Search Fetcher
  const executeSearch = useCallback(async (targetFilters: SearchFilters) => {
    if (!navigator.onLine) {
      setYtError('আপনি অফলাইনে আছেন। YouTube সার্চ করতে ইন্টারনেট সংযোগ প্রয়োজন।');
      return;
    }
    if (targetFilters.source === 'upload') {
      setYoutubeResults([]);
      return;
    }
    setIsSearchingYt(true);
    setYtError('');
    try {
      const catObj = MEDIA_CATEGORIES.find((c) => c.id === targetFilters.category);
      const qVal = targetFilters.query.trim();
      const effectiveQuery = qVal
        ? targetFilters.category !== 'all'
          ? `${qVal} ${targetFilters.category}`
          : qVal
        : catObj?.ytQuery || 'Bangla Ghazal Song Tech Documentary';

      const params = new URLSearchParams({
        q: effectiveQuery,
        duration: targetFilters.duration,
        sort: targetFilters.sort,
      });
      const resp = await fetch(`/api/youtube/search?${params.toString()}`);
      const data = (await resp.json()) as { items?: YouTubeVideoItem[]; error?: string };
      if (!resp.ok) {
        throw new Error(data.error || 'YouTube সার্চ করা যায়নি');
      }
      setYoutubeResults(data.items || []);
    } catch (err) {
      setYtError(err instanceof Error ? err.message : 'YouTube সার্চ ব্যর্থ হয়েছে');
    } finally {
      setIsSearchingYt(false);
    }
  }, []);

  // Initial Discover YouTube load
  useEffect(() => {
    executeSearch(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Personalized YouTube Feed loader based on preferredCategories
  useEffect(() => {
    if (!isOnline) return;
    const catsParam = preferredCategories.join(',');
    fetch(`/api/youtube/feed?categories=${encodeURIComponent(catsParam)}`)
      .then((r) => r.json())
      .then((data: { items?: YouTubeVideoItem[] }) => {
        if (Array.isArray(data.items)) {
          setPersonalizedYtResults(data.items);
        }
      })
      .catch(() => {
        // Silent fallback to main results
      });
  }, [preferredCategories, isOnline]);

  // Filtered Community Videos
  const filteredCommunityVideos = useMemo(() => {
    if (filters.source === 'youtube') return [];
    const qLower = filters.query.trim().toLowerCase();
    const list = communityMedia.filter((m) => {
      if (m.mediaType !== 'video') return false;
      if (filters.category !== 'all' && m.category !== filters.category) return false;
      if (filters.duration === 'short' && m.durationSeconds >= 240) return false;
      if (
        filters.duration === 'medium' &&
        (m.durationSeconds < 240 || m.durationSeconds > 1200)
      )
        return false;
      if (filters.duration === 'long' && m.durationSeconds <= 1200) return false;
      if (qLower) {
        const hay = `${m.title} ${m.artistOrChannel} ${m.category} ${m.description || ''} ${(
          m.tags || []
        ).join(' ')}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
    if (filters.sort === 'viewCount') {
      return [...list].sort((a, b) => b.viewsCount - a.viewsCount);
    }
    return list;
  }, [communityMedia, filters]);

  // Combined Audio Catalog (Built-in + Community Uploaded Audio)
  const allAudioTracks = useMemo<AudioTrackItem[]>(() => {
    const uploadedAudio: AudioTrackItem[] = communityMedia
      .filter((m) => m.mediaType === 'audio')
      .map((m) => ({
        id: m.id,
        title: m.title,
        artist: m.artistOrChannel,
        category: m.category,
        durationSeconds: m.durationSeconds,
        durationLabel: m.durationLabel,
        audioUrl: m.mediaUrl,
        downloadUrl: `${m.mediaUrl}${m.mediaUrl.includes('?') ? '&' : '?'}download=1`,
        coverUrl: m.thumbnailUrl || '/src/assets/images/cover_ghazal_moonlight_1795656271885.jpg',
        description: m.description || 'কমিউনিটি আপলোড করা অডিও ট্র্যাক',
        sourceType: 'upload',
        authorId: m.authorId,
        likesCount: m.likesCount,
      }));

    const combined = [...uploadedAudio, ...BUILTIN_AUDIO_TRACKS];
    const qLower = filters.query.trim().toLowerCase();
    return combined.filter((t) => {
      if (filters.category !== 'all' && t.category !== filters.category) return false;
      if (qLower) {
        const hay = `${t.title} ${t.artist} ${t.category} ${t.description}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
  }, [communityMedia, filters.category, filters.query]);

  // Personalized Community Feed ("আমার ফিড")
  const personalizedCommunityVideos = useMemo(() => {
    const prefSet = new Set(preferredCategories);
    return [...communityMedia]
      .filter((m) => m.mediaType === 'video')
      .sort((a, b) => {
        const scoreA =
          (prefSet.has(a.category) ? 10 : 0) +
          (subscribedChannelIds.has(a.authorId) ? 15 : 0) +
          a.likesCount;
        const scoreB =
          (prefSet.has(b.category) ? 10 : 0) +
          (subscribedChannelIds.has(b.authorId) ? 15 : 0) +
          b.likesCount;
        return scoreB - scoreA;
      });
  }, [communityMedia, preferredCategories, subscribedChannelIds]);

  const offlineIds = useMemo(
    () => new Set(offlineRecords.map((r) => r.id)),
    [offlineRecords]
  );

  // Audio Element Lifecycle & Playback Controls
  const playTrack = useCallback(
    async (track: AudioTrackItem) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (currentTrack?.id === track.id) {
        if (audio.paused) {
          await audio.play();
          setIsAudioPlaying(true);
        } else {
          audio.pause();
          setIsAudioPlaying(false);
        }
        return;
      }

      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }

      setCurrentTrack(track);
      setAudioCurrentTime(0);

      // Prefer IndexedDB offline Blob if saved locally so it plays even offline!
      const offlineRec = await getOfflineAudioRecord(track.id).catch(() => null);
      if (offlineRec?.blob) {
        const blobUrl = URL.createObjectURL(offlineRec.blob);
        activeBlobUrlRef.current = blobUrl;
        audio.src = blobUrl;
        setIsOfflinePlayback(true);
      } else {
        audio.src = track.audioUrl;
        setIsOfflinePlayback(false);
      }

      audio.volume = audioVolume;
      try {
        await audio.play();
        setIsAudioPlaying(true);
      } catch (err) {
        console.error('Audio play failed:', err);
        showToast('অডিও প্লে করতে সমস্যা হয়েছে।');
      }
    },
    [audioVolume, currentTrack, showToast]
  );

  const playOfflineRecord = useCallback(
    (rec: OfflineAudioRecord) => {
      const asTrack: AudioTrackItem = {
        id: rec.id,
        title: rec.title,
        artist: rec.artist,
        category: rec.category,
        durationSeconds: rec.durationSeconds,
        durationLabel: rec.durationLabel,
        audioUrl: '',
        downloadUrl: '',
        coverUrl: rec.coverUrl,
        description: 'অফলাইনে সংরক্ষিত ট্র্যাক',
        sourceType: 'builtin',
      };
      playTrack(asTrack);
    },
    [playTrack]
  );

  const handleTogglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.paused) {
      await audio.play();
      setIsAudioPlaying(true);
    } else {
      audio.pause();
      setIsAudioPlaying(false);
    }
  }, [currentTrack]);

  const handleStepTrack = useCallback(
    (direction: -1 | 1) => {
      if (!currentTrack || allAudioTracks.length === 0) return;
      const idx = allAudioTracks.findIndex((t) => t.id === currentTrack.id);
      const nextIdx =
        idx === -1
          ? 0
          : (idx + direction + allAudioTracks.length) % allAudioTracks.length;
      playTrack(allAudioTracks[nextIdx]);
    },
    [allAudioTracks, currentTrack, playTrack]
  );

  const handleSaveOffline = async (track: AudioTrackItem) => {
    setSavingOfflineId(track.id);
    try {
      await saveAudioOffline(track);
      await refreshOfflineLibrary();
      showToast(`"${track.title}" অফলাইনে শোনার জন্য সেভ করা হয়েছে।`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'অফলাইন সেভ ব্যর্থ হয়েছে।');
    } finally {
      setSavingOfflineId(null);
    }
  };

  const handleDownloadDevice = async (track: AudioTrackItem) => {
    try {
      await downloadAudioToDevice(track);
      showToast('ডিভাইসে ডাউনলোড শুরু হয়েছে।');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'ডাউনলোড করা যায়নি।');
    }
  };

  const handleDownloadOfflineRecord = (rec: OfflineAudioRecord) => {
    const url = URL.createObjectURL(rec.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${rec.title.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || rec.id}.wav`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleDeleteOffline = async (trackId: string) => {
    await removeOfflineAudio(trackId);
    await refreshOfflineLibrary();
    showToast('অফলাইন লাইব্রেরি থেকে সরানো হয়েছে।');
  };

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithGoogle();
      showToast('Google অ্যাকাউন্ট দিয়ে সফলভাবে সাইন ইন সম্পন্ন হয়েছে!');
    } catch (err) {
      console.error('Google sign in error:', err);
      showToast('গুগল সাইন-ইন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSavePreferences = async (nextCats: string[]) => {
    const cleanCats = nextCats.length > 0 ? nextCats.slice(0, 10) : DEFAULT_PREFERENCES;
    setPreferredCategories(cleanCats);
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          preferredCategories: cleanCats,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
    showToast('আপনার ফিড পছন্দ আপডেট করা হয়েছে।');
  };

  const handleUnsubscribe = async (subId: string, name: string) => {
    try {
      await deleteDoc(doc(db, 'subscriptions', subId));
      showToast(`${name} আনসাবস্ক্রাইব করা হয়েছে।`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `subscriptions/${subId}`);
    }
  };

  return (
    <div className={`min-h-screen bg-[#0A0B0E] text-slate-100 ${currentTrack ? 'pb-28' : 'pb-12'}`}>
      <TopBar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        user={user}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={signOutGoogle}
        authLoading={authLoading}
      />

      <SearchFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onSearchSubmit={(next) => {
          setActiveSection('discover');
          executeSearch(next);
        }}
        onOpenUpload={() => setUploadModalOpen(true)}
        onOpenPreferences={() => setPrefsModalOpen(true)}
        isSearching={isSearchingYt}
      />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-6 space-y-10">
        {/* DISCOVER VIEW */}
        {activeSection === 'discover' && (
          <>
            {/* Editorial Cinema Hero Split (Only shown when not actively filtering by query) */}
            {!filters.query.trim() && filters.category === 'all' && (
              <section className="rounded-2xl border border-slate-800/80 bg-[#101218] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between gap-6">
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-rose-400">
                      YouTube লাইভ সার্চ · কমিউনিটি স্ট্রিম · অফলাইন গজল ও অডিও
                    </p>
                    <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight text-balance">
                      একই প্ল্যাটফর্মে ভিডিও স্ট্রিমিং, ইউটিউব সার্চ এবং অফলাইন অডিও গজল
                    </h1>
                    <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                      আপনার Google অ্যাকাউন্ট দিয়ে যুক্ত হয়ে নিজে ভিডিও ও গান আপলোড করুন, মুহূর্তেই যেকোনো YouTube ভিডিও খুঁজে দেখুন, এবং প্রিয় গান ও গজল অফলাইনের জন্য ডাউনলোড করে রাখুন।
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setUploadModalOpen(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-500 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Upload className="w-4 h-4" />
                      ভিডিও আপলোড করুন
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('audio')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-700 bg-[#171A23] text-slate-100 text-sm font-semibold hover:bg-[#1F2330] transition-colors whitespace-nowrap shrink-0"
                    >
                      <Headphones className="w-4 h-4 text-rose-400" />
                      অডিও ও গজল শুনুন
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6 min-h-[240px] lg:min-h-[340px] relative">
                  <img
                    src={HERO_STUDIO_IMAGE}
                    alt="SurDrishyo cinema and acoustic studio"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover lg:absolute lg:inset-0"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#101218] via-transparent to-transparent lg:w-20" />
                </div>
              </section>
            )}

            {/* Community Uploaded Videos */}
            {filteredCommunityVideos.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <h2 className="text-lg font-bold text-white">
                    কমিউনিটি আপলোড করা ভিডিও
                  </h2>
                  <span className="text-xs text-slate-400 font-mono-nums">
                    {filteredCommunityVideos.length}টি ভিডিও
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {filteredCommunityVideos.map((item) => (
                    <VideoCard
                      key={item.id}
                      title={item.title}
                      channelTitle={item.artistOrChannel}
                      thumbnailUrl={item.thumbnailUrl}
                      durationLabel={item.durationLabel}
                      sourceLabel="অ্যাপ আপলোড"
                      metaText={`${item.category} · ${item.viewsCount.toLocaleString()} ভিউ · ${item.likesCount} লাইক`}
                      onClick={() => setActiveVideo({ kind: 'upload', media: item })}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Live YouTube Search Results */}
            {filters.source !== 'upload' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <h2 className="text-lg font-bold text-white">
                    {filters.query.trim()
                      ? `YouTube সার্চ ফলাফল: "${filters.query.trim()}"`
                      : 'YouTube থেকে সরাসরি স্ট্রিম'}
                  </h2>
                  <span className="text-xs text-slate-400 font-mono-nums">
                    {isSearchingYt ? 'লোড হচ্ছে...' : `${youtubeResults.length}টি ভিডিও`}
                  </span>
                </div>

                {ytError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-center justify-between gap-4">
                    <p className="text-xs text-rose-200">{ytError}</p>
                    <button
                      type="button"
                      onClick={() => executeSearch(filters)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                    >
                      আবার চেষ্টা করুন
                    </button>
                  </div>
                )}

                {isSearchingYt ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {Array.from({ length: 8 }).map((_, idx) => (
                      <div key={idx} className="space-y-3 animate-pulse">
                        <div className="aspect-video rounded-xl bg-slate-800/70" />
                        <div className="h-4 bg-slate-800/70 rounded w-5/6" />
                        <div className="h-3 bg-slate-800/60 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : youtubeResults.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-[#12141A] p-10 text-center space-y-3">
                    <p className="text-sm text-slate-300">
                      এই সার্চ বা ফিল্টারে কোনো YouTube ভিডিও পাওয়া যায়নি।
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const reset: SearchFilters = {
                          query: '',
                          source: 'all',
                          category: 'all',
                          duration: 'any',
                          sort: 'relevance',
                        };
                        setFilters(reset);
                        executeSearch(reset);
                      }}
                      className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                    >
                      সব ফিল্টার রিসেট করুন
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {youtubeResults.map((yt) => (
                      <VideoCard
                        key={yt.videoId}
                        title={yt.title}
                        channelTitle={yt.channelTitle}
                        thumbnailUrl={yt.thumbnailUrl}
                        durationLabel={yt.durationLabel}
                        sourceLabel="YouTube"
                        metaText={`${yt.viewsLabel} · ${yt.publishedText}`}
                        onClick={() =>
                          setActiveVideo({
                            kind: 'youtube',
                            video: yt,
                            categoryHint:
                              filters.category !== 'all' ? filters.category : 'YouTube',
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Quick Audio & Ghazal Preview Row */}
            <section className="pt-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                <h2 className="text-lg font-bold text-white">জনপ্রিয় অডিও ও গজল</h2>
                <button
                  type="button"
                  onClick={() => setActiveSection('audio')}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300"
                >
                  সব অডিও দেখুন
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {allAudioTracks.slice(0, 4).map((track) => (
                  <div
                    key={track.id}
                    className="rounded-xl border border-slate-800/90 bg-[#12141A] p-3.5 flex items-center gap-3 hover:border-slate-700 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => playTrack(track)}
                      className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 group"
                    >
                      <MediaThumbnail
                        src={track.coverUrl}
                        alt={track.title}
                        mediaType="audio"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-white fill-white" />
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => playTrack(track)}
                        className="text-left text-xs font-semibold text-white truncate block w-full hover:text-rose-400"
                      >
                        {track.title}
                      </button>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {track.artist} · {track.durationLabel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* CUSTOMIZED FEED ("আমার ফিড") */}
        {activeSection === 'for-you' && (
          <section className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  আপনার কাস্টমাইজড ফিড
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  নির্বাচিত পছন্দ ({preferredCategories.join(' · ')}) ও সাবস্ক্রিপশন অনুযায়ী সাজানো
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrefsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                পছন্দ পরিবর্তন করুন
              </button>
            </div>

            {personalizedCommunityVideos.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-200">
                  আপনার পছন্দের কমিউনিটি ভিডিও
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {personalizedCommunityVideos.map((item) => (
                    <VideoCard
                      key={item.id}
                      title={item.title}
                      channelTitle={item.artistOrChannel}
                      thumbnailUrl={item.thumbnailUrl}
                      durationLabel={item.durationLabel}
                      sourceLabel="আপনার ফিড"
                      metaText={`${item.category} · ${item.viewsCount} ভিউ`}
                      onClick={() => setActiveVideo({ kind: 'upload', media: item })}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-base font-semibold text-slate-200">
                YouTube থেকে আপনার জন্য বাছাইকৃত
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {(personalizedYtResults.length > 0 ? personalizedYtResults : youtubeResults).map(
                  (yt) => (
                    <VideoCard
                      key={yt.videoId}
                      title={yt.title}
                      channelTitle={yt.channelTitle}
                      thumbnailUrl={yt.thumbnailUrl}
                      durationLabel={yt.durationLabel}
                      sourceLabel="YouTube রিকমেন্ডেড"
                      metaText={`${yt.viewsLabel} · ${yt.publishedText}`}
                      onClick={() =>
                        setActiveVideo({
                          kind: 'youtube',
                          video: yt,
                          categoryHint: preferredCategories[0] || 'YouTube',
                        })
                      }
                    />
                  )
                )}
              </div>
            </div>
          </section>
        )}

        {/* AUDIO & GHAZALS PLATFORM */}
        {activeSection === 'audio' && (
          <AudioStudioSection
            tracks={allAudioTracks}
            currentTrackId={currentTrack?.id || null}
            isPlaying={isAudioPlaying}
            offlineIds={offlineIds}
            savingOfflineId={savingOfflineId}
            onPlayTrack={playTrack}
            onDownloadDevice={handleDownloadDevice}
            onSaveOffline={handleSaveOffline}
            onOpenUpload={() => setUploadModalOpen(true)}
          />
        )}

        {/* OFFLINE LIBRARY */}
        {activeSection === 'offline' && (
          <OfflineLibrarySection
            records={offlineRecords}
            currentTrackId={currentTrack?.id || null}
            isPlaying={isAudioPlaying}
            onPlayOffline={playOfflineRecord}
            onDownloadRecord={handleDownloadOfflineRecord}
            onDeleteOffline={handleDeleteOffline}
            onBrowseAudio={() => setActiveSection('audio')}
          />
        )}

        {/* SUBSCRIPTIONS */}
        {activeSection === 'subscriptions' && (
          <section className="space-y-6">
            <div className="border-b border-slate-800/80 pb-5">
              <h2 className="text-2xl font-bold text-white tracking-tight">সাবস্ক্রিপশন</h2>
              <p className="text-sm text-slate-400 mt-1">
                আপনি যেসব ক্রিয়েটর ও YouTube চ্যানেল ফলো করছেন
              </p>
            </div>

            {!user ? (
              <div className="rounded-2xl border border-slate-800 bg-[#12141A] p-10 text-center space-y-4">
                <p className="text-sm text-slate-300">
                  আপনার সাবস্ক্রিপশন তালিকা দেখতে Google অ্যাকাউন্ট দিয়ে সাইন ইন করুন।
                </p>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="px-5 py-2.5 rounded-lg bg-white text-slate-900 text-xs font-semibold"
                >
                  Sign in with Google
                </button>
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-[#12141A] p-10 text-center space-y-3">
                <p className="text-sm text-slate-300">
                  আপনি এখনো কোনো চ্যানেল সাবস্ক্রাইব করেননি। ভিডিও প্লেয়ার থেকে পছন্দের চ্যানেল সাবস্ক্রাইব করুন।
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-xl border border-slate-800 bg-[#12141A] p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full overflow-hidden border border-slate-700 shrink-0">
                        <MediaThumbnail
                          src={sub.channelPhoto}
                          alt={sub.channelName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...filters, query: sub.channelName };
                            setFilters(next);
                            setActiveSection('discover');
                            executeSearch(next);
                          }}
                          className="text-sm font-semibold text-white truncate hover:text-rose-400 text-left block w-full"
                        >
                          {sub.channelName}
                        </button>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <UserCheck className="w-3 h-3 text-emerald-400" />
                          সাবস্ক্রাইবড
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnsubscribe(sub.id, sub.channelName)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:text-rose-400 whitespace-nowrap shrink-0"
                    >
                      আনসাবস্ক্রাইব
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Hidden HTML5 Audio Engine */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) setAudioCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setAudioDuration(audioRef.current.duration || 0);
        }}
        onEnded={() => handleStepTrack(1)}
        onPause={() => setIsAudioPlaying(false)}
        onPlay={() => setIsAudioPlaying(true)}
      />

      {/* Persistent Bottom Audio Player Bar */}
      {currentTrack && (
        <AudioPlayerBar
          track={currentTrack}
          isPlaying={isAudioPlaying}
          isOfflinePlayback={isOfflinePlayback}
          currentTime={audioCurrentTime}
          duration={audioDuration}
          volume={audioVolume}
          onTogglePlay={handleTogglePlayPause}
          onPrev={() => handleStepTrack(-1)}
          onNext={() => handleStepTrack(1)}
          onSeek={(sec) => {
            if (audioRef.current) {
              audioRef.current.currentTime = sec;
              setAudioCurrentTime(sec);
            }
          }}
          onVolumeChange={(v) => {
            setAudioVolume(v);
            if (audioRef.current) audioRef.current.volume = v;
          }}
          onDownload={handleDownloadDevice}
          onClose={() => {
            if (audioRef.current) audioRef.current.pause();
            setIsAudioPlaying(false);
            setCurrentTrack(null);
          }}
        />
      )}

      {/* Cinema Video Player + Social Engagement Modal */}
      {activeVideo && (
        <VideoPlayerModal
          selection={activeVideo}
          user={user}
          onRequireSignIn={handleGoogleSignIn}
          onClose={() => setActiveVideo(null)}
          subscribedChannelIds={subscribedChannelIds}
          likedYtIds={likedYtIds}
          onToast={showToast}
        />
      )}

      {/* Upload Studio Modal */}
      {uploadModalOpen && (
        <UploadModal
          user={user}
          onRequireSignIn={handleGoogleSignIn}
          onClose={() => setUploadModalOpen(false)}
          onUploadComplete={(title, type) => {
            showToast(`"${title}" সফলভাবে প্রকাশিত হয়েছে!`);
            setActiveSection(type === 'audio' ? 'audio' : 'discover');
          }}
        />
      )}

      {/* Feed Preferences Modal */}
      {prefsModalOpen && (
        <FeedPreferencesModal
          selectedCategories={preferredCategories}
          onSave={handleSavePreferences}
          onClose={() => setPrefsModalOpen(false)}
        />
      )}

      {/* Offline Connectivity Banner */}
      <OfflineBanner onOpenOfflineLibrary={() => setActiveSection('offline')} />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          className="fixed top-20 right-4 z-50 rounded-xl border border-slate-700 bg-[#151822] px-4 py-3 text-xs font-medium text-white shadow-2xl max-w-sm"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
