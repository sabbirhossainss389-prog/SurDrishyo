import React, { useState } from 'react';
import { Check, Copy, Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isInstalled) return null;

  const handleAction = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleAction}
        className="h-10 px-4 rounded-lg border border-rose-500/40 bg-rose-600/15 text-xs font-semibold text-rose-200 hover:bg-rose-600/25 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 text-rose-400" />
        ফোনে ইনস্টল করুন
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ফোনে অ্যাপ ইনস্টল নির্দেশিকা"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#111319] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">ফোনে SurDrishyo ইনস্টল করুন</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              {isIOS ? (
                <div className="rounded-xl border border-slate-800 bg-[#161922] p-4 space-y-1.5">
                  <p className="font-semibold text-white">iPhone / iPad (Safari):</p>
                  <p>১. Safari ব্রাউজারের নিচে থাকা <strong>Share</strong> আইকনে ট্যাপ করুন।</p>
                  <p>২. নিচে স্ক্রল করে <strong>Add to Home Screen</strong> নির্বাচন করুন।</p>
                  <p>৩. উপরের ডানদিকে <strong>Add</strong> চাপুন।</p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-800 bg-[#161922] p-4 space-y-1.5">
                    <p className="font-semibold text-white">Android (Google Chrome):</p>
                    <p>১. আপনার ফোনের Chrome ব্রাউজারে অ্যাপের লিংকটি সরাসরি ওপেন করুন।</p>
                    <p>২. ব্রাউজারের উপরের ডানদিকে থাকা <strong>⋮ (৩-ডট মেনু)</strong>-তে ট্যাপ করুন।</p>
                    <p>৩. <strong>Install app</strong> অথবা <strong>Add to Home screen</strong> সিলেক্ট করুন।</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#161922] p-4 space-y-1.5">
                    <p className="font-semibold text-white">iPhone / iPad (Safari):</p>
                    <p>Safari-তে ওপেন করে <strong>Share</strong> বাটন → <strong>Add to Home Screen</strong> সিলেক্ট করুন।</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="flex-1 py-2.5 px-4 rounded-lg border border-slate-700 bg-[#171A23] text-xs font-semibold text-slate-100 hover:bg-[#1F2330] transition-colors inline-flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    লিংক কপি হয়েছে
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-300" />
                    অ্যাপ লিংক কপি করুন
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="py-2.5 px-5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-colors"
              >
                ঠিক আছে
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
