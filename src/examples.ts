/**
 * Example graph data generators for testing and demonstration
 */

import { GraphNode, GraphEdge, GraphData } from './types';

/**
 * Generates a simple linear chain of nodes
 */
export function generateLinearGraph(nodeCount: number = 5): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node-${i}`,
      x: 0.1 + (0.8 * i) / (nodeCount - 1),
      y: 0.5,
      color: `hsl(${(i * 360) / nodeCount}, 70%, 50%)`,
      size: 8,
      label: `Node ${i}`
    });
    
    if (i > 0) {
      edges.push({
        source: `node-${i - 1}`,
        target: `node-${i}`,
        color: '#34495e',
        width: 2
      });
    }
  }
  
  return { nodes, edges };
}

/**
 * Generates a grid-based graph
 */
export function generateGridGraph(rows: number = 3, cols: number = 4): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  
  // Create nodes in grid pattern
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = `node-${row}-${col}`;
      nodes.push({
        id,
        x: 0.1 + (0.8 * col) / (cols - 1),
        y: 0.1 + (0.8 * row) / (rows - 1),
        color: '#3498db',
        size: 6,
        label: `(${row},${col})`
      });
    }
  }
  
  // Create edges between adjacent nodes
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const currentId = `node-${row}-${col}`;
      
      // Connect to right neighbor
      if (col < cols - 1) {
        edges.push({
          source: currentId,
          target: `node-${row}-${col + 1}`,
          color: '#95a5a6',
          width: 1
        });
      }
      
      // Connect to bottom neighbor
      if (row < rows - 1) {
        edges.push({
          source: currentId,
          target: `node-${row + 1}-${col}`,
          color: '#95a5a6',
          width: 1
        });
      }
    }
  }
  
  return { nodes, edges };
}

/**
 * Generates a random graph with specified density
 */
export function generateRandomGraph(nodeCount: number = 10, edgeProbability: number = 0.3): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  
  // Create random nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node-${i}`,
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
      color: `hsl(${Math.random() * 360}, 60%, 50%)`,
      size: 4 + Math.random() * 8,
      label: `R${i}`
    });
  }
  
  // Create random edges
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      if (Math.random() < edgeProbability) {
        edges.push({
          source: `node-${i}`,
          target: `node-${j}`,
          color: '#7f8c8d',
          width: 0.5 + Math.random() * 2
        });
      }
    }
  }
  
  return { nodes, edges };
}

/**
 * Generates a circular graph (nodes arranged in a circle)
 */
export function generateCircularGraph(nodeCount: number = 8): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const centerX = 0.5;
  const centerY = 0.5;
  const radius = 0.35;
  
  // Create nodes in circle
  for (let i = 0; i < nodeCount; i++) {
    const angle = (2 * Math.PI * i) / nodeCount;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    nodes.push({
      id: `node-${i}`,
      x,
      y,
      color: `hsl(${(i * 360) / nodeCount}, 80%, 60%)`,
      size: 10,
      label: `C${i}`
    });
    
    // Connect to next node (circular)
    const nextIndex = (i + 1) % nodeCount;
    edges.push({
      source: `node-${i}`,
      target: `node-${nextIndex}`,
      color: '#2c3e50',
      width: 3
    });
  }
  
  return { nodes, edges };
}

/**
 * Generates a tree/hierarchical graph
 */
export function generateTreeGraph(depth: number = 3, branchingFactor: number = 2): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  
  let nodeId = 0;
  
  function addNode(x: number, y: number, level: number): string {
    const id = `node-${nodeId++}`;
    nodes.push({
      id,
      x,
      y,
      color: `hsl(${level * 60}, 70%, 50%)`,
      size: 8 - level,
      label: `L${level}`
    });
    return id;
  }
  
  function generateLevel(parentId: string | null, level: number, x: number, y: number, width: number): string[] {
    if (level >= depth) return [];
    
    const levelNodes: string[] = [];
    const nodeCount = level === 0 ? 1 : branchingFactor;
    
    for (let i = 0; i < nodeCount; i++) {
      const nodeX = nodeCount === 1 ? x : x - width/2 + (width * i) / (nodeCount - 1);
      const nodeId = addNode(nodeX, y, level);
      levelNodes.push(nodeId);
      
      if (parentId) {
        edges.push({
          source: parentId,
          target: nodeId,
          color: '#34495e',
          width: 2
        });
      }
      
      // Generate children
      const nextY = y + 0.8 / depth;
      const nextWidth = width / branchingFactor;
      generateLevel(nodeId, level + 1, nodeX, nextY, nextWidth);
    }
    
    return levelNodes;
  }
  
  generateLevel(null, 0, 0.5, 0.1, 0.8);
  
  return { nodes, edges };
}

/**
 * Generates a star graph (one central node connected to all others)
 */
export function generateStarGraph(outerNodeCount: number = 6): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  
  // Central node
  nodes.push({
    id: 'center',
    x: 0.5,
    y: 0.5,
    color: '#e74c3c',
    size: 15,
    label: 'Center'
  });
  
  // Outer nodes in circle
  const radius = 0.3;
  for (let i = 0; i < outerNodeCount; i++) {
    const angle = (2 * Math.PI * i) / outerNodeCount;
    const x = 0.5 + radius * Math.cos(angle);
    const y = 0.5 + radius * Math.sin(angle);
    const id = `outer-${i}`;
    
    nodes.push({
      id,
      x,
      y,
      color: '#3498db',
      size: 8,
      label: `O${i}`
    });
    
    edges.push({
      source: 'center',
      target: id,
      color: '#9b59b6',
      width: 2
    });
  }
  
  return { nodes, edges };
}

/**
 * Generates a complete graph (every node connected to every other node)
 */
export function generateCompleteGraph(nodeCount: number = 5): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  
  // Create nodes in circle for better visibility
  const centerX = 0.5;
  const centerY = 0.5;
  const radius = 0.3;
  
  for (let i = 0; i < nodeCount; i++) {
    const angle = (2 * Math.PI * i) / nodeCount;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    nodes.push({
      id: `node-${i}`,
      x,
      y,
      color: `hsl(${(i * 360) / nodeCount}, 70%, 55%)`,
      size: 8,
      label: `K${i}`
    });
  }
  
  // Connect every node to every other node
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      edges.push({
        source: `node-${i}`,
        target: `node-${j}`,
        color: '#34495e',
        width: 1
      });
    }
  }
  
  return { nodes, edges };
}

/**
 * Generates a bipartite graph
 */
export function generateBipartiteGraph(leftCount: number = 4, rightCount: number = 3, connectionProbability: number = 0.6): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  
  // Left side nodes
  for (let i = 0; i < leftCount; i++) {
    nodes.push({
      id: `left-${i}`,
      x: 0.2,
      y: 0.1 + (0.8 * i) / (leftCount - 1),
      color: '#e67e22',
      size: 8,
      label: `L${i}`
    });
  }
  
  // Right side nodes
  for (let i = 0; i < rightCount; i++) {
    nodes.push({
      id: `right-${i}`,
      x: 0.8,
      y: 0.1 + (0.8 * i) / (rightCount - 1),
      color: '#27ae60',
      size: 8,
      label: `R${i}`
    });
  }
  
  // Random connections between left and right
  for (let i = 0; i < leftCount; i++) {
    for (let j = 0; j < rightCount; j++) {
      if (Math.random() < connectionProbability) {
        edges.push({
          source: `left-${i}`,
          target: `right-${j}`,
          color: '#95a5a6',
          width: 1.5
        });
      }
    }
  }
  
  return { nodes, edges };
}

/**
 * Collection of all example generators
 */
export const exampleGraphs = {
  linear: generateLinearGraph,
  grid: generateGridGraph,
  random: generateRandomGraph,
  circular: generateCircularGraph,
  tree: generateTreeGraph,
  star: generateStarGraph,
  complete: generateCompleteGraph,
  bipartite: generateBipartiteGraph
};

/**
 * Get a specific example by name with default parameters
 */
export function getExampleGraph(name: keyof typeof exampleGraphs): GraphData {
  switch (name) {
    case 'linear':
      return generateLinearGraph(6);
    case 'grid':
      return generateGridGraph(3, 4);
    case 'random':
      return generateRandomGraph(8, 0.4);
    case 'circular':
      return generateCircularGraph(8);
    case 'tree':
      return generateTreeGraph(3, 3);
    case 'star':
      return generateStarGraph(7);
    case 'complete':
      return generateCompleteGraph(5);
    case 'bipartite':
      return generateBipartiteGraph(4, 3, 0.7);
    default:
      return generateLinearGraph(5);
  }
}