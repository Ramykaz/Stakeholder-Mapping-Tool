# Graph Contract: Cytoscape Rendering with Edges + Typed Node Shapes

**Feature**: Entity + Relation Extraction with Graph Integration  
**Version**: 1.0  
**Date**: 2026-03-15

---

## Node Shape Mapping (Server-Side)

The backend graph endpoint maps `entity_type` to Cytoscape shapes before returning nodes.

```javascript
const SHAPE_MAP = {
  'PERSON': 'ellipse',
  'ORGANIZATION': 'rectangle',
  'LOCATION': 'diamond',
  'ROLE': 'hexagon',
};
```

This mapping is **fixed** and **non-configurable** in MVP. All nodes of the same type render with the same shape.

---

## Cytoscape.js Stylesheet (Frontend)

The frontend applies styles to nodes and edges based on the data returned by the API.

### Node Styles

```javascript
{
  selector: 'node',
  style: {
    'label': 'data(label)',
    'shape': 'data(shape)', // ellipse | rectangle | diamond | hexagon
    'background-color': '#3b82f6',
    'color': '#1e40af',
    'text-valign': 'center',
    'text-halign': 'center',
    'font-size': '12px',
    'width': '60px',
    'height': '40px',
    'border-width': '2px',
    'border-color': '#2563eb',
  }
}
```

| Property | Value | Notes |
|----------|-------|-------|
| `shape` | `data(shape)` | Reads the shape from node data (server-provided) |
| `label` | `data(label)` | Entity canonical name |
| `background-color` | `#3b82f6` | Blue (can vary by type in future) |

**Low-confidence node styling** (optional):

```javascript
{
  selector: 'node[confidence < 0.5]',
  style: {
    'opacity': 0.5,
    'border-style': 'dashed',
  }
}
```

### Edge Styles

```javascript
{
  selector: 'edge',
  style: {
    'label': 'data(label)', // Relation label (e.g., "REPORTS_TO")
    'curve-style': 'bezier',
    'target-arrow-shape': 'triangle', // Directional arrow
    'target-arrow-color': '#64748b',
    'line-color': '#64748b',
    'width': 2,
    'font-size': '10px',
    'text-rotation': 'autorotate', // Keep labels readable on diagonal edges
    'text-margin-y': -10, // Position label above edge
    'color': '#475569',
  }
}
```

| Property | Value | Notes |
|----------|-------|-------|
| `label` | `data(label)` | Relation phrase (e.g., "REPORTS_TO") |
| `target-arrow-shape` | `'triangle'` | Arrow points from source → target |
| `text-rotation` | `'autorotate'` | Keeps label aligned with edge angle |
| `text-margin-y` | `-10` | Positions label slightly above the edge line |

**Low-confidence edge styling** (optional):

```javascript
{
  selector: 'edge[confidence < 0.5]',
  style: {
    'opacity': 0.5,
    'line-style': 'dashed',
  }
}
```

---

## Graph Layout

**Recommended layout**: `cose` (Compound Spring Embedder) — good for stakeholder networks with hierarchical and peer relationships.

```javascript
const layout = {
  name: 'cose',
  animate: true,
  animationDuration: 500,
  nodeRepulsion: 8000,
  idealEdgeLength: 100,
  edgeElasticity: 100,
  gravity: 1,
};
```

**Alternative**: `dagre` (directed acyclic graph) — useful if most relations are hierarchical (e.g., organizational charts).

---

## Interaction Behaviors

### Hover (Node)

- **Visual**: Highlight node border; show tooltip with entity details (type, confidence, chunk reference)
- **Implementation**: 
  ```javascript
  cy.on('mouseover', 'node', (evt) => {
    const node = evt.target;
    showTooltip(node.data('label'), node.data('entity_type'), node.data('confidence'));
  });
  ```

### Hover (Edge)

- **Visual**: Highlight edge; show tooltip with relation details (label, confidence, source/target names)
- **Implementation**:
  ```javascript
  cy.on('mouseover', 'edge', (evt) => {
    const edge = evt.target;
    showTooltip(
      `${edge.data('label')} (confidence: ${edge.data('confidence').toFixed(2)})`,
      `From: ${cy.$id(edge.data('source')).data('label')}`,
      `To: ${cy.$id(edge.data('target')).data('label')}`
    );
  });
  ```

### Click (Node)

- **Visual**: Select node; highlight all connected edges
- **Behavior**: Could navigate to entity detail view (future enhancement)

### Filter (Confidence Slider)

When user adjusts minimum confidence threshold:

```javascript
function applyConfidenceFilter(minConfidence) {
  cy.elements().forEach(el => {
    const conf = el.data('confidence');
    if (conf < minConfidence) {
      el.style('display', 'none');
    } else {
      el.style('display', 'element');
    }
  });
}
```

**Applies to both nodes and edges**: Low-confidence entities and relations are hidden together.

---

## Empty States

### No Entities
- **Condition**: `nodes.length === 0`
- **Display**: "No entities extracted for this document. Run entity extraction first."

### No Relations (but entities exist)
- **Condition**: `nodes.length > 0 && edges.length === 0`
- **Display**: Graph shows nodes only; message: "Entities extracted. Run 'Extract Entities + Relations' to see connections."

### No Entities Above Confidence Threshold
- **Condition**: `nodes.length > 0` but all filtered out
- **Display**: "No entities above the selected confidence threshold. Lower the filter to see results."

---

## Legend

The graph view should include a visual legend explaining node shapes and edge directionality.

```
 ⬭  PERSON           ━━▶  Directional relation
 ▬  ORGANIZATION     (arrow points from source to target)
 ♦  LOCATION
 ⬡  ROLE
```

---

## Performance Constraints

- **Render time**: Graph should render within 3 seconds for 100 nodes + 200 edges
- **Interactivity**: Hover/click responses within 50ms
- **Layout re-calculation**: Triggered only on filter change or new data load (not on every pan/zoom)

---

## Contract Guarantees

1. **Shape correctness**: Every node has a shape matching its entity_type; no nodes render with invalid or missing shapes.
2. **Edge directionality**: All edges have visible arrows pointing from source → target; no ambiguous undirected edges.
3. **Label visibility**: Edge labels are readable (not upside-down, not overlapping edges) for all edge orientations.
4. **Backward compatibility**: Documents with entity-only extraction render correctly (nodes shown, edges array empty).
5. **Referential integrity**: Every edge references node IDs that exist in the nodes array; no orphaned edges.
