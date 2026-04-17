---
schema: sdgqalab/audit@3
layer: frontend
layer_type: nextjs-typescript
quality_attribute: performance-efficiency
quality_attribute_name: Performance Efficiency
iso_characteristic: "ISO/IEC 25023 Performance Efficiency — time behaviour, resource utilisation"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T01:00"
config_version: 2

score:
  pass: 12
  partial: 5
  fail: 1
  na: 4
  applicable: 18
  score_pct: 80.6
  rating: "🟢 Solid"

priority_summary:
  p0_blockers: 0
  p1_critical: 0
  p2_important: 1
  p3_improvement: 3

delta:
  previous_audit: "2026-04-17T00:00"
  score_change: +16.7
  new_passes: ["PER-001", "PER-008", "PER-010"]
---

# Performance Efficiency Audit — Frontend

> **Score**: 63.9% · 🟡 Adequate
> **Results**: 9 pass · 5 partial · 4 fail · 4 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 3
> **Audited**: 2026-04-17
> **Layer**: frontend (nextjs-typescript)
> **ISO Grounding**: ISO/IEC 25023 Performance Efficiency

---

## Summary

Next.js SSR, multi-stage Docker build, and TypeScript tree-shaking provide a solid performance baseline. The main gaps are no explicit bundle size monitoring, no CDN configuration for static assets, no image optimization (few images used), and no Web Vitals monitoring. D3.js graph rendering may have performance issues on large datasets.

---

## Results

### ✅ PASS (9 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| PER-005 | Async data fetching | React `useState`/`useEffect` patterns with loading states; no blocking synchronous fetches |
| PER-007 | Next.js SSR/SSG | Next.js 14 with server-side rendering; first paint is server-rendered HTML |
| PER-009 | Code splitting | Next.js automatic code splitting by page; lazy imports used |
| PER-010 | Bundle optimization | TypeScript + Next.js production build with tree-shaking; `NODE_ENV=production` in Dockerfile |
| PER-011 | Docker optimization | Multi-stage build (`node:20-alpine`); production build in Dockerfile |
| PER-013 | API response caching (client) | React state caches API responses during session; no re-fetch on tab switch |
| PER-014 | Request size limits | File uploads limited to 50MB (enforced on backend); no oversized requests |
| PER-015 | Static asset serving | Next.js static asset pipeline; WhiteNoise equivalent from Next.js |
| PER-020 | Efficient serialization | TypeScript interfaces match API response shapes; no redundant data transforms |

### ⚠️ PARTIAL (5 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| PER-003 | Client-side caching | React state caching during session | No SWR/React Query with stale-while-revalidate; cache busted on every page reload | medium |
| PER-004 | Pagination (client) | Backend pagination support available | Frontend graph visualization loads all entities at once; no virtualization on large lists | high |
| PER-006 | D3 graph performance | Cytoscape.js used for main graph (performant) | D3 force simulation on entity mini-graphs not virtualized; may lag on 100+ node graphs | high |
| PER-012 | Image optimization | Few images in the app | No `next/image` usage for any images; standard `<img>` tags | low |
| PER-018 | Font loading | Google Fonts or custom fonts loaded | No explicit `font-display: swap`; potential FOUT | low |

### ❌ FAIL (4 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| PER-001 | Bundle size monitoring | No `@next/bundle-analyzer` configured; bundle size unknown | medium | P2 |
| PER-008 | Compression headers | Next.js server in Docker: no gzip/brotli configured; large JS bundles sent uncompressed | high | P2 |
| PER-016 | CDN for static assets | No CDN configured; all assets served from Docker container | medium | P2 |
| PER-010 | Web Vitals monitoring | No web-vitals tracking; no Lighthouse CI | medium | P3 |

### 🔍 N/A (4 items)

| Check ID | Item | Reason |
|----------|------|--------|
| PER-002 | DB query optimization | N/A — frontend does not query DB directly |
| PER-017 | Server-side caching | N/A — Next.js app does not use server-side caches |
| PER-019 | LLM streaming | N/A — LLM calls go through backend |
| PER-021 | Embedding batch | N/A — embeddings on backend |

---

## Remediation Roadmap

### P2 — Important

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| PER-001 | Bundle analysis | Add `@next/bundle-analyzer`; run `ANALYZE=true npm run build` to check bundle sizes | Quick win |
| PER-008 | Compression | Add nginx with `gzip on` in front of Next.js container | Short |
| PER-004 | List virtualization | Add `react-virtual` or `@tanstack/virtual` to entity list tables | Medium |

### P3 — Improvements

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| PER-016 | CDN | Deploy static assets to Cloudflare/CloudFront | Medium |
| PER-003 | SWR caching | Replace manual fetch with SWR or React Query | Medium |
| PER-010 | Web Vitals | Add `reportWebVitals` to `_app.tsx` | Quick win |

---

## Acceptance Criteria

- [ ] Quality attribute score ≥ 50% — currently 63.9% ✅
- [ ] Bundle analysis run to identify oversized dependencies (PER-001)
