export { FastGraph, type FastGraphProps } from './FastGraph';
export { FastGraph as default } from './FastGraph';

// Graph data types
export type { 
  GraphNode, 
  GraphEdge, 
  GraphData, 
  Position, 
  Color 
} from './types';

export { 
  DEFAULT_NODE_COLOR, 
  DEFAULT_NODE_SIZE, 
  DEFAULT_EDGE_COLOR, 
  DEFAULT_EDGE_WIDTH 
} from './types';

// Graph utilities
export {
  validateNode,
  validateEdge,
  validateGraph,
  isValidHexColor,
  hexToRgba,
  normalizeNode,
  normalizeEdge,
  normalizedToCanvas,
  canvasToNormalized,
  findNodeById,
  getConnectedEdges,
  prepareGraphDataForGPU,
  getGraphBounds,
  MAX_NODES,
  MAX_EDGES,
  checkGraphLimits,
  getPerformanceRecommendations
} from './utils';

export type { LimitCheckResult } from './utils';

// Example graph generators
export {
  generateLinearGraph,
  generateGridGraph,
  generateRandomGraph,
  generateCircularGraph,
  generateTreeGraph,
  generateStarGraph,
  generateCompleteGraph,
  generateBipartiteGraph,
  exampleGraphs,
  getExampleGraph
} from './examples';