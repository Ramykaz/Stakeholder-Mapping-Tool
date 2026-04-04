import React from 'react';

interface StalenessNoticeProps {
  title?: string;
  onRegenerate: () => void;
  onKeepCurrent: () => void;
  isRegenerating?: boolean;
}

export default function StalenessNotice({
  title = 'New data available — regenerate to include the latest findings.',
  onRegenerate,
  onKeepCurrent,
  isRegenerating = false,
}: StalenessNoticeProps) {
  return (
    <div
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-lg border"
      style={{
        background: '#FFFBEB',
        borderColor: '#F59E0B',
      }}
    >
      <div className="flex items-start gap-2">
        <svg
          className="w-4 h-4 mt-0.5 shrink-0"
          style={{ color: '#D97706' }}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm font-medium" style={{ color: '#92400E' }}>
          {title}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="text-sm px-3 py-1.5 rounded font-medium transition-opacity disabled:opacity-60 flex items-center gap-1.5"
          style={{ background: '#F59E0B', color: 'white' }}
        >
          {isRegenerating && (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isRegenerating ? 'Regenerating…' : 'Regenerate this section'}
        </button>
        <button
          onClick={onKeepCurrent}
          disabled={isRegenerating}
          className="text-sm px-3 py-1.5 rounded font-medium border transition-opacity disabled:opacity-60"
          style={{ borderColor: '#F59E0B', color: '#92400E', background: 'transparent' }}
        >
          Keep current version
        </button>
      </div>
    </div>
  );
}
