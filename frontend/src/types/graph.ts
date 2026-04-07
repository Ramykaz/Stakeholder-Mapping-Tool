export type GraphNodeId = string;

export interface GraphNodeStyle {
  shape?: string;
  color?: string;
  node_size?: number;
}

export interface GraphNodeData {
  entity_id?: string;
  entity_type?: string;
  confidence?: number;
  document_id?: string;
  chunk_id?: string | null;
  raw_mentions_count?: number;
  degree?: number;
  node_size?: number;
}

export interface GraphNode {
  id: GraphNodeId;
  label: string;
  entity_type?: string;
  degree?: number;
  style?: GraphNodeStyle;
  data?: GraphNodeData;
}

export interface GraphEdgeData {
  confidence?: number;
  relation_type?: string;
  is_bidirectional?: boolean;
}

export interface GraphEdge {
  id: string;
  source: GraphNodeId;
  target: GraphNodeId;
  label?: string;
  confidence?: number;
  relation_type?: string;
  data?: GraphEdgeData;
}

export interface GraphViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface GraphInteractionState {
  hoveredNodeId: GraphNodeId | null;
  selectedNodeId: GraphNodeId | null;
  focusedNodeId: GraphNodeId | null;
  hideIsolatedNodes: boolean;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
