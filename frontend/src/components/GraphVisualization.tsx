import React, { useEffect, useRef, useCallback } from 'react';
import cytoscape, { Core } from 'cytoscape';
import { cytoscapeStylesheet, ENTITY_COLORS } from '@/lib/cytoscapeStyle';
import { CytoscapeNode } from '@/types';

interface GraphVisualizationProps {
  nodes: CytoscapeNode[];
  onNodeClick?: (node: CytoscapeNode) => void;
}

function GraphVisualizationInner({ nodes, onNodeClick }: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const initGraph = useCallback(() => {
    if (!containerRef.current) return;

    // Destroy previous instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    // Convert API nodes to Cytoscape elements
    const elements = nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        entity_type: node.data.entity_type,
        confidence: node.data.confidence,
        document_id: node.data.document_id,
        chunk_id: node.data.chunk_id,
        raw_mentions_count: node.data.raw_mentions_count,
      },
    }));

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: cytoscapeStylesheet,
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 100,
        gravity: 0.25,
        padding: 40,
      } as any,
      minZoom: 0.3,
      maxZoom: 3,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    // Node click handler
    if (onNodeClick) {
      cy.on('tap', 'node', (evt) => {
        const nodeData = evt.target.data();
        const clickedNode: CytoscapeNode = {
          id: nodeData.id,
          label: nodeData.label,
          data: {
            entity_id: nodeData.id,
            entity_type: nodeData.entity_type,
            confidence: nodeData.confidence,
            document_id: nodeData.document_id,
            chunk_id: nodeData.chunk_id,
            raw_mentions_count: nodeData.raw_mentions_count,
          },
        };
        onNodeClick(clickedNode);
      });
    }

    cyRef.current = cy;
  }, [nodes, onNodeClick]);

  useEffect(() => {
    initGraph();
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [initGraph]);

  const handleFitView = () => {
    cyRef.current?.fit(undefined, 40);
  };

  const handleResetLayout = () => {
    if (!cyRef.current) return;
    cyRef.current.layout({
      name: 'cose',
      animate: true,
      animationDuration: 500,
      nodeRepulsion: () => 8000,
      idealEdgeLength: () => 100,
      gravity: 0.25,
      padding: 40,
    } as any).run();
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          {Object.entries(ENTITY_COLORS).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm border"
                style={{ backgroundColor: colors.bg, borderColor: colors.border }}
              />
              <span className="text-gray-600">{type}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFitView}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Fit View
          </button>
          <button
            onClick={handleResetLayout}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Reset Layout
          </button>
        </div>
      </div>

      {/* Graph container */}
      <div
        ref={containerRef}
        id="cytoscape-container"
        role="img"
        aria-label="Stakeholder entity graph visualization"
      />

      {/* Node count */}
      <p className="text-xs text-gray-500 text-right">
        {nodes.length} node{nodes.length !== 1 ? 's' : ''} displayed
      </p>
    </div>
  );
}

export default GraphVisualizationInner;
