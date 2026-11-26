import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineBannerProps {
  onOpenOfflineLibrary: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onOpenOfflineLibrary }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-24 left-4 z-40 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-[#181512] px-4 py-2.5 text-xs font-medium text-amber-200 shadow-lg">
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>অফলাইন মোড — সেভ করা অডিও ও গজল শুনতে পারবেন।</span>
      <button
        type="button"
        onClick={onOpenOfflineLibrary}
        className="underline text-amber-300 hover:text-white whitespace-nowrap shrink-0"
      >
        অফলাইন লাইব্রেরি
      </button>
    </div>
  );
};
