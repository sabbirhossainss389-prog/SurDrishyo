import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Film, Music, UploadCloud, X } from 'lucide-react';
import { db, getFirebaseIdToken, handleFirestoreError, OperationType } from '../lib/firebase';
import { MEDIA_CATEGORIES, type MediaType } from '../types/media';

interface UploadModalProps {
  user: User | null;
  onRequireSignIn: () => void;
  onClose: () => void;
  onUploadComplete: (title: string, mediaType: MediaType) => void;
}

function detectFileDuration(file: File, kind: MediaType): Promise<{ seconds: number; label: string }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const el = document.createElement(kind);
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const secs = Math.max(0, Math.round(el.duration || 0));
      URL.revokeObjectURL(objectUrl);
      const mins = Math.floor(secs / 60);
      const rem = secs % 60;
      const label = `${mins}:${String(rem).padStart(2, '0')}`;
      resolve({ seconds: secs, label });
    };
    el.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ seconds: 120, label: '2:00' });
    };
    el.src = objectUrl;
  });
}

export const UploadModal: React.FC<UploadModalProps> = ({
  user,
  onRequireSignIn,
  onClose,
  onUploadComplete,
}) => {
  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [title, setTitle] = useState('');
  const [artistOrChannel, setArtistOrChannel] = useState(user?.displayName || '');
  const [category, setCategory] = useState('গজল ও নাশিদ');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const uploadCategories = MEDIA_CATEGORIES.filter((c) => c.id !== 'all');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!user) {
      onRequireSignIn();
      return;
    }

    if (!mediaFile) {
      setErrorMsg('অনুগ্রহ করে একটি ভিডিও বা অডিও ফাইল নির্বাচন করুন।');
      return;
    }

    const cleanTitle = title.trim().slice(0, 160);
    if (!cleanTitle) {
      setErrorMsg('শিরোনাম দেওয়া আবশ্যক।');
      return;
    }

    setUploading(true);
    setProgress(5);

    try {
      const idToken = await getFirebaseIdToken();
      if (!idToken) {
        throw new Error('অথেনটিকেশন টোকেন পাওয়া যায়নি।');
      }

      const duration = await detectFileDuration(mediaFile, mediaType);

      const formData = new FormData();
      formData.append('file', mediaFile);
      if (thumbFile) {
        formData.append('thumbnail', thumbFile);
      }

      const uploadRes = await new Promise<{ mediaUrl: string; thumbnailUrl: string }>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/media/upload');
          xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);
          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const pct = Math.min(92, Math.round((evt.loaded / evt.total) * 90));
              setProgress(pct);
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                reject(new Error('সার্ভার রেসপন্স পড়া যায়নি।'));
              }
            } else {
              try {
                const parsed = JSON.parse(xhr.responseText) as { error?: string };
                reject(new Error(parsed.error || `আপলোড ব্যর্থ (${xhr.status})`));
              } catch {
                reject(new Error(`আপলোড ব্যর্থ (${xhr.status})`));
              }
            }
          };
          xhr.onerror = () => reject(new Error('নেটওয়ার্ক ত্রুটির কারণে আপলোড ব্যর্থ হয়েছে।'));
          xhr.send(formData);
        }
      );

      setProgress(96);

      const mediaId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 8);

      const fallbackCover =
        mediaType === 'audio'
          ? '/src/assets/images/cover_ghazal_moonlight_1795656271885.jpg'
          : '/src/assets/images/hero_cinema_studio_1795656272035.jpg';

      await setDoc(doc(db, 'media', mediaId), {
        id: mediaId,
        title: cleanTitle,
        description: description.trim().slice(0, 2000),
        mediaType,
        sourceType: 'upload',
        mediaUrl: uploadRes.mediaUrl,
        thumbnailUrl: uploadRes.thumbnailUrl || fallbackCover,
        category: category.slice(0, 60),
        artistOrChannel: (artistOrChannel.trim() || user.displayName || 'Creator').slice(0, 100),
        durationSeconds: Math.min(86400, Math.max(1, duration.seconds)),
        durationLabel: duration.label.slice(0, 20),
        tags: parsedTags,
        authorId: user.uid,
        authorName: (user.displayName || 'Creator').slice(0, 100),
        authorPhoto: (user.photoURL || '').slice(0, 500),
        viewsCount: 0,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setProgress(100);
      onUploadComplete(cleanTitle, mediaType);
      onClose();
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('{')) {
        handleFirestoreError(err, OperationType.CREATE, 'media');
      }
      setErrorMsg(err instanceof Error ? err.message : 'আপলোড সম্পন্ন করা যায়নি।');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="ভিডিও বা অডিও আপলোড"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#111319] p-6 space-y-5 my-auto shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">ক্রিয়েটর আপলোড স্টুডিও</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              সরাসরি প্ল্যাটফর্মে ভিডিও বা অডিও গান/গজল আপলোড ও প্রকাশ করুন
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close upload modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!user && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-4">
            <p className="text-xs text-amber-200">
              ভিডিও বা অডিও আপলোড করতে আপনার Google অ্যাকাউন্ট দিয়ে সাইন ইন করুন।
            </p>
            <button
              type="button"
              onClick={onRequireSignIn}
              className="px-3.5 py-2 rounded-lg bg-white text-slate-900 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              সাইন ইন
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Media Type Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#181B24]">
            <button
              type="button"
              onClick={() => {
                setMediaType('video');
                setMediaFile(null);
              }}
              className={`py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                mediaType === 'video'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Film className="w-4 h-4" />
              ভিডিও আপলোড
            </button>
            <button
              type="button"
              onClick={() => {
                setMediaType('audio');
                setMediaFile(null);
              }}
              className={`py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                mediaType === 'audio'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Music className="w-4 h-4" />
              অডিও / গজল আপলোড
            </button>
          </div>

          {/* Media File Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {mediaType === 'video' ? 'ভিডিও ফাইল (MP4, WebM, MOV)' : 'অডিও ফাইল (MP3, WAV, OGG, M4A)'}
            </label>
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-[#151821] px-4 py-5 cursor-pointer hover:border-rose-500/70 transition-colors">
              <UploadCloud className="w-6 h-6 text-rose-400" />
              <span className="text-xs text-slate-300 text-center">
                {mediaFile
                  ? `${mediaFile.name} (${(mediaFile.size / (1024 * 1024)).toFixed(2)} MB)`
                  : 'ফাইল নির্বাচন করতে ক্লিক করুন (সর্বোচ্চ ১৫০ MB)'}
              </span>
              <input
                type="file"
                className="hidden"
                accept={
                  mediaType === 'video'
                    ? '.mp4,.webm,.mov,.m4v,video/*'
                    : '.mp3,.wav,.ogg,.m4a,.aac,.flac,audio/*'
                }
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">শিরোনাম *</label>
              <input
                type="text"
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: সন্ধ্যার সুফি গজল"
                className="w-full h-10 px-3 rounded-lg border border-slate-800 bg-[#151821] text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {mediaType === 'audio' ? 'শিল্পী / গায়ক' : 'চ্যানেল / ক্রিয়েটর'}
              </label>
              <input
                type="text"
                maxLength={100}
                value={artistOrChannel}
                onChange={(e) => setArtistOrChannel(e.target.value)}
                placeholder="আপনার বা শিল্পীর নাম"
                className="w-full h-10 px-3 rounded-lg border border-slate-800 bg-[#151821] text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">ক্যাটাগরি</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-800 bg-[#151821] text-sm text-white focus:outline-none focus:border-rose-500"
              >
                {uploadCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                কভার / থাম্বনেইল (ঐচ্ছিক)
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/*"
                onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
                className="w-full h-10 px-2.5 py-2 rounded-lg border border-slate-800 bg-[#151821] text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">বিবরণ</label>
            <textarea
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ভিডিও বা অডিও সম্পর্কে সংক্ষিপ্ত বিবরণ..."
              className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#151821] text-sm text-white focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              ট্যাগ (কমা দিয়ে লিখুন)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="গজল, বাংলা, অ্যাকুস্টিক"
              className="w-full h-10 px-3 rounded-lg border border-slate-800 bg-[#151821] text-sm text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          {uploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-300 font-mono-nums">
                <span>আপলোড চলছে...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:text-white"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={uploading || !user}
              className="px-5 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 disabled:opacity-50 transition-colors"
            >
              {uploading ? 'প্রকাশ হচ্ছে...' : 'প্রকাশ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
