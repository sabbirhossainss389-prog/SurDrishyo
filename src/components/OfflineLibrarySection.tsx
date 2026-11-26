import React from 'react';
import { Download, Pause, Play, Trash2, WifiOff } from 'lucide-react';
import { formatBytes } from '../lib/offlineAudio';
import type { OfflineAudioRecord } from '../types/media';
import { MediaThumbnail } from './MediaThumbnail';

interface OfflineLibrarySectionProps {
  records: OfflineAudioRecord[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayOffline: (record: OfflineAudioRecord) => void;
  onDownloadRecord: (record: OfflineAudioRecord) => void;
  onDeleteOffline: (trackId: string) => void;
  onBrowseAudio: () => void;
}

export const OfflineLibrarySection: React.FC<OfflineLibrarySectionProps> = ({
  records,
  currentTrackId,
  isPlaying,
  onPlayOffline,
  onDownloadRecord,
  onDeleteOffline,
  onBrowseAudio,
}) => {
  const totalBytes = records.reduce((acc, r) => acc + r.sizeBytes, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            অফলাইন অডিও লাইব্রেরি
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            ইন্টারনেট সংযোগ না থাকলেও এখানে সেভ করা গান ও গজল শুনতে পারবেন।
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-300 font-mono-nums">
          <span>{records.length}টি ট্র্যাক</span>
          <span aria-hidden="true">·</span>
          <span>মোট {formatBytes(totalBytes)}</span>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#12141A] p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto">
            <WifiOff className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">এখনো কোনো অডিও অফলাইনে সেভ করা হয়নি</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              "অডিও ও গজল" ট্যাব থেকে যেকোনো গান বা গজলে "অফলাইন সেভ" বাটনে ক্লিক করলে সেটি আপনার ব্রাউজারে সংরক্ষিত হবে।
            </p>
          </div>
          <button
            type="button"
            onClick={onBrowseAudio}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-colors"
          >
            গান ও গজল দেখুন
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-[#12141A] overflow-hidden">
          {records.map((rec) => {
            const active = currentTrackId === rec.id;
            return (
              <div
                key={rec.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#161922] transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-slate-800">
                    <MediaThumbnail
                      src={rec.coverUrl}
                      alt={rec.title}
                      mediaType="audio"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{rec.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 truncate">
                      <span>{rec.artist}</span>
                      <span aria-hidden="true">·</span>
                      <span>{rec.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-nums">{rec.durationLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-nums">{formatBytes(rec.sizeBytes)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPlayOffline(rec)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-colors whitespace-nowrap"
                  >
                    {active && isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        বিরতি
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        অফলাইনে শুনুন
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDownloadRecord(rec)}
                    title="ডিভাইসে সেভ করুন"
                    className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteOffline(rec.id)}
                    title="অফলাইন থেকে মুছুন"
                    className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
