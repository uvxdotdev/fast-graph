/**
 * Example graph data generators for testing and demonstration
 */
import { GraphData } from './types';
/**
 * Generates a simple linear chain of nodes
 */
export declare function generateLinearGraph(nodeCount?: number): GraphData;
/**
 * Generates a grid-based graph
 */
export declare function generateGridGraph(rows?: number, cols?: number): GraphData;
/**
 * Generates a random graph with specified density
 */
export declare function generateRandomGraph(nodeCount?: number, edgeProbability?: number): GraphData;
/**
 * Generates a circular graph (nodes arranged in a circle)
 */
export declare function generateCircularGraph(nodeCount?: number): GraphData;
/**
 * Generates a tree/hierarchical graph
 */
export declare function generateTreeGraph(depth?: number, branchingFactor?: number): GraphData;
/**
 * Generates a star graph (one central node connected to all others)
 */
export declare function generateStarGraph(outerNodeCount?: number): GraphData;
/**
 * Generates a complete graph (every node connected to every other node)
 */
export declare function generateCompleteGraph(nodeCount?: number): GraphData;
/**
 * Generates a bipartite graph
 */
export declare function generateBipartiteGraph(leftCount?: number, rightCount?: number, connectionProbability?: number): GraphData;
/**
 * Collection of all example generators
 */
export declare const exampleGraphs: {
    linear: typeof generateLinearGraph;
    grid: typeof generateGridGraph;
    random: typeof generateRandomGraph;
    circular: typeof generateCircularGraph;
    tree: typeof generateTreeGraph;
    star: typeof generateStarGraph;
    complete: typeof generateCompleteGraph;
    bipartite: typeof generateBipartiteGraph;
};
/**
 * Get a specific example by name with default parameters
 */
export declare function getExampleGraph(name: keyof typeof exampleGraphs): GraphData;
//# sourceMappingURL=examples.d.ts.map