---
schema: sdgqalab/testmap@3
layer: frontend
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T01:30"
config_version: 3

coverage:
  total_source_files: 64
  unit:
    test_files: 28
    file_coverage_pct: 50.0
    file_coverage_rating: "🟡 Adequate"
  integration:
    test_files: 24
    file_coverage_pct: 39.1
    file_coverage_rating: "🟠 Low"
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
  line_coverage_pct: 68.9
  line_coverage_rating: "🟡 Adequate"
  test_count: 453

by_scope:
  src/components:
    source_files: 25
    unit_test_files: 20
    unit_file_coverage_pct: 88.0
    integration_test_files: 0
    integration_file_coverage_pct: 0.0
  pages:
    source_files: 29
    unit_test_files: 0
    unit_file_coverage_pct: 0.0
    integration_test_files: 24
    integration_file_coverage_pct: 86.2
  src/lib:
    source_files: 10
    unit_test_files: 9
    unit_file_coverage_pct: 100.0
    integration_test_files: 0
    integration_file_coverage_pct: 0.0

delta:
  previous_audit: "2026-04-17T00:55"
  unit_file_coverage_change: +20.3
  integration_file_coverage_change: +12.5
  line_coverage_change: 0.0
  e2e_gaps_change: 0
  security_gaps_change: 0
  accessibility_gaps_change: 0
  note: "Delta reflects methodology refinement — this audit correctly counts cross-scope unit tests (entity-summary.test.tsx covering EntitySidePanel, report-section-card.test.tsx covering ReportSectionCard, a11y test covering LoadingSpinner/EmptyState/ErrorMessage, text-utils.test.ts covering initiativeText/llmText) and import-match detection for pages tests. No new tests were added; test count is unchanged at 453."
---

# Frontend Test Audit

> **Unit File Coverage**: 50.0% (32/64 files) · 🟡 Adequate
> **Integration File Coverage**: 39.1% (25/64 files) · 🟠 Low
> **Line Coverage**: 68.9% · 🟡 Adequate
> **Tests**: 453
> **Audited**: 2026-04-17

---

## Unit Tests

Tests that verify modules in isolation — no I/O, no external services.
Targets: models, serializers, validators, utilities, hooks, guards, formatters.

### Unit Coverage by Scope

| Scope | Source Files | Unit Test Files | Unit File Coverage |
|---|---|---|---|
| src/components | 25 | 20 | 88.0% |
| src/lib | 10 | 9 | 100.0% |
| pages | 29 | 0 | 0.0% |
| **Total** | **64** | **28** | **50.0%** |

_Note: pages have 0% unit coverage by design — they are all integration-tested. The overall 50% figure reflects 32 covered files (22 components + 10 lib) out of 64 total._

### Existing Unit Tests

| Scope | Test File | Approx. Tests | Modules Covered |
|---|---|---|---|
| src/components | `__tests__/components/EntityLabelsPanel.test.tsx` | ~6 | admin/EntityLabelsPanel.tsx |
| src/components | `__tests__/components/RelationshipTypesPanel.test.tsx` | ~6 | admin/RelationshipTypesPanel.tsx |
| src/components | `__tests__/components/EntityStakeholderAnalysis.test.tsx` | ~5 | EntityStakeholderAnalysis.tsx |
| src/components | `__tests__/components/ErrorBoundary.test.tsx` | ~3 | ErrorBoundary.tsx |
| src/components | `__tests__/components/ExportTab.test.tsx` | ~6 | ExportTab.tsx |
| src/components | `__tests__/components/GraphVisualization.test.tsx` | ~8 | GraphVisualization.tsx |
| src/components | `__tests__/components/GuidancePanel.test.tsx` | ~5 | GuidancePanel.tsx |
| src/components | `__tests__/components/IntakeForm.test.tsx` | ~6 | IntakeForm.tsx |
| src/components | `__tests__/components/layout-navigation.test.tsx` | ~5 | layout/Sidebar.tsx, layout/TopNavigation.tsx |
| src/components | `__tests__/components/NextStepCard.test.tsx` | ~4 | NextStepCard.tsx |
| src/components | `__tests__/components/PersonaCard.test.tsx` | ~4 | PersonaCard.tsx |
| src/components | `__tests__/components/SMQSection.test.tsx` | ~5 | SMQSection.tsx |
| src/components | `__tests__/components/StakeholderPriorityTable.test.tsx` | ~6 | StakeholderPriorityTable.tsx |
| src/components | `__tests__/components/StalenessNotice.test.tsx` | ~4 | StalenessNotice.tsx |
| src/components | `__tests__/components/WorkflowStepper.test.tsx` | ~5 | WorkflowStepper.tsx |
| src/components | `__tests__/components/WorkplanAccordion.test.tsx` | ~4 | WorkplanAccordion.tsx |
| src/components | `__tests__/a11y/accessibility-smoke.test.tsx` | 3 | LoadingSpinner.tsx, EmptyState.tsx, ErrorMessage.tsx |
| src/components | `__tests__/pages/entity-summary.test.tsx` | ~6 | EntitySidePanel.tsx |
| src/components | `__tests__/pages/report-section-card.test.tsx` | ~4 | ReportSectionCard.tsx |
| src/lib | `__tests__/lib/api.test.ts` | ~25 | api.ts |
| src/lib | `__tests__/lib/cytoscapeStyle.test.ts` | ~8 | cytoscapeStyle.ts |
| src/lib | `__tests__/lib/entityNeighborhood.test.ts` | ~6 | entityNeighborhood.ts |
| src/lib | `__tests__/lib/entityTypes.test.ts` | ~5 | entityTypes.ts |
| src/lib | `__tests__/lib/graphFocus.test.ts` | ~8 | graphFocus.ts |
| src/lib | `__tests__/lib/routes.test.ts` | ~6 | routes.ts |
| src/lib | `__tests__/lib/text-utils.test.ts` | ~4 | initiativeText.ts, llmText.ts |
| src/lib | `__tests__/lib/uiState.test.ts` | ~6 | uiState.ts |
| src/lib | `__tests__/lib/workspaceContext.test.ts` | ~5 | workspaceContext.ts |

### Unit Tests Needed

| File | Scope | What to Test |
|---|---|---|
| `src/components/EntityMiniGraph.tsx` | src/components | Render with node data; cytoscape instance creation; empty/loading states; edge cases for missing entity data |
| `src/components/Layout.tsx` | src/components | Renders children with correct title/meta; sidebar toggle; responsive behaviour |
| `src/components/layout/Layout.tsx` | src/components | Layout wrapper renders children; passes title prop correctly; slot composition |

---

## Integration Tests

Tests that verify components working together across boundaries —
API endpoints, database operations, service contracts, workflows.

### Integration Coverage by Scope

| Scope | Source Files | Integration Test Files | Integration File Coverage |
|---|---|---|---|
| pages | 29 | 24 | 86.2% |
| src/components | 25 | 0 | 0.0% |
| src/lib | 10 | 0 | 0.0% |
| **Total** | **64** | **24** | **39.1%** |

_Note: 39.1% reflects 25 covered pages out of 64 total source files. Within the pages scope, 25/29 pages (86.2%) have integration tests._

### Existing Integration Tests

| Scope | Test File | Approx. Tests | Boundaries Covered |
|---|---|---|---|
| pages | `__tests__/pages/account.test.tsx` | ~8 | pages/account.tsx — profile API, settings update |
| pages | `__tests__/pages/admin-page.test.tsx` | ~6 | pages/admin.tsx — entity labels, relation types admin |
| pages | `__tests__/pages/analyze.test.tsx` | ~8 | pages/projects/[id]/analyze.tsx — entity extraction flow |
| pages | `__tests__/pages/auth-login.test.tsx` | ~8 | pages/login.tsx — login form, auth API |
| pages | `__tests__/pages/documents-page.test.tsx` | ~6 | pages/projects/[id]/documents.tsx — document list, upload |
| pages | `__tests__/pages/entities.test.tsx` | ~6 | pages/entities.tsx — entity list, search |
| pages | `__tests__/pages/entity-detail-page.test.tsx` | ~8 | pages/projects/[id]/entities/[entityId].tsx — entity profile |
| pages | `__tests__/pages/graph.test.tsx` | ~10 | pages/graph.tsx — graph load, filter |
| pages | `__tests__/pages/graph-focus-filters.test.tsx` | ~8 | pages/graph.tsx — focus/filter controls |
| pages | `__tests__/pages/graph-visuals.test.tsx` | ~6 | pages/graph.tsx — visualization states |
| pages | `__tests__/pages/intake.test.tsx` | ~8 | pages/projects/[id]/intake.tsx — intake form submit |
| pages | `__tests__/pages/map-page.test.tsx` | ~8 | pages/projects/[id]/map.tsx — stakeholder map |
| pages | `__tests__/pages/missing-pages-smoke.test.tsx` | 6 | pages/index, forgot-password, reset-password, register, relations, admin |
| pages | `__tests__/pages/projects-deep-smoke.test.tsx` | 7 | documents, map, settings, review, setup, smq, new project |
| pages | `__tests__/pages/projects-index.test.tsx` | ~8 | pages/projects/index.tsx — project list, create |
| pages | `__tests__/pages/report.test.tsx` | ~10 | pages/projects/[id]/report.tsx — report generation |
| pages | `__tests__/pages/report-advanced.test.tsx` | ~8 | pages/projects/[id]/report.tsx — section editing, export |
| pages | `__tests__/pages/review-page.test.tsx` | ~8 | pages/projects/[id]/review.tsx — dedup review |
| pages | `__tests__/pages/settings-page.test.tsx` | ~6 | pages/projects/[id]/settings.tsx — project settings |
| pages | `__tests__/pages/setup-page.test.tsx` | ~4 | pages/projects/[id]/setup.tsx — intake redirect |
| pages | `__tests__/pages/stakeholders-page.test.tsx` | ~6 | pages/projects/[id]/stakeholders.tsx — priority table |
| pages | `__tests__/pages/upload.test.tsx` | ~8 | pages/upload.tsx — file upload, extraction trigger |
| pages | `__tests__/pages/workspace-actions.test.tsx` | ~8 | pages/projects/[id]/workspace.tsx — action buttons |
| pages | `__tests__/pages/workspace-panel.test.tsx` | ~8 | pages/projects/[id]/workspace.tsx — panel states |

### Integration Tests Needed

| File | Scope | What to Test |
|---|---|---|
| `pages/404.tsx` | pages | Renders 404 content; back-to-home link |
| `pages/500.tsx` | pages | Renders 500 error content; retry action |
| `pages/auth/login.tsx` | pages | Auth redirect page renders or forwards to pages/login — 0% line coverage; clarify intent vs pages/login.tsx |
| `pages/auth/register.tsx` | pages | Auth register redirect or standalone register form — only smoke import, no real assertions |

---

## End-to-End (E2E) Tests

Tests that verify complete user journeys through the real application.
Tools: Cypress, Playwright, Selenium, etc.

> **0** of **8** critical journeys covered · **8** gaps

### Existing E2E Tests

| Test File / Suite | User Journey Covered |
|---|---|
| `src/__tests__/e2e/journeys-smoke.test.tsx` | Mocked Jest smoke — not real E2E (no browser, no live server). Covers import smoke only. |

> No real E2E framework (Cypress/Playwright) is configured in this project.

### E2E Tests Needed

| User Journey | Priority | What to Cover |
|---|---|---|
| New user signup + first project creation | P1 | Register → login → create project → reach workspace |
| Document upload + entity extraction | P1 | Upload ConceptNote → trigger extraction → entities appear in map |
| Stakeholder map exploration | P1 | Open graph → filter by type → click node → view profile → explore neighbourhood |
| Report generation + export | P1 | Generate report → edit section → export PDF |
| Entity deduplication review | P2 | Review candidates → resolve merge → confirm in entity list |
| SMQ analysis workflow | P2 | Navigate to SMQ → generate responses → review all sections |
| Workplan + persona export | P2 | Generate workplan → expand accordion → export PDF/DOCX |
| Role-based access (admin vs user) | P2 | Admin sees label management; regular user cannot access admin page |

> Recommend setting up Playwright — it works with Next.js out of the box and provides built-in API mocking.

---

## Security Tests

Tests that verify authentication, authorization, input validation,
and protection against common vulnerabilities (OWASP Top 10).

> **3** of **5** security-sensitive areas covered · **2** gaps

### Existing Security Tests

| Scope | Test File | What's Tested |
|---|---|---|
| src/components | `__tests__/security/security-smoke.test.tsx` | XSS: dangerouslySetInnerHTML absent in ErrorMessage; script tags treated as text |
| src/lib | `__tests__/security/security-smoke.test.tsx` | Auth token storage: localStorage read/write via getStoredAuthToken/getStoredAuthUser |
| src/lib | `__tests__/security/security-smoke.test.tsx` | Logout on API failure: logoutUser clears tokens even when logout API call fails |

### Security Tests Needed

| Area | Scope | What to Test |
|---|---|---|
| CSRF protection on mutating API calls | src/lib | Verify CSRF token header is attached on POST/PUT/DELETE in apiClient interceptors |
| Role-based route enforcement | pages | Admin page renders access-denied state for non-admin; admin-only API calls blocked for regular users |

---

## Accessibility Tests

Tests that verify the application is usable by people with disabilities.
Tools: jest-axe, pa11y, axe-core, Lighthouse accessibility audits.

> **3** of **14** interactive components covered · **11** gaps

### Existing Accessibility Tests

| Scope | Test File | What's Tested |
|---|---|---|
| src/components | `__tests__/a11y/accessibility-smoke.test.tsx` | axe-core: LoadingSpinner (no violations); EmptyState (no violations); ErrorMessage (no violations) |

### Accessibility Tests Needed

| Component / Page | Scope | What to Test |
|---|---|---|
| `IntakeForm.tsx` | src/components | Label association for all form inputs; error state announcements; keyboard submit |
| `GraphVisualization.tsx` | src/components | Keyboard navigation of graph nodes; focus management; aria-label on canvas |
| `StakeholderPriorityTable.tsx` | src/components | Table semantics (th/td, scope); sort controls accessible by keyboard |
| `WorkflowStepper.tsx` | src/components | Step indicators: aria-current, keyboard movement between steps |
| `ExportTab.tsx` | src/components | Export button labels; loading state aria-live announcement |
| `EntitySidePanel.tsx` | src/components | Focus trap on open; Escape to close; aria-dialog attributes |
| `GuidancePanel.tsx` | src/components | Collapse/expand keyboard control; aria-expanded |
| `SMQSection.tsx` | src/components | Form control labels; section navigation by keyboard |
| `WorkplanAccordion.tsx` | src/components | Accordion keyboard navigation; aria-expanded; focus management |
| `layout/Sidebar.tsx` | src/components | Navigation landmarks; aria-current page; mobile menu focus trap |
| `layout/TopNavigation.tsx` | src/components | Skip-to-content link; keyboard-accessible dropdown menus |

> jest-axe is already installed (used in `accessibility-smoke.test.tsx`). Extend existing pattern to cover the above components.

---

## Test Health Observations

| Test File | Observation | Impact |
|---|---|---|
| `src/__tests__/coverage/frontend-missing-smoke.test.tsx` | Pure import smoke — only asserts `expect(mod).toBeDefined()`. Provides line coverage for EntityMiniGraph, Layout (root), layout/Layout, EntitySidePanel (partial), initiativeText, llmText without exercising any behaviour. | These files appear partially covered in line stats but have zero behavioural assertion coverage |
| `src/__tests__/e2e/journeys-smoke.test.tsx` | Labelled as E2E but runs in Jest with fully mocked API. No browser, no real navigation, no live HTTP. Does not provide E2E confidence. | E2E gap is wider than the file name implies |

---

## Recommendations

1. **[P1] Implement real E2E framework** — Install Playwright and add at least 3 critical journey tests (upload → extract → map, report generation, auth flow). The current `journeys-smoke.test.tsx` is a Jest test with mocks; it provides zero E2E assurance.

2. **[P1] Fix pages/auth/login.tsx coverage gap** — This file has 0% line coverage despite `auth-login.test.tsx` existing. The test covers `pages/login.tsx` (root-level), not `pages/auth/login.tsx`. Either write a dedicated test for the auth-prefixed route or confirm it is an intentional redirect stub.

3. **[P2] Add axe-core tests for interactive components** — IntakeForm, GraphVisualization, StakeholderPriorityTable, WorkflowStepper, and the layout navigation components are interactive and user-facing. jest-axe is already installed; extend the accessibility smoke test pattern.

4. **[P2] Unit tests for EntityMiniGraph** — The component has only 11.76% statement coverage. It renders a Cytoscape instance and is used on the entity profile page. Add render + snapshot tests and a test for graph layout with data.

5. **[P2] CSRF security test** — Add a test that the apiClient interceptor attaches the CSRF token header on mutating requests. This is a one-test security regression guard.

6. **[P3] Convert frontend-missing-smoke.test.tsx to real tests** — The smoke import test adds line coverage noise without behavioral assurance. Replace with a dedicated unit test for each component it covers (EntityMiniGraph, Layout, layout/Layout) or delete if those components are sufficiently covered otherwise.

## Acceptance Criteria

- [ ] Every scope has a dedicated test module for each source file
- [ ] All pages render correctly with mocked API in integration tests
- [ ] Critical business logic in lib/ has unit tests (currently 100%)
- [ ] Key user journeys have E2E coverage (Playwright)
- [ ] Auth and session management paths have security tests
- [ ] Core interactive components have axe-core accessibility checks
- [ ] All tests pass: `cd frontend && npm test -- --watchAll=false --ci`
