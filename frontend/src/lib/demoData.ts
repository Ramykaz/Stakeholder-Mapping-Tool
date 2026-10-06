// ─────────────────────────────────────────────────────────────────────────────
// Demo mode — a fully frontend-only, canned dataset that lets anyone click
// through the entire product (graph, entities, SMQ, report, personas,
// workplan, stakeholders) without touching the real backend at all.
//
// Why this exists: the real backend runs on a free-tier host that can be slow
// or cold-start, which is a bad first impression for someone evaluating the
// project (e.g. a recruiter) who just wants to see it work. Demo mode never
// makes a network call — every request for the reserved "demo" project is
// intercepted in api.ts and answered from this file instead.
// ─────────────────────────────────────────────────────────────────────────────

import { getEntityColor } from './entityTypes';

export const DEMO_PROJECT_ID = 'demo';

const DEMO_MODE_KEY = 'sat.demo.active';
const AUTH_TOKEN_KEY = 'sat.auth.token';
const AUTH_USER_KEY = 'sat.auth.user';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function isDemoModeActive(): boolean {
  return isBrowser() && window.localStorage.getItem(DEMO_MODE_KEY) === '1';
}

/** Enter demo mode: stub an auth session so every authenticated page renders normally. */
export function enterDemoMode(): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(DEMO_MODE_KEY, '1');
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'demo-token');
  window.localStorage.setItem(
    AUTH_USER_KEY,
    JSON.stringify({ id: 0, username: 'demo', email: 'demo@example.com', is_admin: false })
  );
}

export function exitDemoMode(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(DEMO_MODE_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
}

const now = () => new Date().toISOString();

// ── Entities ──────────────────────────────────────────────────────────────────

interface DemoEntity {
  id: string;
  name: string;
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'ROLE';
  confidence: number;
  aliases?: string[];
}

const DEMO_ENTITIES: DemoEntity[] = [
  { id: 'e1', name: 'UNDP Kenya Country Office', type: 'ORGANIZATION', confidence: 0.97, aliases: ['UNDP Kenya'] },
  { id: 'e2', name: 'Ministry of Water, Sanitation and Irrigation', type: 'ORGANIZATION', confidence: 0.95, aliases: ['the Ministry'] },
  { id: 'e3', name: 'Lake Victoria Basin Commission', type: 'ORGANIZATION', confidence: 0.93, aliases: ['LVBC'] },
  { id: 'e4', name: 'Kenya Water Institute', type: 'ORGANIZATION', confidence: 0.9, aliases: ['KEWI'] },
  { id: 'e5', name: 'WaterAid Kenya', type: 'ORGANIZATION', confidence: 0.91 },
  { id: 'e6', name: 'County Government of Kisumu', type: 'ORGANIZATION', confidence: 0.94 },
  { id: 'e7', name: 'Safaricom Foundation', type: 'ORGANIZATION', confidence: 0.88 },
  { id: 'e8', name: 'World Bank Kenya', type: 'ORGANIZATION', confidence: 0.92 },
  { id: 'e9', name: 'Dr. Amina Yusuf', type: 'PERSON', confidence: 0.96 },
  { id: 'e10', name: 'James Otieno', type: 'PERSON', confidence: 0.93 },
  { id: 'e11', name: 'Grace Wanjiru', type: 'PERSON', confidence: 0.9 },
  { id: 'e12', name: 'Hon. Peter Munya', type: 'PERSON', confidence: 0.89 },
  { id: 'e13', name: 'Kisumu County', type: 'LOCATION', confidence: 0.97 },
  { id: 'e14', name: 'Lake Victoria Basin', type: 'LOCATION', confidence: 0.96 },
  { id: 'e15', name: 'Nyando Sub-County', type: 'LOCATION', confidence: 0.88 },
  { id: 'e16', name: 'Program Director', type: 'ROLE', confidence: 0.85 },
  { id: 'e17', name: 'Community Liaison Officer', type: 'ROLE', confidence: 0.83 },
];

interface DemoRelation {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence: number;
}

const DEMO_RELATIONS: DemoRelation[] = [
  { id: 'r1', source: 'e9', target: 'e1', label: 'LEADS', confidence: 0.95 },
  { id: 'r2', source: 'e10', target: 'e9', label: 'REPORTS_TO', confidence: 0.91 },
  { id: 'r3', source: 'e11', target: 'e10', label: 'REPORTS_TO', confidence: 0.88 },
  { id: 'r4', source: 'e1', target: 'e3', label: 'FUNDS', confidence: 0.9 },
  { id: 'r5', source: 'e1', target: 'e2', label: 'PARTNERS_WITH', confidence: 0.92 },
  { id: 'r6', source: 'e1', target: 'e5', label: 'PARTNERS_WITH', confidence: 0.87 },
  { id: 'r7', source: 'e8', target: 'e1', label: 'FUNDS', confidence: 0.93 },
  { id: 'r8', source: 'e7', target: 'e6', label: 'FUNDS', confidence: 0.8 },
  { id: 'r9', source: 'e2', target: 'e4', label: 'OVERSEES', confidence: 0.86 },
  { id: 'r10', source: 'e12', target: 'e2', label: 'HEADS', confidence: 0.94 },
  { id: 'r11', source: 'e3', target: 'e14', label: 'OPERATES_IN', confidence: 0.91 },
  { id: 'r12', source: 'e6', target: 'e13', label: 'OPERATES_IN', confidence: 0.95 },
  { id: 'r13', source: 'e4', target: 'e3', label: 'ADVISES', confidence: 0.82 },
  { id: 'r14', source: 'e5', target: 'e6', label: 'COLLABORATES_WITH', confidence: 0.84 },
  { id: 'r15', source: 'e1', target: 'e6', label: 'COLLABORATES_WITH', confidence: 0.89 },
  { id: 'r16', source: 'e9', target: 'e12', label: 'ADVISES', confidence: 0.78 },
  { id: 'r17', source: 'e15', target: 'e13', label: 'LOCATED_IN', confidence: 0.97 },
  { id: 'r18', source: 'e13', target: 'e14', label: 'LOCATED_IN', confidence: 0.96 },
  { id: 'r19', source: 'e10', target: 'e15', label: 'OPERATES_IN', confidence: 0.85 },
  { id: 'r20', source: 'e11', target: 'e15', label: 'OPERATES_IN', confidence: 0.83 },
  { id: 'r21', source: 'e9', target: 'e16', label: 'HAS_ROLE', confidence: 0.9 },
  { id: 'r22', source: 'e11', target: 'e17', label: 'HAS_ROLE', confidence: 0.87 },
  { id: 'r23', source: 'e3', target: 'e2', label: 'REPORTS_TO', confidence: 0.75 },
];

function degreeOf(entityId: string): number {
  return DEMO_RELATIONS.filter((r) => r.source === entityId || r.target === entityId).length;
}

const TYPE_COLOR: Record<string, string> = Object.fromEntries(
  ['PERSON', 'ORGANIZATION', 'LOCATION', 'ROLE'].map((key) => [key, getEntityColor(key)])
);

function entityById(id: string): DemoEntity {
  const found = DEMO_ENTITIES.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown demo entity ${id}`);
  return found;
}

// ── Project / workflow ────────────────────────────────────────────────────────

const DEMO_PROJECT = {
  id: DEMO_PROJECT_ID,
  name: 'Lake Victoria Clean Water Access Initiative',
  description: 'Stakeholder mapping for a multi-partner clean water and sanitation programme across the Lake Victoria basin, Kenya.',
  status: 'active' as const,
  document_count: 4,
  entity_count: DEMO_ENTITIES.length,
  created_at: '2026-04-02T09:00:00Z',
  updated_at: now(),
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
};

const DEMO_WORKFLOW_STEPS = [
  { number: 1, label: 'Define initiative', complete: true, url: `/projects/${DEMO_PROJECT_ID}/intake`, description: 'Initiative profile and objectives' },
  { number: 2, label: 'Upload documents', complete: true, url: `/projects/${DEMO_PROJECT_ID}/documents`, description: 'Source documents processed' },
  { number: 3, label: 'Run extraction', complete: true, url: `/projects/${DEMO_PROJECT_ID}/analyze`, description: 'Entities and relationships extracted' },
  { number: 4, label: 'Review graph', complete: true, url: `/projects/${DEMO_PROJECT_ID}/map`, description: 'Knowledge graph reviewed' },
  { number: 5, label: 'Generate report', complete: true, url: `/projects/${DEMO_PROJECT_ID}/report`, description: 'Report sections generated' },
  { number: 6, label: 'Stakeholder table', complete: true, url: `/projects/${DEMO_PROJECT_ID}/stakeholders`, description: 'Priority table generated' },
  { number: 7, label: 'Export', complete: false, url: `/projects/${DEMO_PROJECT_ID}/report?tab=export`, description: 'Export final outputs' },
];

const DEMO_INTAKE = {
  id: 'intake-demo',
  project: DEMO_PROJECT_ID,
  initiative_name: 'Lake Victoria Clean Water Access Initiative',
  host_organization: 'UNDP Kenya Country Office',
  country: 'Kenya',
  geography: 'Lake Victoria Basin — Kisumu County, Nyando Sub-County',
  thematic_area: 'Water, Sanitation & Hygiene (WASH)',
  core_objectives: 'Expand access to clean water for 40,000 residents across Nyando Sub-County through community-managed water points, strengthen county-level water governance, and build a replicable public-private financing model.',
  expected_outcomes: 'Reduced waterborne disease incidence, 25 new community water points operational, a joint financing framework adopted by Kisumu County and partner agencies.',
  target_beneficiaries: 'Rural households in Nyando Sub-County, local water management committees, county health facilities.',
  success_metrics: '% households within 500m of a functioning water point; waterborne disease incidence rate; number of active community water committees.',
  stakeholder_focus: 'Government ministries, county government, UN agencies, international NGOs, private-sector funders, and community representatives.',
  updated_at: now(),
};

// ── Documents ─────────────────────────────────────────────────────────────────

const DEMO_DOCUMENTS = [
  {
    id: 'doc-1',
    filename: 'Programme_Concept_Note_v3.pdf',
    file_format: 'pdf',
    upload_timestamp: '2026-04-02T09:15:00Z',
    processing_status: 'completed',
    chunk_count: 42,
    entity_count: 11,
    relation_count: 14,
    extraction_state: 'extracted' as const,
    last_run: { provider: 'groq', model: 'llama-3.3-70b-versatile', duration_seconds: 38.4, run_at: '2026-04-02T09:20:00Z', relations_created: 14 },
  },
  {
    id: 'doc-2',
    filename: 'Partner_MOU_WaterAid_Safaricom.docx',
    file_format: 'docx',
    upload_timestamp: '2026-04-03T11:05:00Z',
    processing_status: 'completed',
    chunk_count: 18,
    entity_count: 6,
    relation_count: 5,
    extraction_state: 'extracted' as const,
    last_run: { provider: 'groq', model: 'llama-3.3-70b-versatile', duration_seconds: 14.1, run_at: '2026-04-03T11:08:00Z', relations_created: 5 },
  },
  {
    id: 'doc-3',
    filename: 'Kisumu_County_Water_Strategy_2026.pdf',
    file_format: 'pdf',
    upload_timestamp: '2026-04-05T08:40:00Z',
    processing_status: 'completed',
    chunk_count: 61,
    entity_count: 9,
    relation_count: 10,
    extraction_state: 'extracted' as const,
    last_run: { provider: 'groq', model: 'llama-3.3-70b-versatile', duration_seconds: 52.7, run_at: '2026-04-05T08:46:00Z', relations_created: 10 },
  },
  {
    id: 'doc-4',
    filename: 'Stakeholder_Workshop_Minutes_April.txt',
    file_format: 'txt',
    upload_timestamp: '2026-04-09T14:20:00Z',
    processing_status: 'completed',
    chunk_count: 9,
    entity_count: 5,
    relation_count: 3,
    extraction_state: 'extracted' as const,
    last_run: { provider: 'groq', model: 'llama-3.3-70b-versatile', duration_seconds: 6.2, run_at: '2026-04-09T14:21:00Z', relations_created: 3 },
  },
];

// ── SMQ ───────────────────────────────────────────────────────────────────────

const DEMO_SMQ_TEMPLATE = {
  id: 'smq-template-demo',
  title: 'Standard Stakeholder Mapping Questionnaire',
  description: 'Structured questions used to build the initiative’s stakeholder context.',
  sections: [
    { id: 'smq-1', section_number: 1, title: 'Initiative Context', question_prompts: 'What is the initiative trying to achieve, and why now?', order: 1 },
    { id: 'smq-2', section_number: 2, title: 'Power & Influence', question_prompts: 'Which stakeholders hold the most decision-making power?', order: 2 },
    { id: 'smq-3', section_number: 3, title: 'Interests & Risks', question_prompts: 'What interests or risks could affect stakeholder engagement?', order: 3 },
  ],
};

const DEMO_SMQ = {
  id: 'smq-demo',
  project: DEMO_PROJECT_ID,
  answers: [
    {
      id: 'smq-ans-1', section_id: 'smq-1', section_number: 1, section_title: 'Initiative Context',
      answer_text: 'The initiative addresses chronic water scarcity across Nyando Sub-County, where under 40% of households have reliable access to a safe water source. It is co-led by UNDP Kenya and the Ministry of Water, Sanitation and Irrigation, with financing support from the World Bank and Safaricom Foundation.',
      notes_text: '', ai_generated: true, is_stale: false, last_generated_at: '2026-04-10T10:00:00Z', chunk_ids_used: [],
    },
    {
      id: 'smq-ans-2', section_id: 'smq-2', section_number: 2, section_title: 'Power & Influence',
      answer_text: 'The Ministry of Water, Sanitation and Irrigation and Kisumu County Government hold formal regulatory authority. UNDP Kenya and the World Bank hold financial leverage. The Lake Victoria Basin Commission provides cross-border technical legitimacy.',
      notes_text: '', ai_generated: true, is_stale: false, last_generated_at: '2026-04-10T10:02:00Z', chunk_ids_used: [],
    },
    {
      id: 'smq-ans-3', section_id: 'smq-3', section_number: 3, section_title: 'Interests & Risks',
      answer_text: 'Key risk: county-level water tariffs are politically sensitive ahead of local elections. Community water committees need sustained capacity-building to avoid falling back on informal water vendors.',
      notes_text: '', ai_generated: true, is_stale: false, last_generated_at: '2026-04-10T10:03:00Z', chunk_ids_used: [],
    },
  ],
};

// ── Report ────────────────────────────────────────────────────────────────────

const DEMO_REPORT = {
  project: DEMO_PROJECT_ID,
  sections: [
    {
      section_id: 'sec-1', section_number: 1, section_title: 'Executive Summary', status: 'done' as const,
      generated_text: 'This report maps the stakeholder landscape for the Lake Victoria Clean Water Access Initiative, a joint programme led by UNDP Kenya and the Ministry of Water, Sanitation and Irrigation. Seventeen stakeholders across eight organizations were identified from four source documents, spanning government, multilateral, civil society, and private-sector actors operating in Kisumu County and the broader Lake Victoria Basin.',
      citations: [], error_message: '', generated_at: '2026-04-11T09:00:00Z',
    },
    {
      section_id: 'sec-2', section_number: 2, section_title: 'Stakeholder Landscape', status: 'done' as const,
      generated_text: 'UNDP Kenya Country Office, under Program Director Dr. Amina Yusuf, acts as the primary convenor, partnering directly with the Ministry of Water, Sanitation and Irrigation and WaterAid Kenya. Financing flows from the World Bank and the Safaricom Foundation, the latter channelled through the County Government of Kisumu. The Lake Victoria Basin Commission and Kenya Water Institute provide technical oversight across the basin.',
      citations: [], error_message: '', generated_at: '2026-04-11T09:02:00Z',
    },
    {
      section_id: 'sec-3', section_number: 3, section_title: 'Power & Interest Analysis', status: 'done' as const,
      generated_text: 'High-power, high-interest stakeholders — the Ministry, Kisumu County Government, and UNDP Kenya — should be managed closely through the existing steering committee. The Lake Victoria Basin Commission and Kenya Water Institute hold high interest but more limited formal authority, making them valuable technical allies rather than decision-makers.',
      citations: [], error_message: '', generated_at: '2026-04-11T09:05:00Z',
    },
    {
      section_id: 'sec-4', section_number: 4, section_title: 'Engagement Recommendations', status: 'done' as const,
      generated_text: 'Maintain quarterly steering committee briefings with the Ministry and Kisumu County Government. Formalize the WaterAid Kenya and Safaricom Foundation partnership with a joint communications plan. Establish a direct feedback channel from community liaison officers (e.g. Grace Wanjiru) to the Program Director to surface local risks early.',
      citations: [], error_message: '', generated_at: '2026-04-11T09:07:00Z',
    },
    { section_id: 'sec-5', section_number: 5, section_title: 'Risk Register', status: 'pending' as const, generated_text: '', citations: [], error_message: '', generated_at: null },
    { section_id: 'sec-6', section_number: 6, section_title: 'Stakeholder Engagement Strategies', status: 'done' as const,
      generated_text: 'A tiered engagement model is recommended: direct co-management with the Ministry and County Government; structured partnership agreements with WaterAid Kenya and Safaricom Foundation; and advisory consultation with the Lake Victoria Basin Commission and Kenya Water Institute.',
      citations: [], error_message: '', generated_at: '2026-04-11T09:10:00Z' },
  ],
};

// ── Personas ──────────────────────────────────────────────────────────────────

const DEMO_PERSONAS = {
  count: 2,
  results: [
    {
      id: 'persona-1', entity_type_id: null, entity_type_label: 'ORGANIZATION',
      persona_name: 'The Regulatory Gatekeeper', archetype_label: 'Government Authority',
      demographics: 'National and county-level government bodies with formal regulatory and budgetary authority over water infrastructure.',
      motivations: ['Demonstrable public service delivery', 'Political credit for visible infrastructure', 'Compliance with national WASH policy'],
      frustrations: ['Slow donor disbursement cycles', 'Fragmented reporting across partners', 'Community mistrust of past unfinished projects'],
      representative_entities: [{ id: 'e2', name: 'Ministry of Water, Sanitation and Irrigation' }, { id: 'e6', name: 'County Government of Kisumu' }],
      generated_at: '2026-04-11T09:30:00Z',
    },
    {
      id: 'persona-2', entity_type_id: null, entity_type_label: 'ORGANIZATION',
      persona_name: 'The Technical Convenor', archetype_label: 'Multilateral Partner',
      demographics: 'UN agencies and development banks providing financing, technical design, and cross-partner coordination.',
      motivations: ['Programme sustainability beyond funding cycle', 'Replicable financing model for other basins', 'Strong M&E evidence for reporting'],
      frustrations: ['Competing donor priorities', 'Data gaps from community-level partners', 'Coordination overhead across many stakeholders'],
      representative_entities: [{ id: 'e1', name: 'UNDP Kenya Country Office' }, { id: 'e8', name: 'World Bank Kenya' }],
      generated_at: '2026-04-11T09:32:00Z',
    },
  ],
};

// ── Workplan ──────────────────────────────────────────────────────────────────

const DEMO_WORKPLAN = {
  project: DEMO_PROJECT_ID,
  generated: true,
  components: [
    {
      id: 'wp-1', order: 1, title: 'Governance & Coordination', generated_at: '2026-04-11T09:40:00Z',
      tasks: [
        { id: 'wp-1-t1', order: 1, task_description: 'Formalize quarterly steering committee with Ministry and Kisumu County', suggested_owner: 'Dr. Amina Yusuf', timeline: 'Month 1', dependencies: '—', kpis: 'Committee charter signed', related_entity: { id: 'e9', name: 'Dr. Amina Yusuf', entity_type: 'PERSON' } },
        { id: 'wp-1-t2', order: 2, task_description: 'Draft joint financing framework with World Bank and Safaricom Foundation', suggested_owner: 'UNDP Kenya Country Office', timeline: 'Months 1–3', dependencies: 'Steering committee approval', kpis: 'Framework endorsed by all funders', related_entity: { id: 'e1', name: 'UNDP Kenya Country Office', entity_type: 'ORGANIZATION' } },
      ],
    },
    {
      id: 'wp-2', order: 2, title: 'Community Engagement', generated_at: '2026-04-11T09:42:00Z',
      tasks: [
        { id: 'wp-2-t1', order: 1, task_description: 'Establish community water management committees in Nyando Sub-County', suggested_owner: 'Grace Wanjiru', timeline: 'Months 2–4', dependencies: '—', kpis: '10 committees trained and operational', related_entity: { id: 'e11', name: 'Grace Wanjiru', entity_type: 'PERSON' } },
        { id: 'wp-2-t2', order: 2, task_description: 'Run quarterly feedback sessions between field team and Program Director', suggested_owner: 'James Otieno', timeline: 'Ongoing', dependencies: 'Committees established', kpis: 'Feedback log reviewed monthly', related_entity: { id: 'e10', name: 'James Otieno', entity_type: 'PERSON' } },
      ],
    },
  ],
};

// ── Stakeholder priority ──────────────────────────────────────────────────────

function priorityRow(rank: number, id: string, category: string, level: 'high' | 'medium' | 'low', reason: string, ask: string | null): any {
  const ent = entityById(id);
  return {
    rank, entity_id: id, name: ent.name, category, entity_type: ent.type,
    mention_count: 6 + rank, avg_confidence: ent.confidence, degree: degreeOf(id),
    priority_score: Math.max(0.2, 1 - rank * 0.09),
    priority_level: level, reasoning: reason, priority_reason: reason,
    recommended_ask: ask, engagement_note: null,
  };
}

const DEMO_STAKEHOLDER_PRIORITY = {
  count: 8, page: 1, total_pages: 1,
  results: [
    priorityRow(1, 'e2', 'Government Authority', 'high', 'Holds formal regulatory authority over all water infrastructure decisions in the basin.', 'Secure a signed MOU formalizing the steering committee.'),
    priorityRow(2, 'e6', 'Government Authority', 'high', 'Controls county-level implementation and local political buy-in.', 'Joint public announcement of the financing framework.'),
    priorityRow(3, 'e1', 'Programme Lead', 'high', 'Primary convenor and technical coordinator across all partners.', 'Maintain quarterly steering committee cadence.'),
    priorityRow(4, 'e8', 'Funder', 'high', 'Largest single funding source; disbursement pace affects the whole timeline.', 'Lock in disbursement schedule for Year 1.'),
    priorityRow(5, 'e3', 'Technical Partner', 'medium', 'Provides cross-border technical legitimacy but limited direct authority.', 'Invite to quarterly technical review.'),
    priorityRow(6, 'e5', 'Implementation Partner', 'medium', 'Delivers community-level WASH programming under MOU with UNDP.', 'Confirm joint communications plan.'),
    priorityRow(7, 'e7', 'Funder', 'medium', 'Channels corporate funding through county government.', 'Align funding cycle with county budget calendar.'),
    priorityRow(8, 'e4', 'Technical Partner', 'low', 'Advisory role on water testing standards.', null),
  ],
};

// ── Providers ─────────────────────────────────────────────────────────────────

const DEMO_PROVIDERS = {
  current_provider: 'groq', current_model: 'llama-3.3-70b-versatile',
  providers: [
    { name: 'groq', available: true, models: ['llama-3.3-70b-versatile', 'llama3-8b-8192'] },
    { name: 'openai', available: false, models: ['gpt-5-mini', 'gpt-5-nano'] },
    { name: 'gemini', available: false, models: ['gemini-2.0-flash'] },
  ],
};

// ── Raw graph (backend shape, matches what getProjectGraph() expects to transform) ──

function buildRawGraph() {
  const nodes = DEMO_ENTITIES.map((e) => {
    const degree = degreeOf(e.id);
    return {
      id: e.id,
      label: e.name,
      entity_type: e.type,
      degree,
      data: {
        id: e.id,
        entity_type: e.type,
        confidence: e.confidence,
        document_id: 'doc-1',
        chunk_id: null,
        raw_mentions_count: degree + 2,
        shape: e.type === 'PERSON' ? 'ellipse' : e.type === 'LOCATION' ? 'diamond' : 'round-rectangle',
        color: TYPE_COLOR[e.type] || '#9ca3af',
        degree,
      },
    };
  });
  const edges = DEMO_RELATIONS.map((r) => ({
    data: {
      id: r.id, source: r.source, target: r.target, label: r.label,
      relation_type: r.label, confidence: r.confidence, color: 'rgba(154,166,196,0.5)',
    },
  }));
  return { nodes, edges };
}

function buildEntitiesList() {
  return DEMO_ENTITIES.map((e) => ({
    id: e.id,
    canonical_name: e.name,
    entity_type: e.type,
    confidence: e.confidence,
    aliases: e.aliases || [],
    mention_count_dedup: degreeOf(e.id) + 2,
    raw_mentions: [e.name],
    chunk_id: null,
    document_id: 'doc-1',
    created_at: '2026-04-02T09:20:00Z',
  }));
}

function buildEntityProfile(entityId: string) {
  const ent = entityById(entityId);
  const relationships = DEMO_RELATIONS.filter((r) => r.source === entityId || r.target === entityId).map((r) => {
    const src = entityById(r.source);
    const tgt = entityById(r.target);
    return {
      relation_id: r.id, project_id: DEMO_PROJECT_ID,
      source_entity_id: r.source, source_entity_name: src.name, source_entity_type: src.type,
      target_entity_id: r.target, target_entity_name: tgt.name, target_entity_type: tgt.type,
      relation_type: r.label, confidence: r.confidence,
      supporting_excerpts: [`"${src.name} ${r.label.replace(/_/g, ' ').toLowerCase()} ${tgt.name}" — Programme Concept Note v3`],
    };
  });
  const priorityRowMatch = DEMO_STAKEHOLDER_PRIORITY.results.find((p) => p.entity_id === entityId);
  const persona = DEMO_PERSONAS.results.find((p) => p.representative_entities.some((re) => re.id === entityId));
  return {
    id: ent.id, canonical_name: ent.name, entity_type: ent.type, confidence: ent.confidence,
    aliases: ent.aliases || [], relationships,
    projects: [{ id: DEMO_PROJECT_ID, name: DEMO_PROJECT.name }],
    stakeholder_priority: priorityRowMatch ? {
      rank: priorityRowMatch.rank, category: priorityRowMatch.category,
      priority: priorityRowMatch.priority_level === 'high' ? 'High' : priorityRowMatch.priority_level === 'medium' ? 'Medium' : 'Low',
      priority_reason: priorityRowMatch.priority_reason, ask_request: priorityRowMatch.recommended_ask || '',
    } : null,
    persona: persona ? { archetype_label: persona.archetype_label, persona_name: persona.persona_name } : null,
    appears_in_report_sections: [{ section_number: 2, report_chapter_title: 'Stakeholder Landscape' }],
    has_stakeholder_table: !!priorityRowMatch,
  };
}

// Hand-written "AI-generated" summaries for the entities most likely to be
// clicked during a demo tour; everything else gets a believable template
// built from its type and actual relationships, so nothing reads as empty.
const HAND_WRITTEN_SUMMARIES: Record<string, string> = {
  e1: 'UNDP Kenya Country Office convenes the programme, coordinating financing from the World Bank and Safaricom Foundation while partnering directly with the Ministry of Water, Sanitation and Irrigation and WaterAid Kenya. It holds the central coordinating role across every workstream in this initiative.',
  e2: 'The Ministry of Water, Sanitation and Irrigation is the national regulatory authority for water infrastructure decisions in the basin. Headed by Hon. Peter Munya, it oversees the Kenya Water Institute and sets the policy conditions the rest of the programme operates under.',
  e9: 'Dr. Amina Yusuf leads UNDP Kenya’s country office and is the primary point of accountability for this initiative. She advises the Ministry directly and is the escalation point for James Otieno’s field team.',
  e13: 'Kisumu County is the geographic center of the programme—the Nyando Sub-County water points, the County Government’s implementation role, and the Lake Victoria Basin Commission’s technical oversight all converge here.',
  e5: 'WaterAid Kenya is UNDP’s implementation partner for community-level WASH programming, working closely with the County Government of Kisumu on delivery.',
  e6: 'The County Government of Kisumu, backed by Safaricom Foundation funding, is responsible for local implementation and carries the political weight of visible, on-the-ground delivery.',
};

function summaryForEntity(entityId: string): string {
  if (HAND_WRITTEN_SUMMARIES[entityId]) return HAND_WRITTEN_SUMMARIES[entityId];
  const ent = entityById(entityId);
  const rels = DEMO_RELATIONS.filter((r) => r.source === entityId || r.target === entityId);
  if (rels.length === 0) {
    return `${ent.name} appears in the project’s source documents as a ${ent.type.toLowerCase()} with no recorded connections yet.`;
  }
  const described = rels.slice(0, 3).map((r) => {
    const other = entityById(r.source === entityId ? r.target : r.source);
    const verb = r.label.replace(/_/g, ' ').toLowerCase();
    return r.source === entityId ? `${verb} ${other.name}` : `is ${verb} by ${other.name}`;
  });
  return `${ent.name} is a ${ent.type.toLowerCase()} that ${described.join('; ')}, based on evidence from the uploaded programme documents.`;
}

function buildTimeline(entityId: string) {
  const ent = entityById(entityId);
  const docs = [DEMO_DOCUMENTS[Number(entityId.replace('e', '')) % DEMO_DOCUMENTS.length], DEMO_DOCUMENTS[0]];
  const seen = new Set<string>();
  return docs
    .filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
    .map((d) => ({
      document_id: d.id,
      document_name: d.filename,
      uploaded_at: d.upload_timestamp,
      context_snippet: `"...${ent.name} is referenced in connection with the programme’s stakeholder engagement plan..."`,
    }));
}

function buildQueryAnswer(query: string) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return { query, answer: 'Type a question or a stakeholder name to search the graph.', is_nl_query: true, entity_ids: [] as string[], count: 0 };
  }
  const matches = DEMO_ENTITIES.filter((e) =>
    e.name.toLowerCase().includes(q) || (e.aliases || []).some((a) => a.toLowerCase().includes(q))
  );
  if (matches.length === 0) {
    return { query, answer: `No stakeholders matched "${query}". Try a name like "UNDP" or "Kisumu".`, is_nl_query: true, entity_ids: [] as string[], count: 0 };
  }
  const names = matches.map((m) => m.name);
  const answer = names.length === 1
    ? `Found ${names[0]} — highlighted on the graph.`
    : `Found ${names.length} matches: ${names.join(', ')}.`;
  return { query, answer, is_nl_query: true, entity_ids: matches.map((m) => m.id), count: matches.length };
}

function buildFlagResponse(entityId: string, body: any) {
  const ent = entityById(entityId);
  return { id: ent.id, canonical_name: ent.name, is_flagged: body?.is_flagged ?? true };
}

function buildEntitiesCsv(): string {
  const header = 'id,canonical_name,entity_type,confidence,mention_count';
  const rows = DEMO_ENTITIES.map((e) => `${e.id},"${e.name}",${e.type},${e.confidence},${degreeOf(e.id) + 2}`);
  return [header, ...rows].join('\n');
}

function buildRelationsCsv(): string {
  const header = 'id,source,target,relation_type,confidence';
  const rows = DEMO_RELATIONS.map((r) => `${r.id},"${entityById(r.source).name}","${entityById(r.target).name}",${r.label},${r.confidence}`);
  return [header, ...rows].join('\n');
}

// ── URL dispatch table ───────────────────────────────────────────────────────

type DemoHandler = (match: RegExpMatchArray, body?: any) => unknown;

const ROUTES: Array<{ method: string; pattern: RegExp; handler: DemoHandler; headers?: Record<string, string> }> = [
  { method: 'get', pattern: /\/api\/v1\/projects\/$/, handler: () => [DEMO_PROJECT] },
  // Global (non-project-scoped) entity endpoints — used by the map page's
  // node side-panel and the standalone entity-detail page.
  { method: 'get', pattern: /\/api\/v1\/entities\/([^/]+)\/profile\/$/, handler: (m) => buildEntityProfile(m[1]) },
  { method: 'post', pattern: /\/api\/v1\/entities\/([^/]+)\/summary\/$/, handler: (m) => ({ entity_id: m[1], project_id: DEMO_PROJECT_ID, summary: summaryForEntity(m[1]), source: 'provider' }) },
  { method: 'post', pattern: /\/api\/v1\/entities\/([^/]+)\/flag\/$/, handler: (m, body) => buildFlagResponse(m[1], body) },
  { method: 'get', pattern: /\/api\/v1\/entities\/([^/]+)\/timeline\/$/, handler: (m) => ({ entity_id: m[1], project_id: DEMO_PROJECT_ID, timeline: buildTimeline(m[1]) }) },
  // Graph search — the natural-language query box on the map page.
  { method: 'post', pattern: /\/api\/v1\/projects\/demo\/query\/$/, handler: (_m, body) => buildQueryAnswer(body?.query || '') },
  {
    method: 'get', pattern: /\/api\/v1\/projects\/demo\/export\/entities\.csv$/, handler: () => buildEntitiesCsv(),
    headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="entities.csv"' },
  },
  {
    method: 'get', pattern: /\/api\/v1\/projects\/demo\/export\/relations\.csv$/, handler: () => buildRelationsCsv(),
    headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="relations.csv"' },
  },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/$/, handler: () => DEMO_PROJECT },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/workflow\/$/, handler: () => ({ current_step: 7, steps: DEMO_WORKFLOW_STEPS, next_step: DEMO_WORKFLOW_STEPS[6] }) },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/intake\/$/, handler: () => DEMO_INTAKE },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/documents\/?(\?.*)?$/, handler: () => DEMO_DOCUMENTS },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/web-sources\/$/, handler: () => [] },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/extract-entities\/status\/$/, handler: () => ({ status: 'completed', project_id: DEMO_PROJECT_ID, documents_total: 4, documents_processed: 4, documents_remaining: 0, entities_created: DEMO_ENTITIES.length, relations_created: DEMO_RELATIONS.length }) },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/entities\/$/, handler: () => ({ entities: buildEntitiesList() }) },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/graph\/$/, handler: () => buildRawGraph() },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/entities\/([^/]+)\/$/, handler: (m) => buildEntityProfile(m[1]) },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/flagged-count\/$/, handler: () => ({ count: 0 }) },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/review\/$/, handler: () => ({ count: 0, pending_count: 0, results: [] }) },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/providers\/$/, handler: () => DEMO_PROVIDERS },
  { method: 'get', pattern: /\/api\/v1\/smq\/template\/$/, handler: () => DEMO_SMQ_TEMPLATE },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/smq\/$/, handler: () => DEMO_SMQ },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/report\/staleness\/$/, handler: () => ({ stale_sections: [], stakeholder_table_stale: false, new_entity_count: 0 }) },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/report\/$/, handler: () => DEMO_REPORT },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/stakeholders\/priority\/$/, handler: () => DEMO_STAKEHOLDER_PRIORITY },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/personas\/status\/$/, handler: () => ({ generated: true, count: DEMO_PERSONAS.count, generation_status: 'completed', generation_message: '' }) },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/personas\/$/, handler: () => DEMO_PERSONAS },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/workplan\/status\/$/, handler: () => ({ generated: true, section_6_complete: true, component_count: DEMO_WORKPLAN.components.length, task_count: 4, generation_status: 'completed', generation_message: '' }) },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/workplan\/$/, handler: () => DEMO_WORKPLAN },
  { method: 'get', pattern: /\/api\/v1\/projects\/demo\/report\/export\/status\/$/, handler: () => ({ pdf_ready: false, docx_ready: false }) },
  { method: 'get', pattern: /\/api\/v1\/admin\/entity-labels\/$/, handler: () => Object.entries(TYPE_COLOR).map(([name, color], i) => ({ id: `label-${i}`, name, description: '', node_shape: 'ellipse', color, active: true, display_order: i })) },
  { method: 'get', pattern: /\/api\/v1\/admin\/relationship-types\/$/, handler: () => [] },
];

export function matchDemoRoute(method: string, url: string, body?: any): { data: unknown; headers?: Record<string, string> } | undefined {
  const lowered = method.toLowerCase();
  for (const route of ROUTES) {
    if (route.method !== lowered) continue;
    const m = url.match(route.pattern);
    if (m) return { data: route.handler(m, body), headers: route.headers };
  }
  // Any other demo-scoped request (mutations, exports, project creation, etc.) gets a
  // harmless generic OK instead of ever reaching the real network — demo mode never
  // writes anything, it just has to not crash the UI.
  if (
    /\/api\/v1\/projects\/demo\//.test(url) ||
    /\/api\/v1\/(entities|documents)\//.test(url) ||
    /\/api\/v1\/projects\/$/.test(url)
  ) {
    return { data: { status: 'ok', id: 'demo', message: 'This action is simulated in demo mode.' } };
  }
  return undefined;
}

export function isDemoUrl(url: string): boolean {
  return (
    /\/api\/v1\/projects\/demo(\/|$)/.test(url) ||
    /\/api\/v1\/projects\/\?/.test(url) ||
    /\/api\/v1\/projects\/$/.test(url) ||
    /\/api\/v1\/smq\/template\/$/.test(url) ||
    /\/api\/v1\/admin\/(entity-labels|relationship-types)\/$/.test(url) ||
    // Global (non-project-scoped) entity endpoints hit from the map page's
    // node panel and the entity-detail page — only relevant while demo mode
    // is active, since real entity IDs never collide with the demo's "e1".."e17".
    /\/api\/v1\/entities\/[^/]+\/(profile|summary|flag|timeline)\/$/.test(url)
  );
}
