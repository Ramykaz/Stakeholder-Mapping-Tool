---
schema: sdgqalab/testmap@3
layer: frontend
project: Stakeholder Analysis Tool
audited_at: "2026-04-16T21:11"
config_version: 3

coverage:
  total_source_files: 64
  unit:
    test_files: 19
    file_coverage_pct: 29.7
    file_coverage_rating: "🔴 Critical"
  integration:
    test_files: 23
    file_coverage_pct: 26.6
    file_coverage_rating: "🔴 Critical"
  e2e:
    journeys_identified: 8
    journeys_covered: 0
    gaps: 8
  security:
    areas_identified: 5
    areas_covered: 3
    gaps: 2
  accessibility:
    components_identified: 14
    components_covered: 3
    gaps: 11
  line_coverage_pct: 68.3
  line_coverage_rating: "🔴 Critical"
  test_count: 432

by_scope:
  src/components:
    source_files: 25
    unit_test_files: 10
    unit_file_coverage_pct: 40.0
    integration_test_files: 0
    integration_file_coverage_pct: 0.0
  pages:
    source_files: 29
    unit_test_files: 0
    unit_file_coverage_pct: 0.0
    integration_test_files: 23
    integration_file_coverage_pct: 58.6
  src/lib:
    source_files: 10
    unit_test_files: 8
    unit_file_coverage_pct: 80.0
    integration_test_files: 0
    integration_file_coverage_pct: 0.0

delta:
  previous_audit: "2026-04-16T21:02"
  unit_file_coverage_change: +0.0
  integration_file_coverage_change: +0.0
  line_coverage_change: +3.6
  e2e_gaps_change: 0
  security_gaps_change: 0
  accessibility_gaps_change: 0
---

# Frontend Test Audit

> **Unit File Coverage**: 29.7% (19/64 files) · 🔴 Critical
> **Integration File Coverage**: 26.6% (17/64 files) · 🔴 Critical
> **Line Coverage**: 68.3% · 🔴 Critical
> **Tests**: 432 total · 432 passed · 0 failed
> **Audited**: 2026-04-16

> **Config note**: `config.yml` pages scope is now aligned to `frontend/pages`.

---

## Unit Tests

Tests that verify modules in isolation — no I/O, no external services.
Targets: components, utility functions, formatters, context providers.

### Unit Coverage by Scope

| Scope | Source Files | Unit Test Files | Unit File Coverage |
|-------|-------------|-----------------|-------------------|
| src/components | 25 | 10 | 40.0% |
| pages | 29 | 0 | 0.0% |
| src/lib | 10 | 8 | 80.0% |
| **Total** | **64** | **19** | **29.7%** |

### Existing Unit Tests

| Scope | Test File | Approx. Tests | Modules Covered |
|-------|-----------|---------------|-----------------|
| src/components | ErrorBoundary.test.tsx | ~4 | catch/reset, error display |
| src/components | ExportTab.test.tsx | ~6 | PDF/DOCX/XLSX button states |
| src/components | GuidancePanel.test.tsx | ~5 | Panel toggle, content render |
| src/components | PersonaCard.test.tsx | ~6 | Name/role render (2 failing — brittle style assertions) |
| src/components | GraphVisualization.test.tsx | ~4 | Controls, isolated toggle, confidence filter, node/background callbacks |
| src/components | IntakeForm.test.tsx | ~6 | Load/save/error states, dirty callback, context preview refresh |
| src/components | NextStepCard.test.tsx | ~5 | Route-based next-step derivation and CTA navigation |
| src/components | SMQSection.test.tsx | ~6 | Save/generate flows, AI-disabled state, citations rendering |
| src/components | EntityStakeholderAnalysis.test.tsx | ~5 | Priority branches, report/persona navigation actions |
| src/components | StalenessNotice.test.tsx | ~4 | Stale/fresh notice states |
| src/components | WorkflowStepper.test.tsx | ~5 | Step active/complete states |
| src/components | WorkplanAccordion.test.tsx | ~5 | Accordion expand/collapse |
| src/components | report-section-card.test.tsx | ~6 | ReportSectionCard status, actions |
| src/lib | api.test.ts | ~45 | API client methods, auth token helpers, intake/context/report/stakeholder export wrappers, document review/extraction wrappers |
| src/lib | cytoscapeStyle.test.ts | ~8 | Cytoscape stylesheet rules |
| src/lib | entityNeighborhood.test.ts | ~10 | Neighbor traversal logic |
| src/lib | entityTypes.test.ts | ~8 | Entity type normalization |
| src/lib | graphFocus.test.ts | ~12 | Graph focus/filter utilities |
| src/lib | routes.test.ts | ~8 | Route helper functions |
| src/lib | uiState.test.ts | ~10 | UI state transitions |
| src/lib | workspaceContext.test.ts | ~8 | Workspace context helpers |

### Unit Tests Needed

| File | Scope | What to Test |
|------|-------|--------------|
| `src/components/layout/Sidebar.tsx` | src/components | Nav item active state, project selector |
| `src/components/layout/TopNavigation.tsx` | src/components | Project dropdown, user menu, admin badge |
| `src/components/EntitySidePanel.tsx` | src/components | Panel sections, tab switching |
| `src/components/EntityMiniGraph.tsx` | src/components | Mini graph render, empty state |
| `src/components/EntityStakeholderAnalysis.tsx` | src/components | Analysis card render |
| `src/components/SMQSection.tsx` | src/components | Question render, answer state |
| `src/components/NextStepCard.tsx` | src/components | Additional route-edge cases and `report?tab=export` behavior |
| `src/components/layout/Layout.tsx` | src/components | Slot layout, page header render |
| `src/components/EmptyState.tsx` | src/components | Render with/without action button |
| `src/components/ErrorMessage.tsx` | src/components | Message display, dismiss |
| `src/components/LoadingSpinner.tsx` | src/components | Spinner render, size variants |
| `src/components/Layout.tsx` | src/components | Auth wrapper, child render |
| `src/lib/initiativeText.ts` | src/lib | Initiative text formatting helpers |
| `src/lib/llmText.ts` | src/lib | LLM response formatting utilities |

---

## Integration Tests

Tests that verify page-level components working with mocked API —
routing, loading states, user interactions, and error handling.

### Integration Coverage by Scope

| Scope | Source Files | Integration Test Files | Integration File Coverage |
|-------|-------------|----------------------|--------------------------|
| src/components | 25 | 0 | 0.0% |
| pages | 29 | 12 | 41.4% |
| src/lib | 10 | 0 | 0.0% |
| **Total** | **64** | **12** | **18.8%** |

### Existing Integration Tests

| Scope | Test File | Approx. Tests | Boundaries Covered |
|-------|-----------|---------------|--------------------|
| pages | entities.test.tsx | ~8 | Entity list, filter, search |
| pages | entity-summary.test.tsx | ~6 | Entity detail view, relations tab |
| pages | graph.test.tsx | ~8 | Graph page render, filter UI |
| pages | graph-focus-filters.test.tsx | ~6 | Focus mode filter states |
| pages | graph-visuals.test.tsx | ~6 | Visualization option toggles |
| pages | upload.test.tsx | ~10 | Upload form, document list |
| pages | projects-deep-smoke.test.tsx | ~7 | Documents/map/settings/review/setup/SMQ/new project flow smoke coverage |
| pages | workspace-panel.test.tsx | ~8 | Workspace tabs, panel states |
| pages | account.test.tsx | ~6 | Account page render |
| pages | analyze.test.tsx | ~8 | Analyze page, extraction trigger |
| pages | auth-login.test.tsx | ~8 | Login form submit, error states |
| pages | intake.test.tsx | ~6 | Intake form submit, guidance |
| pages | projects-index.test.tsx | ~6 | Project list, create button |
| pages | stakeholders-page.test.tsx | ~6 | Stakeholder list |
| pages | entity-detail-page.test.tsx | ~4 | Entity detail loading, summary generation, relationship navigation, unflag flow |
| pages | documents-page.test.tsx | ~3 | URL/paste source submission and per-document analyze action |
| pages | map-page.test.tsx | ~3 | Entity panel summary generation, NL query response, export action |
| pages | workspace-actions.test.tsx | ~2 | Chat command navigation and provider/model extraction payload |
| pages | admin-page.test.tsx | ~3 | Admin auth redirect, stats refresh, and user role toggle action |
| pages | settings-page.test.tsx | ~3 | Provider/model save + connection test, project save, and delete redirect flow |
| pages | report-advanced.test.tsx | ~3 | Stale-section keep/regenerate actions, workplan generation/download, export tab render |
| pages | review-page.test.tsx | ~5 | Auth redirect, empty list state, merge/keep actions, and failed-resolution branch |
| pages | setup-page.test.tsx | ~5 | Auth/intake redirects, debounced autosave, save-and-continue, and skip navigation |

### Integration Tests Needed

| File | Scope | What to Test |
|------|-------|--------------|
| `pages/projects/[id]/documents.tsx` | pages | Deep branch coverage: delete confirmation, upload failure, and source validation errors |
| `pages/projects/[id]/map.tsx` | pages | Deep branch coverage: filter controls, empty-state transitions, and map interaction callbacks |
| `pages/projects/[id]/review.tsx` | pages | Deep branch coverage: reject path, error banner handling, and pagination of review items |
| `pages/projects/[id]/settings.tsx` | pages | Deep branch coverage: validation errors, cancel/reset behavior, and API-failure retries |
| `pages/projects/[id]/setup.tsx` | pages | Deep branch coverage: wizard branch selection and back/forward transition guard rails |
| `pages/projects/[id]/smq.tsx` | pages | Deep branch coverage: submit failure states, multi-section navigation, and persistence feedback |
| `pages/projects/[id]/entities/[entityId].tsx` | pages | Deep branch coverage: external lookup fallbacks, timeline paths, and mini-graph node click navigation |
| `pages/admin.tsx` | pages | Label/type management, admin-only gate; 121 stmts, 0% |
| `pages/auth/login.tsx` | pages | New-style auth/login page (distinct from legacy login.tsx) |
| `pages/auth/register.tsx` | pages | Registration form, validation, redirect |
| `pages/projects/new.tsx` | pages | Deep branch coverage: validation failures, API errors, and duplicate project handling |
| `pages/index.tsx` | pages | Landing page render, CTA links |
| `pages/relations.tsx` | pages | Relation list, filter |
| `pages/forgot-password.tsx` | pages | Email submit, success/error state |
| `pages/reset-password.tsx` | pages | Token validation, password reset form |
| `pages/register.tsx` | pages | Register form, password validation |

---

## End-to-End (E2E) Tests

Tests that verify complete user journeys through the real application.

> **0** of **8** critical journeys covered · **8** gaps

> No E2E framework is installed. `package.json` devDependencies contain no Cypress, Playwright, or Selenium dependency. Setting up Playwright is a P1 recommendation.

### Existing E2E Tests

None — no E2E framework configured.

### E2E Tests Needed

| User Journey | Priority | What to Cover |
|-------------|----------|---------------|
| User login + authenticated navigation | P1 | Login form → token stored → protected page visible → logout clears session |
| Create project → upload document → start extraction | P1 | Full onboarding: project form → document upload → extraction trigger → status polling |
| View entity graph + interact with nodes | P1 | Graph render → node click → side panel open → filter controls active |
| Generate report → regenerate section | P1 | Report page load → generate → section status polling → section text displayed |
| Export workplan/report (PDF, DOCX) | P2 | Export button triggers download with correct filename and MIME type |
| Stakeholder analysis + persona view | P2 | Personas generated → PersonaCard visible → workplan tab switchable |
| Admin panel — entity label CRUD | P2 | Admin login → create label → edit → delete → UI updated |
| Role-based access: admin vs regular user | P3 | Regular user cannot access admin routes; admin badge visible only for admin |

---

## Security Tests

> **3** of **5** security-sensitive areas covered · **2** gaps

> Frontend now includes dedicated security smoke tests for auth-storage cleanup and safe rendering behavior.

### Existing Security Tests

| Scope | Test File | What's Tested |
|-------|-----------|---------------|
| src/components | `src/__tests__/security/security-smoke.test.tsx` | XSS-safe text rendering, retry callback wiring |
| src/lib | `src/__tests__/security/security-smoke.test.tsx` | Login storage lifecycle, logout cleanup on API failure |

### Security Tests Needed

| Area | Scope | What to Test |
|------|-------|--------------|
| Auth token expiry handling | src/lib | `api.ts`: 401 response triggers token clear + redirect to login |
| XSS via rendered user content | src/components | `IntakeForm`, `SMQSection`: submit XSS payload → renders as text, not HTML |
| Route authentication guards | pages | Protected page renders redirect when no auth token present |
| CSRF protection on mutations | src/lib | API mutation calls include CSRF header where backend requires it |
| File type validation on upload | pages | Upload page: non-document MIME type rejected before API call |

---

## Accessibility Tests

> **3** of **14** interactive components/pages covered · **11** gaps

> `jest-axe` is installed and active in smoke coverage.

### Existing Accessibility Tests

| Scope | Test File | What's Tested |
|-------|-----------|---------------|
| src/components | `src/__tests__/a11y/accessibility-smoke.test.tsx` | Axe smoke checks for `LoadingSpinner`, `EmptyState`, `ErrorMessage` |

### Accessibility Tests Needed

| Component / Page | Scope | What to Test |
|-----------------|-------|--------------|
| `pages/auth/login.tsx` | pages | axe smoke test; label association on email/password inputs |
| `pages/projects/[id]/intake.tsx` | pages | axe smoke test; form labels, error message associations |
| `pages/projects/[id]/report.tsx` | pages | axe smoke test; heading hierarchy in section cards |
| `pages/projects/[id]/workspace.tsx` | pages | axe smoke test; tab keyboard navigation |
| `pages/upload.tsx` | pages | axe smoke test; file input label, drag-drop region |
| `src/components/IntakeForm.tsx` | src/components | Label/input association, required indicators, keyboard submit |
| `src/components/SMQSection.tsx` | src/components | Question-to-input linkage, radio/text keyboard |
| `src/components/GraphVisualization.tsx` | src/components | Alt text for graph canvas, keyboard-accessible controls |
| `src/components/StakeholderPriorityTable.tsx` | src/components | `<th scope>`, sort column announcements |
| `src/components/EntitySidePanel.tsx` | src/components | Focus trap when panel opens, Escape to close |
| `src/components/layout/Sidebar.tsx` | src/components | `<nav>` landmark, `aria-current` on active item |
| `src/components/layout/TopNavigation.tsx` | src/components | Dropdown `aria-expanded`, keyboard navigation |
| `src/components/admin/EntityLabelsPanel.tsx` | src/components | Form input labels, delete confirmation accessible |
| `src/components/admin/RelationshipTypesPanel.tsx` | src/components | Same as EntityLabelsPanel |

---

## Test Health Observations

| Test File | Observation | Impact |
|-----------|-------------|--------|
| `src/__tests__/pages/report.test.tsx` | Suite fails to run: `mockSections` (`const`) referenced inside `jest.mock()` factory which is hoisted by Babel — temporal dead zone. Fix: declare `mockSections` with `let` and assign in `beforeEach`, or inline the value in the factory. | `report.tsx` shows 0% line coverage despite having a test file; 0 tests run |
| `src/__tests__/pages/analyze.test.tsx` | `getProjectDocuments is not a function` — `jest.mock('@/lib/api')` factory does not include `getProjectDocuments` but the component calls it on mount. Mock is stale. | 8 tests failing; analyze page effectively untested |
| `src/__tests__/pages/auth-login.test.tsx` | Suite failing — test imports from `pages/projects/[id]/auth-login` path pattern; actual auth page lives at `pages/auth/login.tsx`. Import target mismatch. | auth/login.tsx shows 0% line coverage |
| `src/__tests__/components/PersonaCard.test.tsx` | 2 failures: assertions use `container.querySelector('[style*="007A87"]')` — CSS inline style not rendered that way in jsdom. Replace with `data-testid` or check className instead. | PersonaCard colour-variant behaviour unvalidated |

---

## Recommendations

1. **[P1] Fix 8 failing test suites.** Begin with `report.test.tsx` (TDZ fix — 1 line change), then audit each failing suite for incomplete/stale mocks. Each fix unlocks real line coverage gains; the current 27.1% is artificially suppressed by failing suites.

2. **[P1] Install `jest-axe` and add axe smoke tests to all page-level integration tests.** Zero accessibility coverage for 29 pages is a critical gap. Smoke tests (`expect(await axe(container)).toHaveNoViolations()`) can be added in < 30 minutes per file.

3. **[P1] Fix `config.yml` scope: change `src/pages` → `pages`.** The current scope path does not match where pages live, causing mis-labelling in all future audit reports.

4. **[P2] Add unit tests for the 17 uncovered components.** Priority by uncovered statement count: `GraphVisualization.tsx` (533), `StakeholderPriorityTable.tsx` (155), `IntakeForm.tsx` (59), `layout/Sidebar.tsx` (99), `layout/TopNavigation.tsx` (103).

5. **[P2] Install Playwright and add 3–4 E2E smoke journeys.** The critical path (login → upload → extract → graph → report) has zero automated end-to-end validation. A single config file + 4 spec files would cover the highest-risk flows.

6. **[P3] Add integration tests for the 15 uncovered pages.** Priority: `documents.tsx` (364 stmts), `map.tsx` (185 stmts), `admin.tsx` (121 stmts), `projects/new.tsx` (57 stmts).

7. **[P3] Add dedicated unit tests for `src/lib/initiativeText.ts` and `src/lib/llmText.ts`.** Both are exercised indirectly (100% line coverage) but have no named test file — a refactor could silently break them.

## Acceptance Criteria

- [ ] All 30 test suites pass (`Tests: 0 failed`)
- [ ] `jest-axe` installed; axe smoke test in every page-level test file
- [ ] All `jest.mock('@/lib/api')` factories include complete method sets matching the live API module
- [ ] Unit tests for all `src/components/*.tsx` files (target ≥ 70% unit file coverage for components)
- [ ] Unit tests for remaining `src/lib/*.ts` files (all 10 covered)
- [ ] At least 3 Playwright E2E journeys covering the critical user path
- [ ] All tests pass: `cd frontend && npm test -- --watchAll=false --ci`
