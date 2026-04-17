---
schema: sdgqalab/audit@3
layer: frontend
layer_type: nextjs-typescript
quality_attribute: interaction-capability
quality_attribute_name: Interaction Capability
iso_characteristic: "WCAG 2.2 / ISO 40500 + ISO/IEC 25059 AI System Interaction"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T00:00"
config_version: 2

score:
  pass: 5
  partial: 11
  fail: 2
  na: 0
  applicable: 18
  score_pct: 58.3
  rating: "🟡 Adequate"

priority_summary:
  p0_blockers: 0
  p1_critical: 0
  p2_important: 4
  p3_improvement: 9

delta:
  previous_audit: null
  score_change: null
  new_passes: []
  new_fails: []
---

# Interaction Capability Audit — Frontend

> **Score**: 58.3% · 🟡 Adequate
> **Results**: 5 pass · 11 partial · 2 fail · 0 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 4
> **Audited**: 2026-04-17
> **Layer**: frontend (nextjs-typescript)
> **ISO Grounding**: WCAG 2.2 / ISO 40500 + ISO/IEC 25059 AI System Interaction

---

## Summary

The frontend has a solid UX foundation: loading states, error boundaries, empty states, and confirmation dialogs are all implemented. The accessibility posture has improved significantly with 14 components now covered by axe-core tests (all passing with zero violations). However, there is no i18n framework, no AI output feedback mechanism, and AI-generated content is not clearly labeled. Keyboard navigation and ARIA coverage need improvement for full WCAG 2.2 compliance.

---

## Results

### ✅ PASS (5 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| INT-008 | Loading states | `LoadingSpinner.tsx` component; `isLoading` guards on all async pages |
| INT-009 | Error state UX | `ErrorBoundary.tsx` at app root; `ErrorMessage.tsx` component; custom 404/500 pages |
| INT-011 | Consistent navigation | `layout/Sidebar.tsx` + `layout/TopNavigation.tsx` in shared layout across all routes |
| INT-012 | Empty states | `EmptyState.tsx` component; used on no-results and first-time-user views |
| INT-013 | Confirmation for destructive actions | Type-to-confirm delete modals (per README); `AlertDialog`-style confirmation |

### ⚠️ PARTIAL (11 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| INT-001 | Semantic HTML | Landmark elements present in layout; `nav`, `main` used | Some pages use `div` for interactive areas; heading hierarchy not verified across all 29 pages | high |
| INT-002 | Alt text for images | SVG icons have `aria-hidden` in some components | Not systematically verified across all icons; graph visualization SVG accessibility not tested | high |
| INT-003 | Keyboard navigation | Tab-navigable components; ESLint a11y rules | No skip navigation link; focus management on route changes not verified; some Cytoscape/D3 elements not keyboard-accessible | high |
| INT-004 | Color contrast | Dark theme with design tokens | No formal contrast ratio verification; no `eslint-plugin-jsx-a11y` contrast check | medium |
| INT-005 | Form labels and validation | `IntakeForm.tsx` has labeled fields; error messages present | Not all form fields verified for `aria-describedby` on error messages; `aria-invalid` not systematic | high |
| INT-006 | ARIA attributes | `aria-hidden`, `aria-label` used in key components | No comprehensive ARIA audit; `aria-live` for dynamic content not verified globally | medium |
| INT-007 | Screen reader compatibility | Next.js `<Head>` for page titles; `sr-only` utility available | Page title updates on all SPA routes not verified; modals may lack `aria-modal` | medium |
| INT-010 | Responsive design | Tailwind CSS with responsive prefixes; viewport meta in `_document` | Responsive navigation (hamburger menu) not confirmed for mobile | medium |
| INT-015 | AI transparency | AI-generated sections visible | No explicit "AI Generated" badge on generated content (reports, personas, workplan) | high |
| INT-016 | AI response controllability | Extraction can be triggered/stopped; stop button exists | No regenerate button on AI responses; multi-step generation lacks intervention points | medium |
| INT-017 | AI error communication | Graceful error messages shown on failure | Error messages are generic ("Generation failed") not specific to error type | high |

### ❌ FAIL (2 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| INT-014 | i18n framework | No i18n library in `package.json`; all strings hardcoded in components | low | P3 |
| INT-018 | AI output feedback | No thumbs up/down, no rating, no flag mechanism on AI-generated content | medium | P2 |

---

## Remediation Roadmap

### P2 — Important (fix within first sprint post-launch)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| INT-015 | AI transparency label | Add "AI Generated" badge to report sections, persona cards, workplan output | Short |
| INT-018 | AI feedback | Add thumbs up/down to AI responses; send rating to backend logging endpoint | Medium |
| INT-003 | Skip navigation | Add `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>` to root layout | Quick win |
| INT-005 | Form error linkage | Add `aria-describedby` and `aria-invalid` to all form error states | Short |

### P3 — Improvements (backlog)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| INT-001 | Semantic HTML audit | Audit all 29 pages for heading hierarchy and landmark elements | Medium |
| INT-002 | Alt text audit | Audit all SVG icons; ensure all graph visualization elements have accessible descriptions | Short |
| INT-004 | Contrast verification | Add `eslint-plugin-jsx-a11y` + axe color contrast rule; run Lighthouse accessibility audit | Short |
| INT-007 | Screen reader | Add `aria-live` to toast/notification components; verify all modal `aria-modal` and `aria-labelledby` | Short |
| INT-010 | Responsive navigation | Add hamburger menu / collapsible sidebar for mobile viewport | Medium |
| INT-014 | i18n | Add `next-intl` and extract all user-facing strings | Large |
| INT-016 | AI controllability | Add regenerate button to all AI-generated sections | Short |
| INT-017 | AI error specificity | Map common AI error codes to specific user messages (rate limit, timeout, content filter) | Short |

---

## Acceptance Criteria

- [ ] INT-015 AI content labeled (P2)
- [ ] INT-003 skip link added (P2 accessibility baseline)
- [ ] Quality attribute score ≥ 50% — currently 58.3% ✅
- [ ] All 14 interactive components have zero axe-core violations (already met)
