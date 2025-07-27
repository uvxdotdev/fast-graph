# 🚀 FastGraph

High-performance **graph visualization** React component library powered by **Rust**, **WebAssembly**, and **WebGPU compute shaders**.

[![npm version](https://badge.fury.io/js/@uvxdotdev%2Ffastgraph.svg)](https://badge.fury.io/js/@uvxdotdev%2Ffastgraph)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔥 **WebGPU Accelerated**: GPU compute shaders for physics simulation
- ⚡ **High Performance**: Rust + WASM core with spatial partitioning
- 📊 **Interactive Graphs**: Drag nodes, pan, zoom, and explore
- 🎯 **Physics Simulation**: Spring forces, node repulsion, and damping
- 📱 **Responsive**: Automatic canvas sizing with device pixel ratio support
- 🔧 **TypeScript**: Full type safety out of the box
- 🪶 **Zero Dependencies**: Lightweight with no external runtime deps
- 🎮 **Real-time FPS**: Performance monitoring built-in

## 📦 Installation

```bash
npm install @uvxdotdev/fastgraph
```

Or with other package managers:

```bash
yarn add @uvxdotdev/fastgraph
pnpm add @uvxdotdev/fastgraph
bun add @uvxdotdev/fastgraph
```

## 🎯 Quick Start

```tsx
import React from 'react';
import { FastGraph } from '@uvxdotdev/fastgraph';

const nodes = [
  { id: '1', x: 0.3, y: 0.3, color: '#ff6b6b', size: 8 },
  { id: '2', x: 0.7, y: 0.4, color: '#4ecdc4', size: 12 },
  { id: '3', x: 0.5, y: 0.7, color: '#45b7d1', size: 10 }
];

const edges = [
  { source: '1', target: '2', color: '#666', width: 2 },
  { source: '2', target: '3', color: '#999', width: 1.5 }
];

function App() {
  return (
    <FastGraph 
      nodes={nodes}
      edges={edges}
      width={800} 
      height={600}
      enablePhysics={true}
      useGPUAcceleration={true}
    />
  );
}

export default App;
```

## 📖 API Reference

### FastGraph Component

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nodes` | `GraphNode[]` | `[]` | Array of graph nodes |
| `edges` | `GraphEdge[]` | `[]` | Array of graph edges |
| `width` | `number` | `800` | Canvas width in pixels |
| `height` | `number` | `600` | Canvas height in pixels |
| `enablePhysics` | `boolean` | `false` | Enable physics simulation |
| `useGPUAcceleration` | `boolean` | `false` | Use WebGPU compute shaders |
| `dampingFactor` | `number` | `0.99` | Physics damping (0-1) |
| `springConstant` | `number` | `0.01` | Spring force strength |
| `restLength` | `number` | `0.1` | Spring rest length |
| `color1` | `string` | `#ff0000` | Background gradient color 1 |
| `color2` | `string` | `#0000ff` | Background gradient color 2 |
| `className` | `string` | `undefined` | CSS class for container |
| `style` | `CSSProperties` | `undefined` | Inline styles for container |

#### Node Data Structure

```tsx
interface GraphNode {
  id: string;           // Unique identifier
  x: number;            // X position (0-1 normalized)
  y: number;            // Y position (0-1 normalized) 
  color?: string;       // Hex color (default: '#3498db')
  size?: number;        // Radius in pixels (default: 5)
  vx?: number;          // X velocity for physics
  vy?: number;          // Y velocity for physics
}
```

#### Edge Data Structure

```tsx
interface GraphEdge {
  source: string;       // Source node ID
  target: string;       // Target node ID
  color?: string;       // Hex color (default: '#666666')
  width?: number;       // Line width (default: 1)
}
```

## 🎮 Interactive Controls

FastGraph includes built-in interactive controls:

### Camera Controls
- **Zoom In/Out**: Buttons in top-right corner or mouse wheel
- **Pan**: Hold `Shift` and drag, or toggle `PAN` button
- **Reset**: Home button to reset camera position
- **Focus**: Click canvas to enable keyboard shortcuts

### Node Interaction
- **Drag Nodes**: Click and drag any node to move it
- **Hover Effects**: Nodes highlight on mouse hover
- **Physics Response**: Dragged nodes affect connected springs

### Visual Feedback
- **FPS Counter**: Real-time performance in bottom-left
- **Control Help**: Interactive guide in top-left
- **Pan Mode Indicator**: Shows current interaction mode

## 🎨 Usage Examples

### Static Network Graph

```tsx
import React from 'react';
import { FastGraph } from '@uvxdotdev/fastgraph';

const socialNetwork = {
  nodes: [
    { id: 'alice', x: 0.5, y: 0.3, color: '#e74c3c', size: 12 },
    { id: 'bob', x: 0.3, y: 0.6, color: '#3498db', size: 10 },
    { id: 'charlie', x: 0.7, y: 0.6, color: '#2ecc71', size: 8 },
    { id: 'diana', x: 0.5, y: 0.8, color: '#f39c12', size: 10 }
  ],
  edges: [
    { source: 'alice', target: 'bob', width: 3 },
    { source: 'alice', target: 'charlie', width: 2 },
    { source: 'bob', target: 'diana', width: 1.5 },
    { source: 'charlie', target: 'diana', width: 2.5 }
  ]
};

function SocialNetworkViz() {
  return (
    <FastGraph 
      nodes={socialNetwork.nodes}
      edges={socialNetwork.edges}
      width={600}
      height={400}
      enablePhysics={false}
    />
  );
}
```

### Dynamic Physics Simulation

```tsx
import React, { useState, useEffect } from 'react';
import { FastGraph } from '@uvxdotdev/fastgraph';

function PhysicsDemo() {
  const [nodes, setNodes] = useState([
    { id: '1', x: 0.2, y: 0.2, vx: 0.1, vy: 0.05, color: '#ff6b6b', size: 8 },
    { id: '2', x: 0.8, y: 0.3, vx: -0.1, vy: 0.1, color: '#4ecdc4', size: 10 },
    { id: '3', x: 0.5, y: 0.8, vx: 0.05, vy: -0.1, color: '#45b7d1', size: 12 }
  ]);

  const edges = [
    { source: '1', target: '2', color: '#666' },
    { source: '2', target: '3', color: '#999' },
    { source: '3', target: '1', color: '#ccc' }
  ];

  return (
    <div>
      <h3>🚀 GPU-Accelerated Physics</h3>
      <FastGraph 
        nodes={nodes}
        edges={edges}
        enablePhysics={true}
        useGPUAcceleration={true}
        dampingFactor={0.98}
        springConstant={0.02}
        width={800}
        height={600}
      />
    </div>
  );
}
```

### Responsive Graph Layout

```tsx
import React, { useEffect, useState } from 'react';
import { FastGraph } from '@uvxdotdev/fastgraph';

function ResponsiveGraph() {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      const container = document.getElementById('graph-container');
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.min(container.clientHeight, 600)
        });
      }
    };

    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const generateNodes = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `node-${i}`,
      x: Math.random(),
      y: Math.random(),
      color: `hsl(${(i * 137.5) % 360}, 70%, 60%)`,
      size: 4 + Math.random() * 8
    }));
  };

  return (
    <div id="graph-container" style={{ width: '100%', height: '100vh' }}>
      <FastGraph 
        nodes={generateNodes(50)}
        edges={[]}
        width={dimensions.width}
        height={dimensions.height}
        enablePhysics={true}
        useGPUAcceleration={true}
      />
    </div>
  );
}
```

## ⚙️ Vite Configuration

FastGraph requires special Vite configuration for WebGPU and WASM support:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    fs: {
      allow: ['..', '.']
    }
  },
  optimizeDeps: {
    exclude: ['@uvxdotdev/fastgraph']
  },
  assetsInclude: ['**/*.wasm'],
  define: {
    global: 'globalThis',
  }
})
```

### 🚨 Alternative: Use Bun Development Server

For the best development experience with WASM:

```bash
bunx serve . -p 3000
```

## 🔧 Browser Requirements

### WebGPU Support Required

FastGraph requires browsers with **WebGPU support** for GPU acceleration:

- ✅ **Chrome 113+** (stable)
- ✅ **Edge 113+** (stable) 
- ✅ **Safari 18+** (preview/beta)
- ⚠️ **Firefox 121+** (enable `dom.webgpu.enabled`)

### Enable WebGPU (if needed)

```bash
# Chrome/Edge
chrome://flags/#enable-unsafe-webgpu

# Firefox
about:config → dom.webgpu.enabled = true
```

### Graceful Fallback

```tsx
function GraphWithFallback() {
  const [hasWebGPU, setHasWebGPU] = useState(false);

  useEffect(() => {
    setHasWebGPU('gpu' in navigator);
  }, []);

  if (!hasWebGPU) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        border: '2px dashed #ccc',
        borderRadius: '8px'
      }}>
        <h3>⚠️ WebGPU Required</h3>
        <p>Please use Chrome 113+ or Edge 113+ for the best experience.</p>
        <p>Or enable WebGPU in your browser settings.</p>
      </div>
    );
  }

  return (
    <FastGraph 
      nodes={nodes}
      edges={edges}
      enablePhysics={true}
      useGPUAcceleration={true}
    />
  );
}
```

## 🛠️ Performance Tips

### GPU vs CPU Physics

```tsx
// ⚡ GPU Accelerated (recommended for large graphs)
<FastGraph 
  nodes={manyNodes}
  edges={manyEdges}
  enablePhysics={true}
  useGPUAcceleration={true}  // Uses WebGPU compute shaders
/>

// 🖥️ CPU Only (fallback for small graphs)
<FastGraph 
  nodes={fewNodes}
  edges={fewEdges}
  enablePhysics={true}
  useGPUAcceleration={false} // Uses CPU calculations
/>
```

### Optimization Guidelines

- **GPU Acceleration**: Best for 100+ nodes with physics
- **Static Graphs**: Disable physics for better performance  
- **Canvas Size**: Larger canvases require more GPU memory
- **Node Count**: GPU shows biggest benefit with 500+ nodes
- **FPS Monitoring**: Use built-in counter to track performance

## 🚀 Physics System

FastGraph includes a sophisticated physics engine with:

### Force Simulation
- **Spring Forces**: Connects nodes via edges with configurable stiffness
- **Repulsion Forces**: Prevents node overlap with distance-based falloff
- **Damping**: Gradually reduces velocity for stable layouts

### GPU Compute Pipeline
- **Spatial Partitioning**: Efficient O(n) repulsion calculations
- **Multi-pass Shaders**: Optimized compute workgroups
- **Memory Management**: Automatic buffer sizing and updates

### Physics Parameters

```tsx
<FastGraph 
  enablePhysics={true}
  useGPUAcceleration={true}
  dampingFactor={0.99}      // 0.9 = high damping, 0.99 = low damping
  springConstant={0.01}     // 0.001 = weak springs, 0.1 = strong springs  
  restLength={0.1}          // Preferred edge length (normalized)
/>
```

## 🎯 Roadmap

- [ ] 🔍 **Clustering Algorithms**: Automatic community detection
- [ ] 📊 **Layout Algorithms**: Force-directed, hierarchical, circular
- [ ] 🎨 **Visual Enhancements**: Node labels, edge labels, themes
- [ ] 📱 **Touch Support**: Multi-touch gestures and mobile optimization
- [ ] 🔄 **Animation Timeline**: Keyframe-based graph animations
- [ ] 📈 **Performance Analytics**: Detailed GPU utilization metrics
- [ ] 🌐 **Data Integration**: CSV, JSON, GraphML import/export

## 🏗️ Development

### Building from Source

```bash
git clone https://github.com/uvxdotdev/fastgraph.git
cd fastgraph

# Install dependencies  
bun install

# Build Rust + WASM core
cd rust-core && wasm-pack build --target web --release && cd ..

# Build TypeScript library
bun run build

# Test the component
bun serve test-physics.html
```

### Project Architecture

```
fastgraph/
├── src/                    # React TypeScript components
│   ├── FastGraph.tsx      # Main graph component
│   └── index.ts           # Public exports
├── rust-core/             # Rust + WebGPU engine
│   ├── src/
│   │   ├── lib.rs         # WASM bindings
│   │   └── renderer.rs    # WebGPU renderer + physics
│   └── Cargo.toml
├── dist/                  # Built library
├── test-physics.html      # Physics demo
└── README.md
```

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Test your changes with WebGPU browsers
4. Submit a Pull Request with clear description

### Development Setup

```bash
# Required tools
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# Development workflow
./build.sh              # Build everything
bun serve test-physics.html  # Test in browser
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[wgpu](https://wgpu.rs/)**: WebGPU implementation for Rust
- **[wasm-pack](https://rustwasm.github.io/wasm-pack/)**: Rust/WASM toolchain
- **Graph algorithms**: Inspired by D3.js force simulation

---

**⚡ High-performance graph visualization for the modern web**

Built with Rust 🦀 + WebGPU 🔥 + React ⚛️

For questions and support, visit our [GitHub repository](https://github.com/uvxdotdev/fastgraph).