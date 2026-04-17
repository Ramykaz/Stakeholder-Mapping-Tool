import React, { useState } from 'react';
import { apiClient } from '../lib/api';

export type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'flag';
export type ContextType = 'nl_query' | 'summary' | 'report' | 'persona' | 'workplan' | 'smq';

interface AIFeedbackProps {
  projectId: string;
  contextType: ContextType;
  contextId?: string;
  className?: string;
}

export default function AIFeedback({
  projectId,
  contextType,
  contextId,
  className = '',
}: AIFeedbackProps) {
  const [submitted, setSubmitted] = useState<FeedbackType | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFeedback(feedbackType: FeedbackType) {
    if (submitted || loading) return;
    setLoading(true);
    try {
      await apiClient.post(`/api/v1/projects/${projectId}/ai-feedback/`, {
        feedback_type: feedbackType,
        context_type: contextType,
        context_id: contextId || null,
      });
      setSubmitted(feedbackType);
    } catch {
      // Feedback is best-effort; silently ignore errors
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <span className={`text-xs text-gray-400 ${className}`} aria-live="polite">
        {submitted === 'thumbs_up' ? 'Thanks for the feedback!' : submitted === 'flag' ? 'Content flagged.' : 'Feedback noted.'}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`} aria-label="Rate this AI response">
      <span className="text-xs text-gray-500 mr-1">Helpful?</span>
      <button
        type="button"
        onClick={() => handleFeedback('thumbs_up')}
        disabled={loading}
        aria-label="This response was helpful"
        title="Helpful"
        className="rounded p-1 text-gray-400 transition-colors hover:bg-green-500/10 hover:text-green-400 focus:outline-none focus:ring-1 focus:ring-green-400 disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => handleFeedback('thumbs_down')}
        disabled={loading}
        aria-label="This response was not helpful"
        title="Not helpful"
        className="rounded p-1 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => handleFeedback('flag')}
        disabled={loading}
        aria-label="Flag this response as problematic"
        title="Flag"
        className="rounded p-1 text-gray-400 transition-colors hover:bg-yellow-500/10 hover:text-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      </button>
    </div>
  );
}
