/**
 * Graph data structure types for FastGraph
 */

export interface GraphNode {
  /** Unique identifier for the node */
  id: string;
  
  /** X coordinate (0-1 normalized, where 0 is left edge, 1 is right edge) */
  x: number;
  
  /** Y coordinate (0-1 normalized, where 0 is top edge, 1 is bottom edge) */
  y: number;
  
  /** Optional color as hex string (e.g., "#ff0000"). Defaults to "#3498db" */
  color?: string;
  
  /** Optional size/radius in pixels. Defaults to 5 */
  size?: number;
  
  /** Optional text label to display */
  label?: string;
}

export interface GraphEdge {
  /** ID of the source node */
  source: string;
  
  /** ID of the target node */
  target: string;
  
  /** Optional color as hex string (e.g., "#333333"). Defaults to "#95a5a6" */
  color?: string;
  
  /** Optional line width in pixels. Defaults to 1 */
  width?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Default values for optional node properties */
export const DEFAULT_NODE_COLOR = "#3498db";
export const DEFAULT_NODE_SIZE = 5;

/** Default values for optional edge properties */
export const DEFAULT_EDGE_COLOR = "#95a5a6";
export const DEFAULT_EDGE_WIDTH = 1;

/** Utility type for node positions */
export interface Position {
  x: number;
  y: number;
}

/** Utility type for colors in different formats */
export interface Color {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1
}