/**
 * Utility functions for graph data processing and validation
 */
import { GraphNode, GraphEdge, Color } from './types';
/**
 * Validates a single graph node
 */
export declare function validateNode(node: GraphNode): string[];
/**
 * Validates a single graph edge
 */
export declare function validateEdge(edge: GraphEdge, nodeIds: Set<string>): string[];
/**
 * Validates an entire graph data structure
 */
export declare function validateGraph(nodes: GraphNode[], edges: GraphEdge[]): {
    isValid: boolean;
    errors: string[];
};
/**
 * Checks if a string is a valid hex color
 */
export declare function isValidHexColor(color: string): boolean;
/**
 * Converts hex color to RGBA values (0-1 range)
 */
export declare function hexToRgba(hex: string): Color;
/**
 * Normalizes node data by applying defaults and validating ranges
 */
export declare function normalizeNode(node: GraphNode): Required<Omit<GraphNode, 'label'>> & Pick<GraphNode, 'label'>;
/**
 * Normalizes edge data by applying defaults
 */
export declare function normalizeEdge(edge: GraphEdge): Required<GraphEdge>;
/**
 * Converts normalized coordinates (0-1) to canvas pixel coordinates
 */
export declare function normalizedToCanvas(normalizedX: number, normalizedY: number, canvasWidth: number, canvasHeight: number): {
    x: number;
    y: number;
};
/**
 * Converts canvas pixel coordinates to normalized coordinates (0-1)
 */
export declare function canvasToNormalized(canvasX: number, canvasY: number, canvasWidth: number, canvasHeight: number): {
    x: number;
    y: number;
};
/**
 * Finds a node by its ID
 */
export declare function findNodeById(nodes: GraphNode[], id: string): GraphNode | undefined;
/**
 * Gets all edges connected to a specific node
 */
export declare function getConnectedEdges(edges: GraphEdge[], nodeId: string): GraphEdge[];
/**
 * Prepares graph data for efficient GPU rendering
 * Returns flattened arrays suitable for buffer creation
 */
export declare function prepareGraphDataForGPU(nodes: GraphNode[], edges: GraphEdge[], canvasWidth: number, canvasHeight: number): {
    nodeData: Float32Array<ArrayBuffer>;
    edgeData: Float32Array<ArrayBuffer>;
    nodeCount: number;
    edgeCount: number;
    nodeStride: number;
    edgeStride: number;
};
/**
 * Calculates the bounding box of all nodes
 */
export declare function getGraphBounds(nodes: GraphNode[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};
export declare const MAX_NODES = 100000;
export declare const MAX_EDGES = 200000;
export interface LimitCheckResult {
    nodeCount: number;
    edgeCount: number;
    nodeCountExceeded: boolean;
    edgeCountExceeded: boolean;
    warnings: string[];
    truncatedNodes?: GraphNode[];
    truncatedEdges?: GraphEdge[];
}
/**
 * Checks if graph data exceeds rendering limits and provides warnings
 */
export declare function checkGraphLimits(nodes: GraphNode[], edges: GraphEdge[], truncate?: boolean): LimitCheckResult;
/**
 * Gets performance recommendations based on graph size
 */
export declare function getPerformanceRecommendations(nodeCount: number, edgeCount: number): string[];
/**
 * Adds random velocity to a node for physics simulation
 */
export declare function addRandomVelocity(node: GraphNode, minSpeed?: number, maxSpeed?: number): GraphNode;
/**
 * Updates node position based on velocity and deltaTime
 */
export declare function updateNodePosition(node: GraphNode, deltaTime: number): GraphNode;
/**
 * Applies damping/friction to node velocity
 */
export declare function applyDamping(node: GraphNode, dampingFactor?: number): GraphNode;
/**
 * Calculates spring force between two connected nodes
 */
export declare function calculateSpringForce(node1: GraphNode, node2: GraphNode, restLength?: number, springConstant?: number): {
    fx: number;
    fy: number;
};
/**
 * Applies spring forces to all nodes based on edges
 */
export declare function applySpringForces(nodes: GraphNode[], edges: GraphEdge[], restLength?: number, springConstant?: number, draggedNodeIndex?: number | null): GraphNode[];
/**
 * Updates all nodes in a graph with physics simulation including spring forces
 */
export declare function updateGraphPhysics(nodes: GraphNode[], edges: GraphEdge[], deltaTime: number, dampingFactor?: number, springConstant?: number, restLength?: number, draggedNodeIndex?: number | null): GraphNode[];
//# sourceMappingURL=utils.d.ts.map