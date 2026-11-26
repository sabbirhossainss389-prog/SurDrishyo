import React, { useState } from 'react';
import { Film, Music } from 'lucide-react';
import { isSafeMediaUrl } from '../lib/builtinCatalog';

interface MediaThumbnailProps {
  src?: string;
  alt: string;
  mediaType?: 'video' | 'audio';
  className?: string;
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  src,
  alt,
  mediaType = 'video',
  className = 'w-full h-full object-cover',
}) => {
  const [failed, setFailed] = useState(false);
  const validSrc = isSafeMediaUrl(src) ? src : '';

  if (!validSrc || failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#171A23] via-[#12141A] to-[#1F1520] flex flex-col items-center justify-center p-4 text-center">
        {mediaType === 'audio' ? (
          <Music className="w-8 h-8 text-rose-400/80 mb-2" />
        ) : (
          <Film className="w-8 h-8 text-slate-400/80 mb-2" />
        )}
        <span className="text-xs text-slate-400 line-clamp-2 max-w-[85%]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={validSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
};
