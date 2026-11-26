import React, { useState } from 'react';
import { Search, SlidersHorizontal, Upload, Sparkles, X } from 'lucide-react';
import { MEDIA_CATEGORIES, type SearchFilters } from '../types/media';
import { PWAInstallButton } from './PWAInstallButton';

interface SearchFilterBarProps {
  filters: SearchFilters;
  onFiltersChange: (next: SearchFilters) => void;
  onSearchSubmit: (filters: SearchFilters) => void;
  onOpenUpload: () => void;
  onOpenPreferences: () => void;
  isSearching: boolean;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  filters,
  onFiltersChange,
  onSearchSubmit,
  onOpenUpload,
  onOpenPreferences,
  isSearching,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit(filters);
  };

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    const next = { ...filters, [key]: value };
    onFiltersChange(next);
    if (key !== 'query') {
      onSearchSubmit(next);
    }
  };

  return (
    <section className="border-b border-slate-800/80 bg-[#0D0F14]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          {/* Live Search Input */}
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={filters.query}
                onChange={(e) => updateFilter('query', e.target.value)}
                placeholder="YouTube বা কমিউনিটির যেকোনো ভিডিও, গান, গজল সার্চ করুন..."
                className="w-full h-11 pl-10 pr-9 rounded-lg border border-slate-800 bg-[#13161D] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
              {filters.query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    const cleared = { ...filters, query: '' };
                    onFiltersChange(cleared);
                    onSearchSubmit(cleared);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="h-11 px-5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-500 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {isSearching ? 'খোঁজা হচ্ছে...' : 'সার্চ'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              className={`h-11 px-3.5 rounded-lg border text-xs font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                showAdvanced
                  ? 'border-rose-500/60 bg-rose-500/10 text-rose-300'
                  : 'border-slate-800 bg-[#13161D] text-slate-300 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              ফিল্টার
            </button>
          </form>

          {/* Workspace Action Controls */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 lg:pb-0">
            <button
              type="button"
              onClick={onOpenUpload}
              className="h-10 px-4 rounded-lg bg-[#191D26] border border-slate-700 text-slate-100 text-xs font-semibold hover:bg-[#222733] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-rose-400" />
              ভিডিও / অডিও আপলোড
            </button>
            <button
              type="button"
              onClick={onOpenPreferences}
              className="h-10 px-4 rounded-lg border border-slate-800 bg-[#13161D] text-slate-200 text-xs font-medium hover:bg-[#191D26] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              ফিড পছন্দ
            </button>
            <PWAInstallButton />
          </div>
        </div>

        {/* Category Segmented Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {MEDIA_CATEGORIES.map((cat) => {
            const active = filters.category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => updateFilter('category', cat.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-rose-600 text-white'
                    : 'bg-[#13161D] text-slate-400 hover:text-slate-100 hover:bg-[#1A1E27]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Advanced Search Filters Row */}
        {showAdvanced && (
          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="filter-source" className="text-xs text-slate-400 whitespace-nowrap">
                উৎস:
              </label>
              <select
                id="filter-source"
                value={filters.source}
                onChange={(e) =>
                  updateFilter('source', e.target.value as SearchFilters['source'])
                }
                className="flex-1 h-9 px-3 rounded-lg border border-slate-800 bg-[#13161D] text-xs text-slate-100 focus:outline-none focus:border-rose-500"
              >
                <option value="all">সব উৎস (YouTube + কমিউনিটি)</option>
                <option value="youtube">শুধু YouTube</option>
                <option value="upload">শুধু অ্যাপ আপলোড</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-duration" className="text-xs text-slate-400 whitespace-nowrap">
                দৈর্ঘ্য:
              </label>
              <select
                id="filter-duration"
                value={filters.duration}
                onChange={(e) =>
                  updateFilter('duration', e.target.value as SearchFilters['duration'])
                }
                className="flex-1 h-9 px-3 rounded-lg border border-slate-800 bg-[#13161D] text-xs text-slate-100 focus:outline-none focus:border-rose-500"
              >
                <option value="any">যেকোনো সময়</option>
                <option value="short">সংক্ষিপ্ত (&lt; ৪ মিনিট)</option>
                <option value="medium">মাঝারি (৪–২০ মিনিট)</option>
                <option value="long">দীর্ঘ (&gt; ২০ মিনিট)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-sort" className="text-xs text-slate-400 whitespace-nowrap">
                সাজানো:
              </label>
              <select
                id="filter-sort"
                value={filters.sort}
                onChange={(e) =>
                  updateFilter('sort', e.target.value as SearchFilters['sort'])
                }
                className="flex-1 h-9 px-3 rounded-lg border border-slate-800 bg-[#13161D] text-xs text-slate-100 focus:outline-none focus:border-rose-500"
              >
                <option value="relevance">সবচেয়ে প্রাসঙ্গিক</option>
                <option value="viewCount">সর্বাধিক জনপ্রিয়</option>
                <option value="date">সর্বশেষ প্রকাশিত</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
