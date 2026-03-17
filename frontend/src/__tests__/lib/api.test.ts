/**
 * Tests for the API client (frontend/src/lib/api.ts).
 *
 * Covers:
 * - axios client initialisation (base URL, timeout)
 * - error interceptor behaviour for 404, 429, 500 and network errors
 * - uploadDocument, extractEntities, getEntities, getGraphNodes
 */

import axios from 'axios';
import apiClient, {
  uploadDocument,
  extractEntities,
  getEntities,
  getGraphNodes,
  getDocumentRuns,
  registerUser,
  loginUser,
  logoutUser,
  getStoredAuthToken,
  getStoredAuthUser,
  clearStoredAuth,
} from '@/lib/api';

// ---------------------------------------------------------------------------
// Mock axios so no real HTTP requests are made
// ---------------------------------------------------------------------------
jest.mock('axios', () => {
  const interceptors = {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  };
  const instance = {
    get: jest.fn(),
    post: jest.fn(),
    interceptors,
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => instance),
    },
    // Re-export types so TS is happy
    AxiosError: class AxiosError extends Error {},
  };
});

// Grab the mocked instance that api.ts receives
const mockedAxios = axios.create() as jest.Mocked<ReturnType<typeof axios.create>>;

// ---------------------------------------------------------------------------
// Test: client initialisation
// ---------------------------------------------------------------------------
describe('apiClient initialisation', () => {
  it('creates an axios instance with correct defaults', () => {
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: expect.any(String),
        timeout: 600000,
      }),
    );
  });

  it('registers a response interceptor', () => {
    expect(mockedAxios.interceptors.response.use).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test: error interceptor
// ---------------------------------------------------------------------------
describe('error interceptor', () => {
  // Extract the rejection handler registered with the interceptor
  let rejectHandler: (error: any) => any;

  beforeAll(() => {
    const calls = (mockedAxios.interceptors.response.use as jest.Mock).mock.calls;
    // interceptors.response.use(onFulfilled, onRejected)
    rejectHandler = calls[0][1];
  });

  it('maps 404 responses to "Resource not found"', async () => {
    const error = {
      response: { status: 404, data: {} },
      request: {},
      message: '',
    };
    await expect(rejectHandler(error)).rejects.toThrow('Resource not found');
  });

  it('maps 429 responses to rate-limit message', async () => {
    const error = {
      response: { status: 429, data: { detail: 'slow down' } },
      request: {},
      message: '',
    };
    await expect(rejectHandler(error)).rejects.toThrow('Rate limited. Please try again later');
  });

  it('maps 500 responses to server-error message', async () => {
    const error = {
      response: { status: 500, data: {} },
      request: {},
      message: '',
    };
    await expect(rejectHandler(error)).rejects.toThrow('Server error. Please try again');
  });

  it('maps network errors (no response) to network message', async () => {
    const error = { request: {}, message: 'ECONNREFUSED' };
    await expect(rejectHandler(error)).rejects.toThrow('Network error. Please check your connection');
  });
});

// ---------------------------------------------------------------------------
// Test: uploadDocument
// ---------------------------------------------------------------------------
describe('uploadDocument', () => {
  it('posts multipart form data and returns document info', async () => {
    const fakeResponse = {
      data: {
        id: 'abc-123',
        filename: 'report.pdf',
        file_format: 'pdf',
        upload_timestamp: '2026-03-12T00:00:00Z',
        processing_status: 'completed',
        chunk_count: 5,
      },
    };
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce(fakeResponse);

    const file = new File(['hello'], 'report.pdf', { type: 'application/pdf' });
    const result = await uploadDocument(file);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/v1/documents/',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
    expect(result.id).toBe('abc-123');
    expect(result.chunk_count).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Test: extractEntities
// ---------------------------------------------------------------------------
describe('extractEntities', () => {
  it('calls POST extract-entities and returns count', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { entities_created: 8 },
    });

    const result = await extractEntities('doc-456');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/v1/documents/doc-456/extract-entities/',
      {},
    );
    expect(result.entities_created).toBe(8);
  });

  it('passes provider/model options when supplied', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { entities_created: 3, provider: 'openai', model: 'gpt-5-mini' },
    });

    await extractEntities('doc-999', { provider: 'openai', model: 'gpt-5-mini' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/v1/documents/doc-999/extract-entities/',
      { provider: 'openai', model: 'gpt-5-mini' },
    );
  });
});

// ---------------------------------------------------------------------------
// Test: getEntities
// ---------------------------------------------------------------------------
describe('getEntities', () => {
  it('fetches entities for a document', async () => {
    const entities = [
      { id: '1', canonical_name: 'Alice', entity_type: 'PERSON', confidence: 0.95 },
    ];
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: { entities, total_count: 1 },
    });

    const result = await getEntities('doc-789');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      '/api/v1/documents/doc-789/entities/',
      expect.objectContaining({ params: expect.any(Object) }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].canonical_name).toBe('Alice');
  });

  it('passes optional filters', async () => {
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: { entities: [], total_count: 0 },
    });

    await getEntities('doc-789', { entity_type: 'PERSON', confidence_min: 0.8 });

    expect(mockedAxios.get).toHaveBeenCalledWith(
      '/api/v1/documents/doc-789/entities/',
      expect.objectContaining({
        params: expect.objectContaining({
          entity_type: 'PERSON',
          confidence_min: '0.8',
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Test: getGraphNodes
// ---------------------------------------------------------------------------
describe('getGraphNodes', () => {
  it('fetches Cytoscape nodes for a document', async () => {
    const nodes = [
      {
        data: {
          id: 'n1',
          label: 'UNDP',
          entity_type: 'ORGANIZATION',
          confidence: 0.95,
          document_id: 'doc-111',
          chunk_id: null,
          raw_mentions_count: 1,
          shape: 'round-rectangle',
        },
      },
    ];
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: { nodes, edges: [], total_nodes: 1 },
    });

    const result = await getGraphNodes('doc-111');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      '/api/v1/graph/',
      expect.objectContaining({
        params: expect.objectContaining({ document_id: 'doc-111' }),
      }),
    );
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].label).toBe('UNDP');
  });
});

// ---------------------------------------------------------------------------
// Test: getDocumentRuns
// ---------------------------------------------------------------------------
describe('getDocumentRuns', () => {
  it('fetches run history for a document', async () => {
    const runs = [
      { id: 'run-1', provider: 'openai', model: 'gpt-5-mini' },
    ];
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: { runs, total_count: 1 },
    });

    const result = await getDocumentRuns('doc-222');

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/documents/doc-222/runs/');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('run-1');
  });
});

// ---------------------------------------------------------------------------
// Test: auth APIs
// ---------------------------------------------------------------------------
describe('auth APIs', () => {
  beforeEach(() => {
    clearStoredAuth();
  });

  it('stores token and user on register', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: {
        token: 'token-123',
        user: {
          id: 1,
          username: 'alice',
          email: 'alice@example.com',
          is_admin: false,
        },
      },
    });

    const result = await registerUser({
      username: 'alice',
      email: 'alice@example.com',
      password: 'Password123',
    });

    expect(result.token).toBe('token-123');
    expect(getStoredAuthToken()).toBe('token-123');
    expect(getStoredAuthUser()?.username).toBe('alice');
  });

  it('stores token and user on login', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: {
        token: 'token-abc',
        user: {
          id: 2,
          username: 'admin',
          email: 'admin@example.com',
          is_admin: true,
        },
      },
    });

    const result = await loginUser({ username: 'admin', password: 'Password123' });

    expect(result.user.is_admin).toBe(true);
    expect(getStoredAuthToken()).toBe('token-abc');
    expect(getStoredAuthUser()?.username).toBe('admin');
  });

  it('clears storage on logout', async () => {
    window.localStorage.setItem('sat.auth.token', 'stale-token');
    window.localStorage.setItem(
      'sat.auth.user',
      JSON.stringify({ id: 3, username: 'bob', email: '', is_admin: false })
    );

    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { status: 'logged_out' },
    });

    await logoutUser();

    expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/auth/logout/', {});
    expect(getStoredAuthToken()).toBeNull();
    expect(getStoredAuthUser()).toBeNull();
  });
});
