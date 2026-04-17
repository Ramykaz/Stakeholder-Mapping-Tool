import React from 'react';

interface AIGeneratedBadgeProps {
  model?: string;
  className?: string;
}

export default function AIGeneratedBadge({ model, className = '' }: AIGeneratedBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300 ${className}`}
      title={model ? `AI-generated content using ${model}` : 'AI-generated content'}
      aria-label={model ? `AI generated using ${model}` : 'AI generated'}
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 1a.5.5 0 0 1 .5.5v1.586l1.121-1.122a.5.5 0 1 1 .708.708L9.207 3.793A4 4 0 0 1 12 7.5h.5a.5.5 0 0 1 0 1H12a4 4 0 0 1-2.793 3.793l1.122 1.121a.5.5 0 0 1-.708.708L8.5 12.914V14.5a.5.5 0 0 1-1 0v-1.586l-1.121 1.122a.5.5 0 0 1-.708-.708L6.793 12.207A4 4 0 0 1 4 8.5H3.5a.5.5 0 0 1 0-1H4a4 4 0 0 1 2.793-3.793L5.671 2.586a.5.5 0 1 1 .708-.708L7.5 3l.001-1.5A.5.5 0 0 1 8 1zm0 3a3 3 0 1 0 0 6A3 3 0 0 0 8 4zm0 1a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
      </svg>
      AI Generated
    </span>
  );
}
