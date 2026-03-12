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
  useRouter: () => ({ pathname: '/upload', push: mockPush, replace: jest.fn() }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/lib/api', () => ({
  uploadDocument: jest.fn(),
  extractEntities: jest.fn(),
}));

import { uploadDocument, extractEntities } from '@/lib/api';

const mockUpload = uploadDocument as jest.Mock;
const mockExtract = extractEntities as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
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
    mockExtract.mockResolvedValueOnce({ entities_created: 12 });

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

    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(mockExtract).toHaveBeenCalledWith('doc-456');

    // Navigate to entities view
    fireEvent.click(screen.getByText('View Entities'));
    expect(mockPush).toHaveBeenCalledWith('/entities?document_id=doc-456');
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
});
