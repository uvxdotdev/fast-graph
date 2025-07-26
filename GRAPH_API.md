# FastGraph API Documentation

## Basic Usage

FastGraph now supports rendering actual graph data with nodes and edges! Pass your graph data as two simple arrays:

```tsx
import React from 'react';
import { FastGraph } from '@uvxdotdev/fastgraph';

function MyGraphComponent() {
  const nodes = [
    { id: 'A', x: 0.2, y: 0.3, color: '#ff0000', size: 8 },
    { id: 'B', x: 0.8, y: 0.3, color: '#00ff00', size: 10 },
    { id: 'C', x: 0.5, y: 0.7, color: '#0000ff', size: 6 }
  ];

  const edges = [
    { source: 'A', target: 'B', color: '#333', width: 2 },
    { source: 'B', target: 'C', color: '#666', width: 1 },
    { source: 'C', target: 'A', color: '#999', width: 1.5 }
  ];

  return (
    <FastGraph 
      nodes={nodes}
      edges={edges}
      width={800}
      height={600}
    />
  );
}
```

## Data Structure

### GraphNode

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier for the node |
| `x` | `number` | ✅ | X coordinate (0-1, where 0=left, 1=right) |
| `y` | `number` | ✅ | Y coordinate (0-1, where 0=top, 1=bottom) |
| `color` | `string` | ❌ | Hex color (default: "#3498db") |
| `size` | `number` | ❌ | Radius in pixels (default: 5) |
| `label` | `string` | ❌ | Text label to display |

### GraphEdge

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `source` | `string` | ✅ | ID of source node |
| `target` | `string` | ✅ | ID of target node |
| `color` | `string` | ❌ | Hex color (default: "#95a5a6") |
| `width` | `number` | ❌ | Line width in pixels (default: 1) |

## Example Graphs

### Linear Chain
```tsx
const linearGraph = {
  nodes: [
    { id: '1', x: 0.1, y: 0.5, color: '#e74c3c' },
    { id: '2', x: 0.3, y: 0.5, color: '#f39c12' },
    { id: '3', x: 0.5, y: 0.5, color: '#f1c40f' },
    { id: '4', x: 0.7, y: 0.5, color: '#27ae60' },
    { id: '5', x: 0.9, y: 0.5, color: '#3498db' }
  ],
  edges: [
    { source: '1', target: '2' },
    { source: '2', target: '3' },
    { source: '3', target: '4' },
    { source: '4', target: '5' }
  ]
};
```

### Grid Layout
```tsx
const gridGraph = {
  nodes: [
    { id: 'A1', x: 0.2, y: 0.2 }, { id: 'A2', x: 0.5, y: 0.2 }, { id: 'A3', x: 0.8, y: 0.2 },
    { id: 'B1', x: 0.2, y: 0.5 }, { id: 'B2', x: 0.5, y: 0.5 }, { id: 'B3', x: 0.8, y: 0.5 },
    { id: 'C1', x: 0.2, y: 0.8 }, { id: 'C2', x: 0.5, y: 0.8 }, { id: 'C3', x: 0.8, y: 0.8 }
  ],
  edges: [
    { source: 'A1', target: 'A2' }, { source: 'A2', target: 'A3' },
    { source: 'B1', target: 'B2' }, { source: 'B2', target: 'B3' },
    { source: 'C1', target: 'C2' }, { source: 'C2', target: 'C3' },
    { source: 'A1', target: 'B1' }, { source: 'A2', target: 'B2' }, { source: 'A3', target: 'B3' },
    { source: 'B1', target: 'C1' }, { source: 'B2', target: 'C2' }, { source: 'B3', target: 'C3' }
  ]
};
```

### Star Pattern
```tsx
const starGraph = {
  nodes: [
    { id: 'center', x: 0.5, y: 0.5, color: '#e74c3c', size: 15 },
    { id: 'n1', x: 0.5, y: 0.2, color: '#3498db', size: 8 },
    { id: 'n2', x: 0.7, y: 0.3, color: '#3498db', size: 8 },
    { id: 'n3', x: 0.8, y: 0.5, color: '#3498db', size: 8 },
    { id: 'n4', x: 0.7, y: 0.7, color: '#3498db', size: 8 },
    { id: 'n5', x: 0.5, y: 0.8, color: '#3498db', size: 8 },
    { id: 'n6', x: 0.3, y: 0.7, color: '#3498db', size: 8 },
    { id: 'n7', x: 0.2, y: 0.5, color: '#3498db', size: 8 },
    { id: 'n8', x: 0.3, y: 0.3, color: '#3498db', size: 8 }
  ],
  edges: [
    { source: 'center', target: 'n1', color: '#9b59b6', width: 2 },
    { source: 'center', target: 'n2', color: '#9b59b6', width: 2 },
    { source: 'center', target: 'n3', color: '#9b59b6', width: 2 },
    { source: 'center', target: 'n4', color: '#9b59b6', width: 2 },
    { source: 'center', target: 'n5', color: '#9b59b6', width: 2 },
    { source: 'center', target: 'n6', color: '#9b59b6', width: 2 },
    { source: 'center', target: 'n7', color: '#9b59b6', width: 2 },
    { source: 'center', target: 'n8', color: '#9b59b6', width: 2 }
  ]
};
```

## Using Built-in Generators

FastGraph includes several graph generators for quick testing:

```tsx
import { generateCircularGraph, generateRandomGraph, getExampleGraph } from '@uvxdotdev/fastgraph';

// Use a specific generator
const circularGraph = generateCircularGraph(8);
const randomGraph = generateRandomGraph(10, 0.3);

// Or get a predefined example
const treeGraph = getExampleGraph('tree');
const gridGraph = getExampleGraph('grid');

return <FastGraph nodes={circularGraph.nodes} edges={circularGraph.edges} />;
```

Available generators:
- `generateLinearGraph(nodeCount)` - Linear chain
- `generateGridGraph(rows, cols)` - Grid layout  
- `generateRandomGraph(nodeCount, edgeProbability)` - Random connections
- `generateCircularGraph(nodeCount)` - Circular arrangement
- `generateTreeGraph(depth, branchingFactor)` - Hierarchical tree
- `generateStarGraph(outerNodeCount)` - Star pattern
- `generateCompleteGraph(nodeCount)` - Fully connected
- `generateBipartiteGraph(leftCount, rightCount, connectionProbability)` - Two-sided

## Dynamic Updates

Graph data can be updated in real-time:

```tsx
function DynamicGraph() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  const addNode = () => {
    const newNode = {
      id: `node-${Date.now()}`,
      x: Math.random(),
      y: Math.random(),
      color: '#27ae60'
    };
    setNodes(prev => [...prev, newNode]);
  };

  const addEdge = (sourceId, targetId) => {
    const newEdge = { source: sourceId, target: targetId };
    setEdges(prev => [...prev, newEdge]);
  };

  return (
    <>
      <button onClick={addNode}>Add Node</button>
      <FastGraph nodes={nodes} edges={edges} />
    </>
  );
}
```

## Coordinate System

- **X coordinates**: 0 = left edge, 1 = right edge
- **Y coordinates**: 0 = top edge, 1 = bottom edge
- **Sizes**: Specified in pixels
- **Colors**: Hex format (#RGB, #RRGGBB, #RRGGBBAA)

## Performance Notes

- Coordinates are normalized (0-1) for resolution independence
- Data is validated and processed efficiently in Rust/WASM
- GPU rendering scales to thousands of nodes
- Only one FastGraph component can be active at a time due to WebGPU limitations

## Validation

FastGraph includes built-in validation:

```tsx
import { validateGraph } from '@uvxdotdev/fastgraph';

const validation = validateGraph(nodes, edges);
if (!validation.isValid) {
  console.error('Graph validation errors:', validation.errors);
}
```

Common validation errors:
- Missing or duplicate node IDs
- Coordinates outside 0-1 range
- Edges referencing non-existent nodes
- Invalid hex colors
- Negative sizes or widths