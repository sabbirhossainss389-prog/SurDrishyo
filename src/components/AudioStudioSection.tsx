import React from 'react';
import {
  CheckCircle2,
  Download,
  HardDriveDownload,
  Pause,
  Play,
  Upload,
} from 'lucide-react';
import type { AudioTrackItem } from '../types/media';
import { MediaThumbnail } from './MediaThumbnail';

interface AudioStudioSectionProps {
  tracks: AudioTrackItem[];
  currentTrackId: string | null;
  isPlaying: boolean;
  offlineIds: Set<string>;
  savingOfflineId: string | null;
  onPlayTrack: (track: AudioTrackItem) => void;
  onDownloadDevice: (track: AudioTrackItem) => void;
  onSaveOffline: (track: AudioTrackItem) => void;
  onOpenUpload: () => void;
}

export const AudioStudioSection: React.FC<AudioStudioSectionProps> = ({
  tracks,
  currentTrackId,
  isPlaying,
  offlineIds,
  savingOfflineId,
  onPlayTrack,
  onDownloadDevice,
  onSaveOffline,
  onOpenUpload,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            অডিও স্টুডিও — গান ও গজল
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            সরাসরি শুনুন, ডিভাইসে ডাউনলোড করুন অথবা অফলাইনে শোনার জন্য অ্যাপে সেভ করে রাখুন।
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          অডিও / গজল আপলোড
        </button>
      </div>

      {tracks.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#12141A] p-10 text-center space-y-3">
          <p className="text-sm text-slate-300">এই ফিল্টারে কোনো অডিও ট্র্যাক পাওয়া যায়নি।</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tracks.map((track) => {
            const active = currentTrackId === track.id;
            const savedOffline = offlineIds.has(track.id);
            const isSaving = savingOfflineId === track.id;

            return (
              <article
                key={track.id}
                className={`rounded-xl border p-4 flex items-center gap-4 transition-colors ${
                  active
                    ? 'border-rose-500/70 bg-[#17131B]'
                    : 'border-slate-800/90 bg-[#12141A] hover:border-slate-700'
                }`}
              >
                {/* Album Cover + Play Overlay */}
                <button
                  type="button"
                  onClick={() => onPlayTrack(track)}
                  aria-label={active && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                  className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <MediaThumbnail
                    src={track.coverUrl}
                    alt={track.title}
                    mediaType="audio"
                    className="w-full h-full object-cover"
                  />
                  <div
                    className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${
                      active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {active && isPlaying ? (
                      <Pause className="w-7 h-7 text-white fill-white" />
                    ) : (
                      <Play className="w-7 h-7 text-white fill-white" />
                    )}
                  </div>
                </button>

                {/* Track Info & Unboxed Metadata */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <h3 className="text-sm font-semibold text-white truncate">{track.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
                    <span className="truncate">{track.artist}</span>
                    <span aria-hidden="true">·</span>
                    <span>{track.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-nums">{track.durationLabel}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{track.description}</p>

                  {/* Action Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() => onPlayTrack(track)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-500 transition-colors whitespace-nowrap shrink-0"
                    >
                      {active && isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          বিরতি
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          শুনুন
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDownloadDevice(track)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#181B24] text-slate-200 text-xs font-medium hover:bg-[#222633] transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-300" />
                      ডাউনলোড
                    </button>

                    <button
                      type="button"
                      disabled={isSaving || savedOffline}
                      onClick={() => onSaveOffline(track)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        savedOffline
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 cursor-default'
                          : 'border-slate-700 bg-[#181B24] text-slate-200 hover:bg-[#222633]'
                      }`}
                    >
                      {savedOffline ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          অফলাইন সেভড
                        </>
                      ) : (
                        <>
                          <HardDriveDownload className="w-3.5 h-3.5 text-amber-400" />
                          {isSaving ? 'সেভ হচ্ছে...' : 'অফলাইন সেভ'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
