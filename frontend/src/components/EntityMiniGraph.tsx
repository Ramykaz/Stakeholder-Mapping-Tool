import React from 'react';
import { MiniNode, MiniEdge } from '@/lib/entityNeighborhood';
import { getEntityColor } from '@/lib/entityTypes';

interface Props {
  nodes: MiniNode[];
  edges: MiniEdge[];
  onNodeClick: (nodeId: string) => void;
}

export default function EntityMiniGraph({ nodes, edges, onNodeClick }: Props) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  if (nodes.length <= 1) {
    return <div style={{ color: 'var(--text3)', fontSize: 13 }}>No connections extracted from documents yet.</div>;
  }

  return (
    <div>
      <svg viewBox="0 0 400 320" width="100%" height="320" role="img" aria-label="Entity neighborhood mini graph">
        <defs>
          <marker id="mini-graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--text2)" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const source = nodeById.get(edge.sourceId);
          const target = nodeById.get(edge.targetId);
          if (!source || !target) return null;
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          return (
            <g key={edge.id}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="var(--text2)"
                strokeWidth="2"
                markerEnd="url(#mini-graph-arrow)"
                markerStart={edge.isBidirectional ? 'url(#mini-graph-arrow)' : undefined}
              />
              <text x={midX} y={midY - 4} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                {edge.label}
              </text>
            </g>
          );
        })}

        {nodes.map((node) => {
          const strokeColor = getEntityColor(node.entityType || 'Role');
          return (
          <g
            key={node.id}
            onClick={() => !node.isCenter && onNodeClick(node.id)}
            style={{ cursor: node.isCenter ? 'default' : 'pointer' }}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={node.isCenter ? 24 : 18}
              fill={node.isCenter ? 'var(--accent-soft)' : 'var(--bg2)'}
              stroke={strokeColor}
              strokeWidth={node.isCenter ? 3 : 2}
            />
            <text
              x={node.x}
              y={node.y + (node.isCenter ? 40 : 32)}
              textAnchor="middle"
              style={{ fontSize: node.isCenter ? 12 : 11, fill: 'var(--text2)' }}
            >
              {node.label.length > 22 ? `${node.label.slice(0, 22)}…` : node.label}
            </text>
          </g>
        )})}
      </svg>

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
        Connection guide: arrows show direction ({'A → B'} means A points to B). Double-arrow ({'A ↔ B'}) means both directions exist.
      </div>

      <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--bg3)' }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>CONNECTIONS</div>
        {edges.slice(0, 8).map((edge) => (
          <div key={`summary-${edge.id}`} style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>
            {edge.directionText} · {edge.label} · {edge.isBidirectional ? 'two-way' : 'one-way'}
          </div>
        ))}
      </div>
    </div>
  );
}
