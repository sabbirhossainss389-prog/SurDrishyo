import React from 'react';
import { Download, Pause, Play, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import type { AudioTrackItem } from '../types/media';
import { MediaThumbnail } from './MediaThumbnail';

interface AudioPlayerBarProps {
  track: AudioTrackItem;
  isPlaying: boolean;
  isOfflinePlayback: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onDownload: (track: AudioTrackItem) => void;
  onClose: () => void;
}

function formatSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  track,
  isPlaying,
  isOfflinePlayback,
  currentTime,
  duration,
  volume,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onDownload,
  onClose,
}) => {
  const safeDuration = duration > 0 ? duration : track.durationSeconds || 1;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-[#0E1016]/95 backdrop-blur-lg">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-full sm:w-64 shrink-0 min-w-0">
          <div className="w-11 h-11 rounded-lg overflow-hidden border border-slate-800 shrink-0">
            <MediaThumbnail
              src={track.coverUrl}
              alt={track.title}
              mediaType="audio"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{track.title}</p>
            <p className="text-[11px] text-slate-400 truncate">
              {track.artist}
              {isOfflinePlayback && ' · অফলাইন'}
            </p>
          </div>
        </div>

        {/* Transport + Progress */}
        <div className="flex-1 w-full flex flex-col gap-1.5">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous track"
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white" />
              ) : (
                <Play className="w-4 h-4 fill-white ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next track"
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-[11px] text-slate-400 font-mono-nums w-10 text-right">
              {formatSec(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={safeDuration}
              step={0.5}
              value={Math.min(currentTime, safeDuration)}
              onChange={(e) => onSeek(Number.parseFloat(e.target.value))}
              aria-label="Audio seek position"
              className="flex-1 accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 font-mono-nums w-10">
              {formatSec(safeDuration)}
            </span>
          </div>
        </div>

        {/* Volume + Download + Close */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-slate-400" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onVolumeChange(Number.parseFloat(e.target.value))}
              aria-label="Volume"
              className="w-20 accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
          <button
            type="button"
            onClick={() => onDownload(track)}
            title="ডিভাইসে ডাউনলোড করুন"
            className="p-2 rounded-lg border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close audio player"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
