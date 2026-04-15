---
schema: sdgqalab/testmap@3
layer: frontend
project: Stakeholder Analysis Tool
audited_at: "2026-04-15T00:00"
config_version: 3

coverage:
  total_source_files: 64
  unit:
    test_files: 3
    file_coverage_pct: 4.7
    file_coverage_rating: "🔴 Critical"
  integration:
    test_files: 6
    file_coverage_pct: 26.6
    file_coverage_rating: "🔴 Critical"
  e2e:
    journeys_identified: 8
    journeys_covered: 0
    gaps: 8
  security:
    areas_identified: 5
    areas_covered: 1
    gaps: 4
  accessibility:
    components_identified: 14
    components_covered: 0
    gaps: 14
  line_coverage_pct: 42.6
  line_coverage_rating: "🟠 Low"
  test_count: 63

by_scope:
  src/components:
    source_files: 25
    unit_test_files: 2
    unit_file_coverage_pct: 8.0
    integration_test_files: 6
    integration_file_coverage_pct: 36.0
  pages:
    source_files: 29
    unit_test_files: 0
    unit_file_coverage_pct: 0.0
    integration_test_files: 6
    integration_file_coverage_pct: 13.8
  src/lib:
    source_files: 10
    unit_test_files: 1
    unit_file_coverage_pct: 10.0
    integration_test_files: 6
    integration_file_coverage_pct: 40.0

delta:
  previous_audit: null
  unit_file_coverage_change: null
  integration_file_coverage_change: null
  line_coverage_change: null
  e2e_gaps_change: null
  security_gaps_change: null
  accessibility_gaps_change: null
---

# Frontend Test Audit

> **Unit File Coverage**: 4.7% (3/64 files) · 🔴 Critical
> **Integration File Coverage**: 26.6% (17/64 files) · 🔴 Critical
> **Line Coverage**: 42.6% · 🟠 Low
> **Tests**: 63 (9 test suites — all passing)
> **Audited**: 2026-04-15

Coverage tool: Jest 29 with `--coverage`. Note: Jest reports only files imported
during test execution. Files with 0 imports are excluded from the line coverage
percentage (42.6%), meaning the true whole-codebase line coverage is lower.
A `collectCoverageFrom` glob should be added to `jest.config.js` to force
all source files into the coverage report.

> **Config note**: The config scope `src/pages` maps to `frontend/src/pages/`
> (only `_document.tsx`). The actual Next.js pages live in `frontend/pages/`
> (29 files). Update the config scope from `src/pages` → `pages` to fix this.

---

## Unit Tests

Tests that verify modules in isolation — no I/O, no external services.
Targets: components, hooks, utility functions, API client methods.

### Unit Coverage by Scope

| Scope | Source Files | Unit Test Files | Unit File Coverage |
|-------|-------------|-----------------|-------------------|
| src/components | 25 | 2 | 8.0% |
| pages | 29 | 0 | 0.0% |
| src/lib | 10 | 1 | 10.0% |
| **Total** | **64** | **3** | **4.7%** |

### Existing Unit Tests

| Scope | Test File | Approx. Tests | Modules Covered |
|-------|-----------|---------------|-----------------|
| src/lib | `api.test.ts` | ~30 | Axios client init, error interceptor (404/429/500/network), uploadDocument, extractEntities, getEntities, getGraphNodes, auth helpers |
| src/components | `entity-summary.test.tsx` | ~8 | EntitySidePanel rendering, props, interaction |
| src/components | `report-section-card.test.tsx` | ~6 | ReportSectionCard states: pending, generating, done, error |

### Unit Tests Needed

| File | Scope | What to Test |
|------|-------|--------------|
| `src/lib/graphFocus.ts` | src/lib | Focus state transitions, filter logic, node selection |
| `src/lib/uiState.ts` | src/lib | State shape, reducer transitions |
| `src/lib/workspaceContext.ts` | src/lib | Context provider, consumer, state propagation |
| `src/lib/entityNeighborhood.ts` | src/lib | Neighborhood computation, edge traversal |
| `src/lib/cytoscapeStyle.ts` | src/lib | Style function outputs for node/edge types |
| `src/lib/entityTypes.ts` | src/lib | Type guard functions, label mappings |
| `src/lib/routes.ts` | src/lib | Route construction helpers |
| `src/components/WorkflowStepper.tsx` | src/components | Step progression, active/disabled states |
| `src/components/IntakeForm.tsx` | src/components | Field validation, form submission, error states |
| `src/components/StakeholderPriorityTable.tsx` | src/components | Sort, filter, row interactions |
| `src/components/ExportTab.tsx` | src/components | Format selection, download trigger |
| `src/components/PersonaCard.tsx` | src/components | Rendering with full/empty props |
| `src/components/GraphVisualization.tsx` | src/components | Layout initialization, Cytoscape instance wiring |
| `src/components/SMQSection.tsx` | src/components | Section states, expand/collapse |
| `src/components/GuidancePanel.tsx` | src/components | Guidance rendering, expand |
| `src/components/StalenessNotice.tsx` | src/components | Stale vs. fresh state rendering |
| `src/components/WorkplanAccordion.tsx` | src/components | Accordion open/close, phase list |
| `src/components/admin/EntityLabelsPanel.tsx` | src/components | Label CRUD, validation |
| `src/components/admin/RelationshipTypesPanel.tsx` | src/components | Type CRUD, validation |
| `src/components/ErrorBoundary.tsx` | src/components | Error catch rendering, fallback UI |

---

## Integration Tests

Tests that verify components working together — pages rendering with mocked API,
multi-step UI flows, service contract verification.

### Integration Coverage by Scope

| Scope | Source Files | Integration Test Files | Integration File Coverage |
|-------|-------------|----------------------|--------------------------|
| src/components | 25 | 6 | 36.0% |
| pages | 29 | 6 | 13.8% |
| src/lib | 10 | 6 | 40.0% |
| **Total** | **64** | **6** | **26.6%** |

### Existing Integration Tests

| Scope | Test File | Approx. Tests | Boundaries Covered |
|-------|-----------|---------------|--------------------|
| pages | `entities.test.tsx` | ~7 | Entity list page: load, filter by type, navigate to profile |
| pages | `graph.test.tsx` | ~6 | Graph page: load, render nodes, confidence slider, error/empty state |
| pages | `graph-focus-filters.test.tsx` | ~5 | Focus mode, filter panel behavior |
| pages | `graph-visuals.test.tsx` | ~5 | Node highlight, visual modes |
| pages | `upload.test.tsx` | ~8 | Upload page: file select, validate, upload flow, extract flow, errors |
| pages | `workspace-panel.test.tsx` | ~9 | Workspace page: step tabs, section loading, project navigation |

### Integration Tests Needed

| File | Scope | What to Test |
|------|-------|--------------|
| `pages/projects/[id]/intake.tsx` | pages | Intake form submit, validation errors, save/load cycle |
| `pages/projects/[id]/analyze.tsx` | pages | Extraction trigger, progress polling, stop/resume |
| `pages/projects/[id]/review.tsx` | pages | Entity review: flag, merge, discard |
| `pages/projects/[id]/report.tsx` | pages | Report section generation, section states, export trigger |
| `pages/projects/[id]/stakeholders.tsx` | pages | Stakeholder priority table rendering, sort |
| `pages/projects/[id]/map.tsx` | pages | Map/graph view within project context |
| `pages/projects/[id]/smq.tsx` | pages | SMQ section rendering and interaction |
| `pages/projects/[id]/documents.tsx` | pages | Document list, add/remove document |
| `pages/projects/[id]/settings.tsx` | pages | LLM provider settings, project config save |
| `pages/projects/[id]/setup.tsx` | pages | Project setup wizard flow |
| `pages/projects/index.tsx` | pages | Project list, create new, navigate |
| `pages/auth/login.tsx` | pages | Login form submit, error, redirect |
| `pages/auth/register.tsx` | pages | Register form submit, validation |
| `pages/admin.tsx` | pages | Admin panel CRUD operations |
| `pages/account.tsx` | pages | User account update form |
| `src/components/EntityStakeholderAnalysis.tsx` | src/components | Analysis panel data loading |
| `src/components/EntityMiniGraph.tsx` | src/components | Mini graph render, node interactions |

---

## End-to-End (E2E) Tests

> **0** of **8** critical journeys covered · **8** gaps

### Existing E2E Tests

No E2E framework is configured (no Cypress, Playwright, or Selenium setup found).

### E2E Tests Needed

| User Journey | Priority | What to Cover |
|-------------|----------|---------------|
| Upload document → extraction → view graph | P1 | File drag-drop → provider select → extract → assert entities appear in graph |
| Auth: register → login → access workspace | P1 | Form submit → token stored → protected route accessible |
| Intake form → report generation flow | P1 | Fill concept note → trigger SMQ/report generation → sections load |
| Entity review: flag and merge entities | P2 | Select entity → flag as duplicate → merge → assert graph updated |
| Export: generate PDF/DOCX report | P2 | Full report → click export → assert download initiates |
| Project lifecycle: create → configure → delete | P2 | New project → add doc → set provider → complete extraction |
| Role-based access: admin vs. standard user | P3 | Admin sees admin panel; standard user does not |
| Workspace step navigation | P3 | Each step tab loads correct content, back/forward navigation works |

> No E2E framework is configured. **Recommend adding Playwright** as a dev
> dependency — it integrates natively with Next.js and supports both headed
> and headless modes.

---

## Security Tests

> **1** of **5** security-sensitive areas covered · **4** gaps

### Existing Security Tests

| Scope | Test File | What's Tested |
|-------|-----------|---------------|
| src/lib | `api.test.ts` | 401 → clears stored auth; 429 → returns rate-limit error; network error handling; auth token stored and cleared via helpers |

### Security Tests Needed

| Area | Scope | What to Test |
|------|-------|--------------|
| Auth form input validation | pages | Login/register inputs: reject XSS payloads, enforce maxLength, no raw HTML injection |
| File upload validation | pages | Reject non-PDF/DOCX MIME types; oversized file triggers correct error before upload |
| Client-side token storage | src/lib | Token stored in localStorage vs. memory — verify no sensitive data persists after logout |
| CSRF protection | pages | Verify API calls include correct headers; verify POST/PUT without token returns 403 |

---

## Accessibility Tests

> **0** of **14** interactive components covered · **14** gaps

### Existing Accessibility Tests

No accessibility testing tooling is installed (`jest-axe`, `axe-core`, `pa11y` not
found in `package.json`).

### Accessibility Tests Needed

| Component / Page | Scope | What to Test |
|-----------------|-------|--------------|
| `pages/auth/login.tsx` | pages | Form labels, keyboard submit, error announcements |
| `pages/auth/register.tsx` | pages | All fields labelled, validation errors announced via aria-live |
| `src/components/IntakeForm.tsx` | src/components | Label association, required field indicators, error state a11y |
| `pages/upload.tsx` | pages | Drop zone keyboard accessible, status announcements |
| `src/components/GraphVisualization.tsx` | src/components | Keyboard navigation into graph, focus management |
| `src/components/StakeholderPriorityTable.tsx` | src/components | Table headers, sortable column labels, row selection |
| `pages/projects/[id]/workspace.tsx` | pages | Step tabs keyboard-navigable, aria-selected, panel focus |
| `src/components/WorkflowStepper.tsx` | src/components | Step labels readable by screen reader, aria-current |
| `pages/entities.tsx` | pages | Entity type filter buttons accessible, filter state announced |
| `src/components/EntitySidePanel.tsx` | src/components | Panel focus trap when open, keyboard dismiss |
| `src/components/SMQSection.tsx` | src/components | Section expand/collapse keyboard accessible |
| `src/components/ExportTab.tsx` | src/components | Format radio buttons labeled |
| `pages/admin.tsx` | pages | Admin table actions keyboard accessible |
| `src/components/PersonaCard.tsx` | src/components | Card content readable by screen reader |

> **P1 action**: Install `jest-axe` and add an axe smoke test to every
> interactive component test. One line per component: `expect(await axe(container)).toHaveNoViolations()`.

---

## Test Health Observations

| Test File | Observation | Impact |
|-----------|-------------|--------|
| `src/__tests__/pages/graph-visuals.test.tsx` | Multiple `act()` warnings — async Sidebar state update not wrapped in act. Tests pass but may not reflect real render timing. | Flaky in CI; false confidence on Sidebar behavior |
| `src/__tests__/pages/graph-focus-filters.test.tsx` | Same `act()` warnings as above | Same risk |
| `src/__tests__/pages/upload.test.tsx` | 6 `act()` warnings from Sidebar state; upload flow tests pass but async state assertions may miss timing issues | Potential race condition in upload progress testing |
| `src/__tests__/lib/api.test.ts` | `console.error` calls in test output for 404/429/500 (intentional — testing error paths). These are expected but noisy; could be suppressed with `jest.spyOn(console, 'error')` | No functional impact; increases noise in CI output |

---

## Recommendations

1. **[P1] Add `collectCoverageFrom` to `jest.config.js`** — Without it, Jest only reports coverage for imported files. The 42.6% line figure covers only 17 of 64 source files. Add:
   ```js
   collectCoverageFrom: ['src/**/*.{ts,tsx}', 'pages/**/*.{ts,tsx}', '!**/*.d.ts', '!pages/_app.tsx', '!pages/_document.tsx']
   ```
   This will expose the true baseline (likely ~20–25% overall).

2. **[P1] Install Playwright for E2E coverage** — 8 critical user journeys have zero E2E coverage. Run `npm install -D @playwright/test` and write a smoke test for the upload → extract → graph journey first.

3. **[P1] Install `jest-axe` and add axe smoke tests** — 14 interactive components have zero accessibility testing. One assertion per component test prevents regressions with minimal effort:
   ```ts
   import { axe } from 'jest-axe';
   const { container } = render(<MyComponent />);
   expect(await axe(container)).toHaveNoViolations();
   ```

4. **[P1] Fix the `act()` warnings in graph/upload tests** — Wrap async state updates in `act()`. The Sidebar component triggers async state during render; tests should wrap in `await act(async () => { ... })`.

5. **[P2] Write unit tests for `src/lib/` modules** — `graphFocus.ts`, `uiState.ts`, `workspaceContext.ts` contain complex state logic with 0% unit coverage. These are high-value targets: pure functions, easy to test in isolation.

6. **[P2] Add integration tests for the 13 untested pages** — Priority order: `intake.tsx`, `analyze.tsx`, `review.tsx`, `report.tsx`, `stakeholders.tsx`.

7. **[P2] Fix config scope mismatch** — Update `.sdgqalab/config.yml` `frontend.scopes` from `src/pages` to `pages` to match where Next.js pages actually live.

8. **[P3] Suppress intentional console.error in api.test.ts** — Add `jest.spyOn(console, 'error').mockImplementation(() => {})` in the error path tests to keep CI output clean.

## Acceptance Criteria

- [ ] `collectCoverageFrom` configured in `jest.config.js`
- [ ] All 9 test suites passing with no `act()` warnings
- [ ] Every `src/lib/*.ts` module has a unit test
- [ ] All auth pages (`login.tsx`, `register.tsx`) have integration tests
- [ ] Core project pages (`intake`, `analyze`, `review`, `report`) have integration tests
- [ ] `jest-axe` installed and smoke test on every interactive component
- [ ] Playwright configured with at least 1 E2E smoke test (upload → extract → graph)
- [ ] All tests pass: `cd frontend && node node_modules/jest/bin/jest.js --watchAll=false --ci`
