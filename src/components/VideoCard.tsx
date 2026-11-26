import React from 'react';
import { Play } from 'lucide-react';
import { MediaThumbnail } from './MediaThumbnail';

interface VideoCardProps {
  title: string;
  channelTitle: string;
  thumbnailUrl?: string;
  durationLabel: string;
  sourceLabel: string;
  metaText: string;
  onClick: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  title,
  channelTitle,
  thumbnailUrl,
  durationLabel,
  sourceLabel,
  metaText,
  onClick,
}) => {
  return (
    <article className="group flex flex-col">
      <button
        type="button"
        onClick={onClick}
        className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-xl"
      >
        <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-800/90 bg-[#12141A]">
          <MediaThumbnail
            src={thumbnailUrl}
            alt={title}
            mediaType="video"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="w-11 h-11 rounded-full bg-rose-600/95 text-white flex items-center justify-center shadow-lg">
              <Play className="w-5 h-5 fill-white ml-0.5" />
            </span>
          </div>
          <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/80 text-[11px] font-mono-nums text-slate-100">
            {durationLabel}
          </span>
        </div>

        <div className="pt-3 space-y-1">
          <h3 className="text-sm font-semibold text-slate-100 line-clamp-2 leading-snug group-hover:text-white transition-colors">
            {title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
            <span className="text-slate-300 truncate">{channelTitle}</span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-400/90 whitespace-nowrap">{sourceLabel}</span>
          </div>
          <p className="text-xs text-slate-500 font-mono-nums truncate">{metaText}</p>
        </div>
      </button>
    </article>
  );
};
