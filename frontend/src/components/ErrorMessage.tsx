import React from 'react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="bg-red-50/60 border border-red-200/80 rounded-xl p-5 text-center">
      <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-red-700 mb-1">Something went wrong</p>
      <p className="text-red-600/80 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
