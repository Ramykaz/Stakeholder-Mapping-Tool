import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-[3px]',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div
        className={`${sizeClasses[size]} rounded-full animate-spin`}
        style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--accent)' }}
      />
      {message && (
        <p className="mt-4 text-sm" style={{ color: 'var(--text3)' }}>{message}</p>
      )}
    </div>
  );
}
