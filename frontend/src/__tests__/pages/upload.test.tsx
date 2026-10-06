/**
 * Tests for the Upload page (pages/upload.tsx).
 *
 * Covers:
 * - Initial render (drop zone, step indicator)
 * - File selection & validation
 * - Upload & entity extraction flow
 * - Error states
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UploadPage from '../../../pages/upload';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/upload', query: {}, push: mockPush, replace: jest.fn() }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn().mockReturnValue('test-token'),
  getStoredAuthUser: jest.fn().mockReturnValue({ id: 1, username: 'testuser', is_admin: false }),
  getProjects: jest.fn().mockResolvedValue([]),
  getProject: jest.fn().mockResolvedValue({ id: 'p1', name: 'Test Project' }),
  logoutUser: jest.fn(),
  getProjectReviewCandidates: jest.fn().mockResolvedValue({ results: [], count: 0 }),
  getGlobalEntities: jest.fn().mockResolvedValue({ results: [], count: 0 }),
  uploadDocument: jest.fn(),
  extractEntities: jest.fn(),
  extractEntitiesRelations: jest.fn(),
  getDocuments: jest.fn(() => new Promise(() => {})),
}));

import { uploadDocument, extractEntities, extractEntitiesRelations, getDocuments } from '@/lib/api';

const mockUpload = uploadDocument as jest.Mock;
const mockExtract = extractEntities as jest.Mock;
const mockExtractEntitiesRelations = extractEntitiesRelations as jest.Mock;
const mockGetDocuments = getDocuments as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('UploadPage', () => {
  it('renders the drop zone and step indicator', () => {
    render(<UploadPage />);

    expect(screen.getByText(/drop your file here/i)).toBeInTheDocument();
    // Step indicator labels (also appear in nav, so use getAllByText)
    expect(screen.getAllByText('Upload').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Extract')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  it('shows browse link in drop zone', () => {
    render(<UploadPage />);
    expect(screen.getByText('browse')).toBeInTheDocument();
  });

  it('displays selected file name', () => {
    render(<UploadPage />);

    const file = new File(['hello'], 'report.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('accepts markdown file selection', () => {
    render(<UploadPage />);

    const file = new File(['# heading'], 'notes.md', { type: 'text/markdown' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.queryByText(/unsupported format/i)).not.toBeInTheDocument();
    expect(screen.getByText('notes.md')).toBeInTheDocument();
  });

  it('validates unsupported file formats', () => {
    render(<UploadPage />);

    const file = new File(['data'], 'data.exe', { type: 'application/octet-stream' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText(/unsupported format/i)).toBeInTheDocument();
  });

  it('shows Upload Document button after file selection', () => {
    render(<UploadPage />);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole('button', { name: 'Upload Document' })).toBeInTheDocument();
  });

  it('uploads document and shows Extract button on success', async () => {
    mockUpload.mockResolvedValueOnce({
      id: 'doc-123',
      filename: 'test.pdf',
      file_format: 'pdf',
      upload_timestamp: '2026-03-12T00:00:00Z',
      processing_status: 'completed',
      chunk_count: 3,
    });

    render(<UploadPage />);

    // Select file
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    // Click upload
    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));

    await waitFor(() => {
      expect(screen.getByText('Document Uploaded')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Extract Entities' })).toBeInTheDocument();
    expect(mockUpload).toHaveBeenCalledWith(file);
  });

  it('completes full upload→extract flow and navigates', async () => {
    mockUpload.mockResolvedValueOnce({ id: 'doc-456' });
    mockExtract.mockResolvedValueOnce({
      entities_created: 12,
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      tokens_input: 120,
      tokens_output: 44,
      tokens_cached: 0,
      cost_usd: '0.0000',
    });

    render(<UploadPage />);

    // Select & upload
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Extract Entities' })).toBeInTheDocument();
    });

    // Extract entities
    fireEvent.click(screen.getByRole('button', { name: 'Extract Entities' }));

    await waitFor(() => {
      expect(screen.getByText('Extraction Complete')).toBeInTheDocument();
    });

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(mockExtract).toHaveBeenCalledWith('doc-456', {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
    });
    expect(screen.getByText('Run Metadata')).toBeInTheDocument();
    const metadataPanel = screen.getByText('Run Metadata').closest('div');
    expect(metadataPanel).toHaveTextContent('Provider: groq');

    // Navigate to entities view
    fireEvent.click(screen.getByText('View Entities'));
    expect(mockPush).toHaveBeenCalledWith('/entities');
  });

  it('shows error on upload failure', async () => {
    mockUpload.mockRejectedValueOnce(new Error('Upload failed'));

    render(<UploadPage />);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });
  });

  it('shows error on extraction failure', async () => {
    mockUpload.mockResolvedValueOnce({ id: 'doc-789' });
    mockExtract.mockRejectedValueOnce(new Error('Entity extraction failed'));

    render(<UploadPage />);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Extract Entities' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Extract Entities' }));

    await waitFor(() => {
      expect(screen.getByText('Entity extraction failed')).toBeInTheDocument();
    });
  });

  it('uses selected OpenAI provider/model for extraction', async () => {
    mockUpload.mockResolvedValueOnce({ id: 'doc-openai' });
    mockExtract.mockResolvedValueOnce({
      entities_created: 5,
      provider: 'openai',
      model: 'gpt-5-nano',
      tokens_input: 400,
      tokens_output: 60,
      tokens_cached: 100,
      cost_usd: '0.0001',
    });

    render(<UploadPage />);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Extract Entities' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai' } });
    fireEvent.change(screen.getByLabelText('OpenAI Model'), { target: { value: 'gpt-5-nano' } });

    fireEvent.click(screen.getByRole('button', { name: 'Extract Entities' }));

    await waitFor(() => {
      expect(screen.getByText('Extraction Complete')).toBeInTheDocument();
    });

    expect(mockExtract).toHaveBeenCalledWith('doc-openai', {
      provider: 'openai',
      model: 'gpt-5-nano',
    });
    expect(screen.getByText(/Model:/)).toBeInTheDocument();
    expect(screen.getByText(/gpt-5-nano/i)).toBeInTheDocument();
    expect(screen.getByText(/Cost \(USD\):/)).toBeInTheDocument();
  });

  it('shows "Extract Entities + Relations" button after upload success', async () => {
    mockUpload.mockResolvedValueOnce({
      id: 'doc-er-1',
      filename: 'test.pdf',
      file_format: 'pdf',
      upload_timestamp: '2026-03-12T00:00:00Z',
      processing_status: 'completed',
      chunk_count: 3,
    });

    render(<UploadPage />);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Extract Entities + Relations' })).toBeInTheDocument();
    });
  });

  it('shows completion summary with both entity and relation counts for joint extraction', async () => {
    mockUpload.mockResolvedValueOnce({ id: 'doc-er-2' });
    mockExtractEntitiesRelations.mockResolvedValueOnce({
      entities_created: 7,
      relations_created: 4,
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      tokens_input: 220,
      tokens_output: 80,
      tokens_cached: 0,
      cost_usd: '0.0000',
    });

    render(<UploadPage />);

    const file = new File(['content'], 'joint.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Extract Entities + Relations' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Extract Entities + Relations' }));

    await waitFor(() => {
      expect(screen.getByText('Extraction Complete')).toBeInTheDocument();
    });

    expect(screen.getByText(/Found/i)).toBeInTheDocument();
    expect(screen.getByText(/7/)).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
    expect(mockExtractEntitiesRelations).toHaveBeenCalledWith('doc-er-2', {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
    });
  });

  it('shows relation metadata in Recent Documents when available', async () => {
    mockGetDocuments.mockResolvedValueOnce([
      {
        id: 'doc-list-1',
        filename: 'relations.pdf',
        file_format: 'pdf',
        upload_timestamp: '2026-03-12T00:00:00Z',
        processing_status: 'completed',
        chunk_count: 5,
        entity_count: 9,
        relation_count: 3,
      },
    ]);

    render(<UploadPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Documents')).toBeInTheDocument();
    });

    expect(screen.getByText(/3 relations/i)).toBeInTheDocument();
  });
});
