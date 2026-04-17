import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SMQSection from '@/components/SMQSection';

jest.mock('@/lib/api', () => ({
  saveProjectSMQAnswer: jest.fn(),
  generateProjectSMQAnswer: jest.fn(),
  renderLLMErrorMessage: jest.fn((e: any, ctx: string) => `${ctx}: ${String(e?.message || e)}`),
}));

import {
  saveProjectSMQAnswer,
  generateProjectSMQAnswer,
  renderLLMErrorMessage,
} from '@/lib/api';

const mockSave = saveProjectSMQAnswer as jest.Mock;
const mockGenerate = generateProjectSMQAnswer as jest.Mock;

describe('SMQSection', () => {
  const section = {
    id: 'sec-1',
    section_number: 1,
    title: 'Context',
    question_prompts: 'Who are the key stakeholders?',
    order: 1,
  };

  const existingAnswer = {
    id: 'ans-1',
    section_id: 'sec-1',
    section_number: 1,
    section_title: 'Context',
    answer_text: 'Existing answer',
    notes_text: 'Existing notes',
    ai_generated: false,
    is_stale: false,
    last_generated_at: null,
    chunk_ids_used: [],
  };

  const onUpdated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(existingAnswer);
    mockGenerate.mockResolvedValue({
      section_id: 'sec-1',
      answer_text: 'Generated answer',
      notes_text: 'Generated notes',
      ai_generated: true,
      chunk_ids_used: ['c1'],
      citations: [{ doc_name: 'doc.txt', chunk_id: 'c1', snippet: 'Snippet text' }],
    });
  });

  test('renders section title and prompts', () => {
    render(
      <SMQSection
        projectId="proj-1"
        section={section}
        existingAnswer={existingAnswer}
        aiEnabled={true}
        onUpdated={onUpdated}
      />,
    );

    expect(screen.getByText(/1. Context/i)).toBeInTheDocument();
    expect(screen.getByText(/Who are the key stakeholders/i)).toBeInTheDocument();
  });

  test('save success calls API and shows saved message', async () => {
    render(
      <SMQSection
        projectId="proj-1"
        section={section}
        existingAnswer={existingAnswer}
        aiEnabled={true}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Write your answer here/i), {
      target: { value: 'Updated answer' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith('proj-1', 'sec-1', 'Updated answer', 'Existing notes');
      expect(onUpdated).toHaveBeenCalled();
      expect(screen.getByText('Saved.')).toBeInTheDocument();
    });
  });

  test('save failure shows error message', async () => {
    mockSave.mockRejectedValue(new Error('Save failed'));

    render(
      <SMQSection
        projectId="proj-1"
        section={section}
        existingAnswer={existingAnswer}
        aiEnabled={true}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to save answer.')).toBeInTheDocument();
    });
  });

  test('generate success updates answer and shows citations', async () => {
    render(
      <SMQSection
        projectId="proj-1"
        section={section}
        existingAnswer={existingAnswer}
        aiEnabled={true}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Generate with AI/i }));

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith('proj-1', 'sec-1');
      expect(screen.getByDisplayValue('Generated answer')).toBeInTheDocument();
      expect(screen.getByText('Generated with AI.')).toBeInTheDocument();
      expect(screen.getByText(/Citations/i)).toBeInTheDocument();
      expect(screen.getByText(/\[doc.txt\] Snippet text/i)).toBeInTheDocument();
    });
  });

  test('generate error uses LLM error renderer', async () => {
    mockGenerate.mockRejectedValue(new Error('Rate limit'));

    render(
      <SMQSection
        projectId="proj-1"
        section={section}
        existingAnswer={existingAnswer}
        aiEnabled={true}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Generate with AI/i }));

    await waitFor(() => {
      expect(renderLLMErrorMessage).toHaveBeenCalled();
      expect(screen.getByText(/SMQ generation: Rate limit/i)).toBeInTheDocument();
    });
  });

  test('generate button is disabled when aiEnabled=false', () => {
    render(
      <SMQSection
        projectId="proj-1"
        section={section}
        existingAnswer={existingAnswer}
        aiEnabled={false}
        onUpdated={onUpdated}
      />,
    );

    expect(screen.getByRole('button', { name: /Generate with AI/i })).toBeDisabled();
    expect(screen.getByText(/No documents extracted yet/i)).toBeInTheDocument();
  });
});
