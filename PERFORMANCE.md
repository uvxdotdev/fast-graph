# FastGraph Performance Guide

## Entity Limits

FastGraph is designed to handle large graphs efficiently using GPU-accelerated rendering. Here are the current limits:

### Current Maximums
- **Nodes**: 100,000 per graph
- **Edges**: 200,000 per graph
- **WebGPU Texture Size**: 2048x2048 pixels

### Why These Limits?

These limits are based on:
1. **GPU Memory**: Buffer allocation for instanced rendering
2. **WebGPU Constraints**: Browser implementation limits
3. **Performance**: Maintaining 60fps rendering
4. **Browser Stability**: Preventing memory crashes

## Performance Characteristics

### Small Graphs (< 100 nodes, < 200 edges)
- **Performance**: Excellent (60+ FPS)
- **Memory Usage**: < 1MB
- **Recommendations**: No special considerations needed

### Medium Graphs (100-1,000 nodes, 200-2,000 edges)
- **Performance**: Very Good (60 FPS)
- **Memory Usage**: 1-10MB
- **Recommendations**: 
  - Use moderate node sizes (5-10px radius)
  - Keep edge widths reasonable (1-3px)

### Large Graphs (1,000-10,000 nodes, 2,000-20,000 edges)
- **Performance**: Good (30-60 FPS)
- **Memory Usage**: 10-50MB
- **Recommendations**:
  - Reduce node sizes (3-6px radius)
  - Use thinner edges (0.5-2px)
  - Consider hiding labels
  - Test on target devices

### Very Large Graphs (10,000-100,000 nodes, 20,000-200,000 edges)
- **Performance**: Variable (15-60 FPS)
- **Memory Usage**: 50-200MB
- **Recommendations**:
  - Use small nodes (1-4px radius)
  - Use very thin edges (0.5-1px)
  - Implement level-of-detail (LOD)
  - Consider data clustering
  - Test extensively on mobile

## Memory Usage

### Per-Entity Memory Cost
```
Node: 28 bytes (7 floats × 4 bytes)
├── Position: 8 bytes (x, y)
├── Color: 16 bytes (r, g, b, a)
└── Size: 4 bytes (radius)

Edge: 36 bytes (9 floats × 4 bytes)
├── Start Position: 8 bytes (x1, y1)
├── End Position: 8 bytes (x2, y2)
├── Color: 16 bytes (r, g, b, a)
└── Width: 4 bytes (thickness)
```

### Memory Calculations
```
1,000 nodes + 2,000 edges = ~100KB GPU memory
10,000 nodes + 20,000 edges = ~1MB GPU memory
100,000 nodes + 200,000 edges = ~10MB GPU memory
```

## Browser Limitations

### WebGPU Support
| Browser | Version | Status |
|---------|---------|---------|
| Chrome | 113+ | ✅ Stable |
| Edge | 113+ | ✅ Stable |
| Firefox | 121+ | ⚠️ Behind flag |
| Safari | 18+ | ⚠️ Preview |

### Device Limitations
- **Mobile**: Lower memory, reduced performance
- **Integrated GPUs**: May struggle with >50K entities
- **Older Hardware**: May not support WebGPU

## Optimization Strategies

### 1. Data Preprocessing
```typescript
import { checkGraphLimits, getPerformanceRecommendations } from '@uvxdotdev/fastgraph';

const limitCheck = checkGraphLimits(nodes, edges, true);
if (limitCheck.warnings.length > 0) {
  console.warn('Graph limits:', limitCheck.warnings);
}

const recommendations = getPerformanceRecommendations(nodes.length, edges.length);
```

### 2. Level of Detail (LOD)
- Show simplified nodes when zoomed out
- Hide edges below certain zoom levels
- Reduce node detail at distance

### 3. Clustering
- Group nearby nodes into clusters
- Show cluster representatives
- Expand clusters on zoom/click

### 4. Viewport Culling
- Only render visible entities
- Use spatial indexing (quadtree)
- Implement frustum culling

### 5. Data Streaming
- Load graph data incrementally
- Prioritize visible regions
- Use virtual scrolling concepts

## Performance Monitoring

### Built-in Monitoring
```typescript
// Check current entity counts
const nodeCount = renderer.get_current_node_count();
const edgeCount = renderer.get_current_edge_count();

// Check limits
const maxNodes = renderer.get_max_nodes();
const maxEdges = renderer.get_max_edges();

console.log(`Using ${nodeCount}/${maxNodes} nodes, ${edgeCount}/${maxEdges} edges`);
```

### Performance Metrics
Monitor these in browser dev tools:
- **FPS**: Target 30-60 FPS
- **GPU Memory**: Available in browser tools
- **CPU Usage**: Should be low during steady rendering
- **Frame Time**: Consistent timing indicates smooth rendering

## Handling Large Datasets

### 1. Pagination
```typescript
const CHUNK_SIZE = 1000;
const chunks = [];
for (let i = 0; i < largeNodeArray.length; i += CHUNK_SIZE) {
  chunks.push(largeNodeArray.slice(i, i + CHUNK_SIZE));
}
```

### 2. Filtering
```typescript
// Show only important nodes
const importantNodes = allNodes.filter(node => node.importance > threshold);
const connectedEdges = getConnectedEdges(edges, importantNodes.map(n => n.id));
```

### 3. Aggregation
```typescript
// Combine multiple nodes into single representative
const clusteredNodes = aggregateNodesByRegion(nodes, gridSize);
```

## Future Improvements

### Planned Optimizations
1. **Compute Shaders**: GPU-based layout algorithms
2. **Instanced Rendering**: More efficient GPU utilization
3. **Texture Atlasing**: Reduced draw calls
4. **Occlusion Culling**: Skip hidden entities

### Scalability Roadmap
- **v0.2**: Support for 500K entities
- **v0.3**: Streaming and LOD systems
- **v0.4**: Distributed rendering for massive graphs

## Troubleshooting

### Common Issues

**Nodes/Edges Disappearing**
- Check entity count limits
- Verify WebGPU support
- Check browser console for warnings

**Poor Performance**
- Reduce entity count
- Decrease node/edge sizes
- Check GPU memory usage

**Memory Errors**
- Reduce graph complexity
- Implement data chunking
- Check available system memory

### Getting Help

1. Check browser console for warnings
2. Use built-in limit checking utilities
3. Monitor performance metrics
4. Consider graph simplification strategies

For optimal performance, start with smaller graphs and scale up while monitoring performance metrics.