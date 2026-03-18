# Contract: Frontend Interaction Model (US-08)

## Scope
Defines required UI behavior for graph rendering, side-panel drill-down, filtering/focus/search interactions, and summary request states.

## 1) Graph Rendering Contract

### Inputs
- `nodes[]` with `entity_type`, `degree`, `style.shape`, `style.color`
- `edges[]` with `relation_type`, `label`, `confidence`

### Required Behavior
- Node shape/color render from payload style metadata.
- Node size scales from degree within bounded min/max values.
- Edge thickness scales from confidence within bounded min/max values.
- Relationship labels are discoverable on hover/select.

---

## 2) Side Panel Contract

### Open/Close
- Click node => open right-side panel for selected entity.
- Close panel => return full-width map state without refetch.

### Content Sections
- Header: entity name + type badge
- Contextual summary section (on-demand)
- Grouped relationships
- Aliases
- Related projects
- Supporting excerpts

### Drill-Down
- Click related entity in panel => panel navigates to target entity.
- Back action restores previous panel entity from history stack.

---

## 3) Filters + Focus + Search Contract

### Filters
- Entity-type and relationship-type filters are client-side only.
- Filter changes update visibility immediately without graph refetch.

### Focus Mode
- Shift+click node activates two-hop focus.
- Focus neighborhood is computed on currently filtered visible graph only.
- Nodes/edges outside neighborhood are de-emphasized.
- Background click resets focus to filtered baseline state.

### Search
- Typing highlights matching visible nodes in real time.
- Best/current match is centered in viewport.

---

## 4) Summary UX State Contract

### Trigger
- Summary generation starts only when user clicks explicit action (e.g., `Generate summary`).

### States
- `idle`: no summary yet
- `loading`: request in flight (<=8s)
- `ready`: summary text shown
- `fallback`: timeout/provider issue; retry action shown

### Cache + Refresh
- Cached summary (<24h) is returned immediately on request.
- Manual refresh forces regeneration and updates cached value.

### Error/Fallback
- Timeout or provider unavailability must not block panel rendering of other sections.
- Retry action must remain available in fallback state.
