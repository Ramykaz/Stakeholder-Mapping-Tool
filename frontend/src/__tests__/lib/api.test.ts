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
  getProjectGraph,
  getEntityProfile,
  generateEntitySummary,
  getDocumentRuns,
  upsertProjectIntake,
  getProjectContextPreview,
  generateProjectReport,
  stopProjectReportGeneration,
  regenerateProjectReportSection,
  saveProjectReportSection,
  exportProjectReportPdf,
  getProjectStakeholderPriority,
  generateProjectStakeholderNotes,
  exportProjectStakeholderPriorityCsv,
  exportProjectStakeholderPriorityPdf,
  exportProjectStakeholderPriorityDocx,
  uploadDocumentToProject,
  getProjectDocuments,
  getProjectWebSources,
  createProjectWebSource,
  deleteProjectWebSource,
  deleteProjectDocument,
  getProjectDocumentStatus,
  getProjectDocumentEntities,
  getProjectDocumentRelationships,
  getProjectDocumentContext,
  updateProjectEntity,
  deleteProjectDocumentEntity,
  updateProjectDocumentRelationship,
  deleteProjectDocumentRelationship,
  extractEntitiesForProject,
  getProjectExtractionStatus,
  stopProjectExtraction,
  getCurrentUser,
  updateUserProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  queryProjectGraph,
  getProjectDocumentsWithStats,
  getProjectFlaggedCount,
  flagProjectOrphanStakeholders,
  getProjectReviewCandidates,
  resolveReviewCandidate,
  getEntityTimeline,
  getGlobalEntities,
  getProjectProviders,
  updateProjectProvider,
  testLLMConnection,
  adminListUsers,
  adminUpdateUser,
  adminDeleteUser,
  adminGetStats,
  adminGetAllProjects,
  adminGetActivity,
  getUserFlaggedEntities,
  downloadProjectExport,
  getProjectWorkflow,
  getProjectPersonas,
  getProjectPersonaGenerationStatus,
  generateProjectPersonas,
  getProjectWorkplan,
  getProjectWorkplanStatus,
  generateProjectWorkplan,
  getReportStaleness,
  keepReportSectionCurrent,
  keepStakeholderTableCurrent,
  getReportExportStatus,
  downloadReportPdf,
  downloadReportDocx,
  downloadWorkplanPdf,
  downloadWorkplanDocx,
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
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
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
    await expect(rejectHandler(error)).rejects.toThrow('slow down');
  });

  it('maps provider-specific 429 responses to remediation message', async () => {
    const error = {
      response: {
        status: 429,
        data: {
          error: {
            code: 'PROVIDER_RATE_LIMITED',
            message: 'groq is currently rate limited.',
            remediation: ['Switch to OpenAI provider in the extraction controls and retry.'],
          },
        },
      },
      request: {},
      message: '',
    };
    await expect(rejectHandler(error)).rejects.toThrow('Provider is rate-limited');
  });

  it('maps provider_error 429 payloads to remediation message', async () => {
    const error = {
      response: {
        status: 429,
        data: {
          error: 'llm_error',
          code: 'provider_rate_limited',
          error_kind: 'rate_limit',
          provider_error: {
            code: 'PROVIDER_RATE_LIMITED',
            message: 'groq is currently rate limited.',
            remediation: ['Switch to OpenAI provider in the extraction controls and retry.'],
          },
        },
      },
      request: {},
      message: '',
    };
    await expect(rejectHandler(error)).rejects.toThrow('Provider is rate-limited');
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
    expect(result.nodes[0].style.shape).toBe('round-rectangle');
    expect(result.nodes[0].degree).toBe(0);
  });
});

describe('project graph + summary/profile APIs', () => {
  it('maps enhanced project graph payload fields', async () => {
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: {
        nodes: [
          {
            id: 'n1',
            label: 'UNDP',
            entity_type: 'ORGANIZATION',
            degree: 3,
            style: { shape: 'rectangle', color: '#2563eb' },
            data: {
              id: 'n1',
              label: 'UNDP',
              entity_type: 'ORGANIZATION',
              confidence: 0.95,
              shape: 'rectangle',
              color: '#2563eb',
              degree: 3,
            },
          },
        ],
        edges: [],
      },
    });

    const result = await getProjectGraph('project-1');
    expect(result.nodes[0].style.color).toBe('#2563eb');
    expect(result.nodes[0].data.degree).toBe(3);
  });

  it('calls entity profile endpoint', async () => {
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: { id: 'e1', canonical_name: 'UNDP', entity_type: 'ORGANIZATION', projects: [] },
    });

    const profile = await getEntityProfile('e1');
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/entities/e1/profile/');
    expect(profile.id).toBe('e1');
  });

  it('calls contextual summary endpoint with refresh flag', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: {
        entity_id: 'e1',
        project_id: 'p1',
        summary: 'Narrative',
        source: 'provider',
      },
    });

    const summary = await generateEntitySummary('e1', 'p1', true);
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/entities/e1/summary/', {
      project_id: 'p1',
      refresh: true,
    });
    expect(summary.summary).toBe('Narrative');
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

describe('project intake + context APIs', () => {
  it('patches intake payload and returns saved profile', async () => {
    (mockedAxios.patch as jest.Mock).mockResolvedValueOnce({
      data: {
        initiative_name: 'Regional Livelihoods Program',
        host_organization: 'UNDP',
      },
    });

    const payload = {
      initiative_name: 'Regional Livelihoods Program',
      host_organization: 'UNDP',
      country: 'Kenya',
    };

    const result = await upsertProjectIntake('project-1', payload);

    expect(mockedAxios.patch).toHaveBeenCalledWith('/api/v1/projects/project-1/intake/', payload);
    expect(result.initiative_name).toBe('Regional Livelihoods Program');
  });

  it('loads context preview for a project', async () => {
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: {
        project: 'project-1',
        context: 'Synthesized context preview',
      },
    });

    const result = await getProjectContextPreview('project-1');

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/project-1/context-preview/');
    expect(result.context).toBe('Synthesized context preview');
  });
});

describe('project report APIs', () => {
  it('starts report generation with default sections=all', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { status: 'queued', sections_queued: 5, message: 'Queued' },
    });

    const result = await generateProjectReport('project-1');

    expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/projects/project-1/report/generate/', {
      sections: 'all',
    });
    expect(result.sections_queued).toBe(5);
  });

  it('stops report generation', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { status: 'stopped', revoked_tasks: 2, sections_updated: 2 },
    });

    const result = await stopProjectReportGeneration('project-1');

    expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/projects/project-1/report/stop/', {});
    expect(result.revoked_tasks).toBe(2);
  });

  it('regenerates one section and normalizes missing custom instruction', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { status: 'queued', section_id: 'stakeholders' },
    });

    const result = await regenerateProjectReportSection('project-1', 'stakeholders');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/v1/projects/project-1/report/regenerate/stakeholders/',
      { custom_instruction: '' },
    );
    expect(result.section_id).toBe('stakeholders');
  });

  it('saves edited report section text', async () => {
    (mockedAxios.put as jest.Mock).mockResolvedValueOnce({
      data: {
        id: 'stakeholders',
        title: 'Stakeholder Mapping',
        generated_text: 'Updated narrative',
      },
    });

    const result = await saveProjectReportSection('project-1', 'stakeholders', 'Updated narrative');

    expect(mockedAxios.put).toHaveBeenCalledWith('/api/v1/projects/project-1/report/stakeholders/', {
      generated_text: 'Updated narrative',
    });
    expect(result.generated_text).toBe('Updated narrative');
  });

  it('exports report pdf as blob', async () => {
    const blob = new Blob(['pdf-content'], { type: 'application/pdf' });
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({ data: blob });

    const result = await exportProjectReportPdf('project-1');

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/project-1/report/export/?format=pdf', {
      responseType: 'blob',
    });
    expect(result).toBe(blob);
  });
});

describe('project stakeholder priority APIs', () => {
  it('fetches stakeholder priority with query params', async () => {
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: { results: [], count: 0, next: null, previous: null },
    });

    await getProjectStakeholderPriority('project-1', { entity_type: 'PERSON', page: 2 });

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/project-1/stakeholders/priority/', {
      params: { entity_type: 'PERSON', page: 2 },
    });
  });

  it('starts stakeholder note generation with default payload', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { status: 'running', total_target: 20, completed_count: 0, current_index: 0 },
    });

    const result = await generateProjectStakeholderNotes('project-1');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/v1/projects/project-1/stakeholders/priority/generate-notes/',
      { action: 'start', max_items: 20 },
    );
    expect(result.status).toBe('running');
  });

  it('exports stakeholder priority files in csv/pdf/docx formats', async () => {
    const csvBlob = new Blob(['csv'], { type: 'text/csv' });
    const pdfBlob = new Blob(['pdf'], { type: 'application/pdf' });
    const docxBlob = new Blob(['docx'], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    (mockedAxios.get as jest.Mock)
      .mockResolvedValueOnce({ data: csvBlob })
      .mockResolvedValueOnce({ data: pdfBlob })
      .mockResolvedValueOnce({ data: docxBlob });

    const csv = await exportProjectStakeholderPriorityCsv('project-1', 'PERSON', 10);
    const pdf = await exportProjectStakeholderPriorityPdf('project-1', undefined, 15);
    const docx = await exportProjectStakeholderPriorityDocx('project-1', 'ORGANIZATION', 25);

    const lastThreeGetCalls = (mockedAxios.get as jest.Mock).mock.calls.slice(-3);
    expect(lastThreeGetCalls).toEqual([
      [
        '/api/v1/projects/project-1/stakeholders/priority/export/csv/',
        {
          params: { entity_type: 'PERSON', limit: 10 },
          responseType: 'blob',
        },
      ],
      [
        '/api/v1/projects/project-1/stakeholders/priority/export/pdf/',
        {
          params: { limit: 15 },
          responseType: 'blob',
        },
      ],
      [
        '/api/v1/projects/project-1/stakeholders/priority/export/docx/',
        {
          params: { entity_type: 'ORGANIZATION', limit: 25 },
          responseType: 'blob',
        },
      ],
    ]);
    expect(csv).toBe(csvBlob);
    expect(pdf).toBe(pdfBlob);
    expect(docx).toBe(docxBlob);
  });
});

describe('project document and extraction APIs', () => {
  it('uploads project document with multipart payload', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { id: 'doc-1', filename: 'brief.pdf' },
    });

    const file = new File(['hello'], 'brief.pdf', { type: 'application/pdf' });
    const result = await uploadDocumentToProject('project-1', file);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/v1/projects/project-1/documents/',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );
    expect(result.id).toBe('doc-1');
  });

  it('gets project docs and web sources with empty fallbacks', async () => {
    (mockedAxios.get as jest.Mock)
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null });

    const docs = await getProjectDocuments('project-1');
    const sources = await getProjectWebSources('project-1');

    const lastTwoGetCalls = (mockedAxios.get as jest.Mock).mock.calls.slice(-2);
    expect(lastTwoGetCalls).toEqual([
      ['/api/v1/projects/project-1/documents/'],
      ['/api/v1/projects/project-1/web-sources/'],
    ]);
    expect(docs).toEqual([]);
    expect(sources).toEqual([]);
  });

  it('creates and deletes web sources/documents', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { id: 'ws-1', source_type: 'url' },
    });
    (mockedAxios.delete as jest.Mock)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const created = await createProjectWebSource('project-1', {
      source_type: 'url',
      url: 'https://example.org',
    });
    await deleteProjectWebSource('project-1', 'ws-1');
    await deleteProjectDocument('project-1', 'doc-1');

    expect(created.id).toBe('ws-1');
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/projects/project-1/web-sources/', {
      source_type: 'url',
      url: 'https://example.org',
    });
    expect(mockedAxios.delete).toHaveBeenNthCalledWith(1, '/api/v1/projects/project-1/web-sources/ws-1/');
    expect(mockedAxios.delete).toHaveBeenNthCalledWith(2, '/api/v1/projects/project-1/documents/doc-1/');
  });

  it('gets project document status/entities/relationships', async () => {
    (mockedAxios.get as jest.Mock)
      .mockResolvedValueOnce({ data: { id: 'doc-1', processing_status: 'completed' } })
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null });

    const status = await getProjectDocumentStatus('project-1', 'doc-1');
    const entities = await getProjectDocumentEntities('project-1', 'doc-1');
    const relationships = await getProjectDocumentRelationships('project-1', 'doc-1');

    expect(status.id).toBe('doc-1');
    expect(entities).toEqual([]);
    expect(relationships).toEqual([]);
  });

  it('builds context query with trimmed focus terms', async () => {
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: { context: 'Focused context' },
    });

    const result = await getProjectDocumentContext('project-1', 'doc-1', ['  UNDP  ', '', 'WHO']);

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/project-1/documents/doc-1/context/?focus=UNDP&focus=WHO');
    expect(result.context).toBe('Focused context');
  });

  it('updates and deletes review entities/relationships', async () => {
    (mockedAxios.patch as jest.Mock)
      .mockResolvedValueOnce({ data: { status: 'ok' } })
      .mockResolvedValueOnce({ data: { status: 'ok' } });
    (mockedAxios.delete as jest.Mock)
      .mockResolvedValueOnce({ data: { status: 'deleted' } })
      .mockResolvedValueOnce({ data: { status: 'deleted' } });

    const updatedEntity = await updateProjectEntity('project-1', 'ent-1', { canonical_name: 'UNDP HQ' });
    const deletedEntity = await deleteProjectDocumentEntity('project-1', 'doc-1', 'ent-1');
    const updatedRel = await updateProjectDocumentRelationship('project-1', 'doc-1', 'rel-1', 'PARTNERS_WITH');
    const deletedRel = await deleteProjectDocumentRelationship('project-1', 'doc-1', 'rel-1');

    expect(updatedEntity.status).toBe('ok');
    expect(deletedEntity.status).toBe('deleted');
    expect(updatedRel.status).toBe('ok');
    expect(deletedRel.status).toBe('deleted');
  });

  it('extracts entities for project with payload options and status calls', async () => {
    (mockedAxios.post as jest.Mock)
      .mockResolvedValueOnce({ data: { status: 'queued', entities_created: 0, relations_created: 0 } })
      .mockResolvedValueOnce({ data: { status: 'stopped', project_id: 'project-1', cancel_requested: true } });
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({ data: { status: 'running' } });

    await extractEntitiesForProject('project-1', 'doc-1', { provider: 'openai', model: 'gpt-5-mini' as any });
    const extractionStatus = await getProjectExtractionStatus('project-1');
    const stopResult = await stopProjectExtraction('project-1');

    expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/projects/project-1/extract-entities/', {
      document_id: 'doc-1',
      provider: 'openai',
      model: 'gpt-5-mini',
    });
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/project-1/extract-entities/status/');
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/projects/project-1/extract-entities/stop/');
    expect(extractionStatus.status).toBe('running');
    expect(stopResult.cancel_requested).toBe(true);
  });
});

describe('auth profile + query wrappers', () => {
  beforeEach(() => {
    clearStoredAuth();
  });

  it('loads current user and syncs auth user when token exists', async () => {
    window.localStorage.setItem('sat.auth.token', 'token-current');
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: {
        user: { id: 9, username: 'current', email: 'current@example.com', is_admin: false },
      },
    });

    const result = await getCurrentUser();

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/auth/me/');
    expect(result.username).toBe('current');
    expect(getStoredAuthUser()?.username).toBe('current');
  });

  it('updates profile and rotates local auth user; change password rotates token', async () => {
    window.localStorage.setItem('sat.auth.token', 'token-old');
    (mockedAxios.patch as jest.Mock).mockResolvedValueOnce({
      data: {
        user: { id: 1, username: 'updated', email: 'updated@example.com', is_admin: false },
      },
    });
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: {
        token: 'token-new',
        user: { id: 1, username: 'updated', email: 'updated@example.com', is_admin: false },
      },
    });

    const profile = await updateUserProfile({ username: 'updated' });
    const passwordResult = await changePassword({ current_password: 'old', new_password: 'new' });

    expect(profile.username).toBe('updated');
    expect(passwordResult.token).toBe('token-new');
    expect(getStoredAuthToken()).toBe('token-new');
  });

  it('calls forgot/reset password and project graph query endpoints', async () => {
    (mockedAxios.post as jest.Mock)
      .mockResolvedValueOnce({ data: { detail: 'sent' } })
      .mockResolvedValueOnce({ data: { detail: 'reset' } })
      .mockResolvedValueOnce({ data: { query: 'q', answer: 'a', is_nl_query: true, entity_ids: ['e1'], count: 1 } });

    const forgot = await forgotPassword('alice@example.com');
    const reset = await resetPassword({ uid: 'u', token: 't', new_password: 'Pass123!' });
    const query = await queryProjectGraph('project-1', 'who funds undp');

    expect(forgot.detail).toBe('sent');
    expect(reset.detail).toBe('reset');
    expect(query.answer).toBe('a');
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/projects/project-1/query/', { query: 'who funds undp' });
  });

  it('calls list wrappers for docs stats, flagged count, review, timeline, entities, and providers', async () => {
    (mockedAxios.get as jest.Mock)
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { flagged_count: 5 } })
      .mockResolvedValueOnce({ data: { results: [], pending_count: 0, count: 0 } })
      .mockResolvedValueOnce({ data: { timeline: [] } })
      .mockResolvedValueOnce({ data: { results: [], count: 0, next: null, previous: null } })
      .mockResolvedValueOnce({ data: { current_provider: 'groq', current_model: 'llama3', providers: [] } })
      .mockResolvedValueOnce({ data: { provider: 'groq', model: 'llama3', status: 'ok', error_message: null, latency_ms: 20 } });
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ data: { id: 'cand-1', status: 'merged', resolved_at: 'now' } });
    (mockedAxios.patch as jest.Mock).mockResolvedValueOnce({ data: { id: 'p1', provider: 'openai', model: 'gpt-4o' } });

    const docsWithStats = await getProjectDocumentsWithStats('project-1');
    const flaggedCount = await getProjectFlaggedCount('project-1');
    const review = await getProjectReviewCandidates('project-1');
    const resolved = await resolveReviewCandidate('cand-1', 'merge');
    const timeline = await getEntityTimeline('ent-1', 'project-1');
    const globalEntities = await getGlobalEntities({ page: 1, search: 'undp' });
    const providers = await getProjectProviders('project-1');
    const updatedProvider = await updateProjectProvider('project-1', 'openai', 'gpt-4o');
    const llmTest = await testLLMConnection('groq', 'llama3');

    expect(docsWithStats).toEqual([]);
    expect(flaggedCount).toBe(5);
    expect(review.pending_count).toBe(0);
    expect(resolved.status).toBe('merged');
    expect(timeline.timeline).toEqual([]);
    expect(globalEntities.results).toEqual([]);
    expect(providers.current_provider).toBe('groq');
    expect(updatedProvider.provider).toBe('openai');
    expect(llmTest.status).toBe('ok');
  });

  it('flags orphan stakeholders for a project', async () => {
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: {
        project_id: 'proj-1',
        flagged_count: 2,
        flagged_entity_ids: ['e1', 'e2'],
        detail: 'Flagged 2 isolated stakeholder(s).',
      },
    });

    const result = await flagProjectOrphanStakeholders('proj-1');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/stakeholders/priority/flag-orphans/',
      {},
    );
    expect(result.flagged_count).toBe(2);
    expect(result.flagged_entity_ids).toEqual(['e1', 'e2']);
  });
});

describe('admin + workflow + export wrappers', () => {
  it('calls admin endpoints and unwraps nested admin user payload', async () => {
    (mockedAxios.get as jest.Mock)
      .mockResolvedValueOnce({ data: { results: [], count: 0, page: 1 } })
      .mockResolvedValueOnce({ data: { users: 10, active_users: 8, admin_users: 1, projects: 2, documents: 5, entities: 12, flagged_entities: 1, relations: 9 } })
      .mockResolvedValueOnce({ data: { results: [], count: 0 } })
      .mockResolvedValueOnce({ data: { results: [], count: 0 } })
      .mockResolvedValueOnce({ data: { flagged_entities: [], count: 0 } });
    (mockedAxios.patch as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 2, username: 'u', email: 'u@example.com', is_admin: true, is_active: true, date_joined: null } },
    });
    (mockedAxios.delete as jest.Mock).mockResolvedValueOnce({});

    const users = await adminListUsers({ page: 1, search: 'a' });
    const updated = await adminUpdateUser(2, { is_admin: true });
    await adminDeleteUser(2);
    const stats = await adminGetStats();
    const projects = await adminGetAllProjects({ page: 1 });
    const activity = await adminGetActivity({ page: 1 });
    const flagged = await getUserFlaggedEntities();

    expect(users.count).toBe(0);
    expect(updated.is_admin).toBe(true);
    expect(stats.users).toBe(10);
    expect(projects.count).toBe(0);
    expect(activity.count).toBe(0);
    expect(flagged.count).toBe(0);
  });

  it('normalizes workflow legacy map URL and calls staleness helpers', async () => {
    (mockedAxios.get as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          current_step: 3,
          steps: [
            { number: 4, label: 'Map', complete: false, url: '/projects/proj-1/', description: 'Map view' },
          ],
          next_step: { number: 4, label: 'Map', complete: false, url: '/projects/proj-1/', description: 'Map view' },
        },
      })
      .mockResolvedValueOnce({ data: { stale_sections: [1], stakeholder_table_stale: true, new_entity_count: 2 } })
      .mockResolvedValueOnce({ data: { can_export: true, complete_sections: 2, total_sections: 6, has_stakeholder_table: true, has_personas: false, has_workplan: false, section_statuses: [] } });
    (mockedAxios.patch as jest.Mock).mockResolvedValueOnce({ data: { status: 'ok', section_id: '1' } });
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({ data: { status: 'ok', stakeholder_table_stale: false } });

    const workflow = await getProjectWorkflow('proj-1');
    const staleness = await getReportStaleness('proj-1');
    const keepSection = await keepReportSectionCurrent('proj-1', '1');
    const keepTable = await keepStakeholderTableCurrent('proj-1');
    const exportStatus = await getReportExportStatus('proj-1');

    expect(workflow.steps[0].url).toBe('/projects/proj-1/map');
    expect(workflow.next_step?.url).toBe('/projects/proj-1/map');
    expect(staleness.new_entity_count).toBe(2);
    expect(keepSection.status).toBe('ok');
    expect(keepTable.stakeholder_table_stale).toBe(false);
    expect(exportStatus.can_export).toBe(true);
  });

  it('calls persona list and persona generate endpoints', async () => {
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: { count: 1, results: [{
        id: 'persona-1',
        entity_type_id: 'label-1',
        entity_type_label: 'Organization',
        persona_name: 'Bridge Builder',
        archetype_label: 'Collaborator',
        demographics: 'Leads cross-sector initiatives',
        motivations: ['Improve coordination'],
        frustrations: ['Slow approvals'],
        representative_entities: [{ id: 'ent-1', name: 'UNDP' }],
        generated_at: '2026-04-16T00:00:00Z',
      }] },
    });
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { status: 'queued', message: 'Persona generation started' },
    });

    const personas = await getProjectPersonas('proj-1');
    const generation = await generateProjectPersonas('proj-1');

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/proj-1/personas/');
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/projects/proj-1/personas/generate/');
    expect(personas.count).toBe(1);
    expect(generation.status).toBe('queued');
  });

  it('calls persona generation status endpoint', async () => {
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: {
        generated: true,
        count: 3,
        generation_status: 'completed',
        generation_message: 'done',
      },
    });

    const status = await getProjectPersonaGenerationStatus('proj-1');

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/proj-1/personas/status/');
    expect(status.count).toBe(3);
    expect(status.generation_status).toBe('completed');
  });

  it('calls workplan list/status/generate endpoints', async () => {
    (mockedAxios.get as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          project: 'proj-1',
          generated: true,
          components: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          generated: true,
          section_6_complete: true,
          component_count: 2,
          task_count: 5,
          generation_status: 'completed',
          generation_message: 'done',
        },
      });
    (mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { status: 'queued', message: 'Workplan generation started' },
    });

    const workplan = await getProjectWorkplan('proj-1');
    const status = await getProjectWorkplanStatus('proj-1');
    const generation = await generateProjectWorkplan('proj-1');

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/proj-1/workplan/');
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/proj-1/workplan/status/');
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/v1/projects/proj-1/workplan/generate/');
    expect(workplan.generated).toBe(true);
    expect(status.component_count).toBe(2);
    expect(generation.status).toBe('queued');
  });

  it('keeps non-legacy workflow URLs unchanged and preserves null next_step', async () => {
    (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
      data: {
        current_step: 2,
        steps: [
          { number: 2, label: 'Documents', complete: true, url: '/projects/proj-1/documents', description: 'Docs' },
          { number: 4, label: 'Map', complete: false, url: '/projects/proj-1/map', description: 'Map view' },
        ],
        next_step: null,
      },
    });

    const workflow = await getProjectWorkflow('proj-1');

    expect(workflow.steps[0].url).toBe('/projects/proj-1/documents');
    expect(workflow.steps[1].url).toBe('/projects/proj-1/map');
    expect(workflow.next_step).toBeNull();
  });

  it('downloads project/report/workplan files using blob links', async () => {
    const previousCreateObjectURL = (global as any).URL.createObjectURL;
    const previousRevokeObjectURL = (global as any).URL.revokeObjectURL;
    const createObjectURLSpy = jest.fn(() => 'blob:test-url');
    const revokeObjectURLSpy = jest.fn();
    (global as any).URL.createObjectURL = createObjectURLSpy;
    (global as any).URL.revokeObjectURL = revokeObjectURLSpy;
    const realCreateElement = document.createElement.bind(document);
    const clickSpy = jest.fn();
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { value: clickSpy });
      }
      return element;
    });

    (mockedAxios.get as jest.Mock)
      .mockResolvedValueOnce({ data: new Blob(['csv']), headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="entities.csv"' } })
      .mockResolvedValueOnce({ data: new Blob(['pdf']), headers: {} })
      .mockResolvedValueOnce({ data: new Blob(['docx']), headers: {} })
      .mockResolvedValueOnce({ data: new Blob(['wp-pdf']), headers: {} })
      .mockResolvedValueOnce({ data: new Blob(['wp-docx']), headers: {} });

    await downloadProjectExport('project-1', 'entities');
    await downloadReportPdf('project-1');
    await downloadReportDocx('project-1');
    await downloadWorkplanPdf('project-1');
    await downloadWorkplanDocx('project-1');

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/project-1/export/entities.csv', { responseType: 'blob' });
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/project-1/report/export/?format=pdf', { responseType: 'blob' });
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/project-1/report/export/?format=docx', { responseType: 'blob' });
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/project-1/workplan/export/?format=pdf', { responseType: 'blob' });
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/projects/project-1/workplan/export/?format=docx', { responseType: 'blob' });
    expect(clickSpy).toHaveBeenCalledTimes(5);
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    (global as any).URL.createObjectURL = previousCreateObjectURL;
    (global as any).URL.revokeObjectURL = previousRevokeObjectURL;
  });

  it('uses content-disposition filenames for report/workplan downloads', async () => {
    const previousCreateObjectURL = (global as any).URL.createObjectURL;
    const previousRevokeObjectURL = (global as any).URL.revokeObjectURL;
    const createObjectURLSpy = jest.fn(() => 'blob:test-url');
    const revokeObjectURLSpy = jest.fn();
    (global as any).URL.createObjectURL = createObjectURLSpy;
    (global as any).URL.revokeObjectURL = revokeObjectURLSpy;

    const realCreateElement = document.createElement.bind(document);
    const createdAnchors: HTMLAnchorElement[] = [];
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { value: jest.fn() });
        createdAnchors.push(element as HTMLAnchorElement);
      }
      return element;
    });

    (mockedAxios.get as jest.Mock)
      .mockResolvedValueOnce({ data: new Blob(['pdf']), headers: { 'content-disposition': 'attachment; filename="custom_report.pdf"' } })
      .mockResolvedValueOnce({ data: new Blob(['docx']), headers: { 'content-disposition': 'attachment; filename="custom_report.docx"' } })
      .mockResolvedValueOnce({ data: new Blob(['wp-pdf']), headers: { 'content-disposition': 'attachment; filename="custom_workplan.pdf"' } })
      .mockResolvedValueOnce({ data: new Blob(['wp-docx']), headers: { 'content-disposition': 'attachment; filename="custom_workplan.docx"' } });

    await downloadReportPdf('project-1');
    await downloadReportDocx('project-1');
    await downloadWorkplanPdf('project-1');
    await downloadWorkplanDocx('project-1');

    expect(createdAnchors).toHaveLength(4);
    expect(createdAnchors[0].download).toBe('custom_report.pdf');
    expect(createdAnchors[1].download).toBe('custom_report.docx');
    expect(createdAnchors[2].download).toBe('custom_workplan.pdf');
    expect(createdAnchors[3].download).toBe('custom_workplan.docx');

    createElementSpy.mockRestore();
    (global as any).URL.createObjectURL = previousCreateObjectURL;
    (global as any).URL.revokeObjectURL = previousRevokeObjectURL;
  });
});
