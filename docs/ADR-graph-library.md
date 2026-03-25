# ADR: Graph Visualization Library — D3.js vs Cytoscape.js

**Date**: 2026-03-24
**Status**: Accepted
**Deciders**: Ramadan (Project Lead), Josue (Frontend Architecture Consultant)

---

## Context

The stakeholder analysis platform uses Cytoscape.js for all graph visualization, integrated in `frontend/src/components/GraphVisualization.tsx`. As the platform scales toward 10k+ nodes and more complex layout requirements (cluster views, focus mode, timeline layout), we conducted a spike to evaluate whether Cytoscape.js remains the right choice or whether migrating to D3.js would provide meaningful benefits.

The evaluation covers five dimensions: edge bundling performance at 500+ nodes, custom layout support, animation and transition quality, bundle size and Next.js SSR compatibility, and estimated migration effort.

---

## Evaluation

### 1. Edge Bundling Performance at 500+ Nodes

**Cytoscape.js**: Handles 1,000–10,000 nodes with acceptable performance in force-directed layout (`cose`, `cose-bilkent`). The `cytoscape-canvas` renderer (WebGL-backed) is available as a plugin for large graphs. At 500 nodes with our current cose layout, frame rates are acceptable on modern hardware. The existing filter panel (spec 010) reduces rendered nodes client-side, which further improves perceived performance.

**D3.js**: `d3-force` handles large graphs well and can leverage canvas rendering directly. For edge bundling specifically, D3 has `d3-force` and community libraries like `d3-edge-bundling`, but these require significant custom implementation — D3 provides primitives, not ready-made solutions.

**Verdict**: Comparable at our current scale. Cytoscape.js plugins cover the gap without custom implementation. **No advantage for D3.**

---

### 2. Custom Layout Support

**Cytoscape.js**: Ships with `circle`, `grid`, `breadthfirst`, `cose` (physics-based), `concentric`, and `dagre` layouts. Plugin ecosystem adds `cose-bilkent` (constrained force), `cola` (WebCola constraint solver), `spread`, `elk`, and more. Type-based cluster layout (spec 010) was implemented using cose with positional seeding — no external library needed. A timeline layout (nodes arranged on a horizontal time axis) can be implemented as a custom positional layout using Cytoscape's `positions` callback.

**D3.js**: D3 has no built-in graph layout. All layouts are implemented via `d3-force` simulation with custom forces or external libraries. Timeline layout is D3's strongest relative advantage — `d3-timeline` and custom x-axis force implementations are well-documented. Louvain clustering requires the same external algorithm regardless of library (neither ships Louvain natively).

**Verdict**: Cytoscape.js has a richer ready-made layout ecosystem. Timeline layout is achievable in both. **Slight advantage for Cytoscape.js.**

---

### 3. Animation and Transition Quality

**Cytoscape.js**: Animation API supports per-element position, style, and class transitions via `element.animate()`. Focus mode dimming (spec 010) is implemented using style class toggles — smooth and responsive. Hover transitions are CSS-class-based and render well at 60fps on modern hardware.

**D3.js**: D3's interpolation and transition system (`d3.transition`, `selection.transition()`) is more expressive and lower-level, allowing precise control over easing, duration, and interpolation for each visual property. For complex animated storytelling or streaming graph updates, D3's transition system is superior.

**Verdict**: D3 has finer-grained animation control. Cytoscape.js is sufficient for current requirements (focus mode, hover dimming, layout transitions). **D3 has a theoretical advantage; not relevant to current requirements.**

---

### 4. Bundle Size and Next.js SSR Compatibility

**Cytoscape.js**:
- Bundle size: ~900KB minified (including core + cose layout)
- SSR: Cytoscape.js is not SSR-compatible — it requires `window` and `document`. The current integration uses a `typeof window !== 'undefined'` guard and dynamic import pattern, which works correctly with Next.js 14 pages router.
- Current status: Already integrated and working.

**D3.js**:
- Bundle size: D3 full package ~500KB, but a full graph visualization requires additional sub-packages (`d3-force`, `d3-zoom`, `d3-drag`, `d3-selection`, `d3-transition`, `d3-scale`), netting approximately 700–800KB in practice.
- SSR: D3 core works server-side (no DOM dependency) but DOM-manipulating code requires the same `window` guard pattern. The integration overhead is similar.
- Current status: Not integrated; would require all visualization code to be written from scratch.

**Verdict**: Similar bundle size in practice. Both require SSR guards. **No advantage for D3; Cytoscape.js already integrated.**

---

### 5. Estimated Migration Effort

Migrating from Cytoscape.js to D3.js would require:

| Component | Scope |
|-----------|-------|
| `GraphVisualization.tsx` | Full rewrite (~600 lines) — all Cytoscape element/style/event APIs replaced with D3 selections and force simulation |
| `cytoscapeStyle.ts` | Full replacement — all stylesheet logic rewritten as D3 scale functions and attribute setters |
| `graphFocus.ts` | Significant changes — hop neighborhood, cluster positioning, degree-to-size mapping reusable but layout API completely different |
| Focus mode, hover dimming | Full rewrite — Cytoscape class-based dimming replaced with D3 opacity transitions |
| Filter panel integration | Rewrite — Cytoscape `show()`/`hide()` replaced with D3 data join and update pattern |
| Testing | All graph visualization tests need to be rewritten |

**Estimated effort**: 3–5 engineering days minimum, plus regression testing of all graph features delivered in specs 008–010.

**Verdict**: High migration cost, no proportional benefit at current scale. **D3 migration is not justified.**

---

## Decision

**Stay with Cytoscape.js.**

Cytoscape.js meets all current and foreseeable requirements for this platform:
- 10k node/edge scale is within its performance envelope, especially with the existing client-side filter panel
- Type-based cluster layout and focus mode are fully implemented and working
- Timeline layout can be added as a custom positional layout without switching libraries
- Bundle size and SSR patterns are already solved and in production

Migrating to D3.js would provide meaningful benefits only if the platform needs highly custom animated storytelling, streaming graph updates with complex transitions, or a timeline-first layout as the primary visualization mode — none of which are in the current roadmap.

---

## Consequences

- All future graph features (spec 011+) continue to use Cytoscape.js APIs
- If a timeline layout is added, it is implemented as a Cytoscape positional layout
- This decision is revisited if node count consistently exceeds 5,000 or if animated storytelling becomes a primary product requirement
- The `cytoscape-canvas` WebGL renderer plugin should be evaluated as a performance optimization before any re-evaluation of D3 migration
