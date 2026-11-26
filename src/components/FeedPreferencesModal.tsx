import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { MEDIA_CATEGORIES } from '../types/media';

interface FeedPreferencesModalProps {
  selectedCategories: string[];
  onSave: (categories: string[]) => Promise<void>;
  onClose: () => void;
}

export const FeedPreferencesModal: React.FC<FeedPreferencesModalProps> = ({
  selectedCategories,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<string[]>(selectedCategories);
  const [saving, setSaving] = useState(false);

  const options = MEDIA_CATEGORIES.filter((c) => c.id !== 'all');

  const toggle = (id: string) => {
    setDraft((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : prev.length < 10
        ? [...prev, id]
        : prev
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="কাস্টমাইজড ফিড পছন্দ"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#111319] p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">আপনার পছন্দের বিষয় বেছে নিন</h2>
            <p className="text-xs text-slate-400 mt-1">
              নির্বাচিত বিষয় অনুযায়ী "আমার ফিড" ও YouTube রিকমেন্ডেশন সাজানো হবে।
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {options.map((cat) => {
            const active = draft.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggle(cat.id)}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl border text-xs font-medium transition-colors text-left ${
                  active
                    ? 'border-rose-500 bg-rose-500/15 text-white'
                    : 'border-slate-800 bg-[#161922] text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>{cat.label}</span>
                {active && <Check className="w-4 h-4 text-rose-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:text-white"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 disabled:opacity-50"
          >
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'পছন্দ সংরক্ষণ করুন'}
          </button>
        </div>
      </div>
    </div>
  );
};
