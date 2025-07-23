# FastGraph

High-performance graph rendering React component library powered by Rust, WASM, and WebGPU.

## Features

- 🚀 **High Performance**: Rust + WebAssembly + WebGPU for maximum speed
- ⚛️ **React Ready**: Drop-in React components with TypeScript support
- 🎨 **Customizable**: Easy color theming and styling
- 📱 **Responsive**: Automatic canvas sizing and device pixel ratio handling
- 🌐 **Modern**: Uses latest web technologies for optimal performance

## Installation

```bash
npm install fast-graph
# or
yarn add fast-graph
# or
bun add fast-graph
```

## Quick Start

```tsx
import React from 'react';
import { FastGraph } from 'fast-graph';

function App() {
  return (
    <div>
      <h1>My Visualization</h1>
      <FastGraph 
        color1="#ff0000" 
        color2="#0000ff" 
        width={800} 
        height={400} 
      />
    </div>
  );
}

export default App;
```

## API Reference

### FastGraph Component

The main component for rendering animated gradients.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `color1` | `string` | `"#ff0000"` | First gradient color (hex format) |
| `color2` | `string` | `"#0000ff"` | Second gradient color (hex format) |
| `width` | `number` | `800` | Canvas width in pixels |
| `height` | `number` | `600` | Canvas height in pixels |
| `className` | `string` | `undefined` | CSS class name |
| `style` | `React.CSSProperties` | `undefined` | Inline styles |

#### Example Usage

```tsx
import { FastGraph } from 'fast-graph';

// Basic usage
<FastGraph color1="#ff0000" color2="#0000ff" />

// Custom dimensions
<FastGraph 
  color1="#8b00ff" 
  color2="#00ffff" 
  width={1200} 
  height={600} 
/>

// With styling
<FastGraph 
  color1="#ff8c00" 
  color2="#ff1493" 
  className="my-graph"
  style={{ borderRadius: '8px' }}
/>
```

### Supported Color Formats

- **Hex**: `#ff0000`, `#f00`, `#ff0000ff`
- **CSS Color Names**: Support planned for future versions

## Browser Support

FastGraph requires browsers with WebGPU support:

- **Chrome/Chromium**: 113+ (with WebGPU enabled)
- **Firefox**: Experimental support (flag required)
- **Safari**: Technical Preview
- **Edge**: 113+ (with WebGPU enabled)

For browsers without WebGPU support, the component will display an error message.

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/)
- [Bun](https://bun.sh/) (preferred) or Node.js 16+

### Setup

1. Clone the repository:
```bash
git clone https://github.com/your-username/fast-graph.git
cd fast-graph
```

2. Install dependencies:
```bash
bun install
```

3. Build the project:
```bash
./build.sh
```

### Development Commands

```bash
# Full build
./build.sh

# Clean build artifacts
./build.sh clean

# Build only Rust WASM
./build.sh rust

# Build only TypeScript
./build.sh ts

# Quick development build
./build.sh dev

# Install dependencies
bun install

# Run tests
bun test
```

### Project Structure

```
fast-graph/
├── src/                   # React components (TypeScript)
│   ├── FastGraph.tsx     # Main component
│   └── index.ts          # Export declarations
├── rust-core/            # Rust WebGPU core
│   ├── src/
│   │   ├── lib.rs        # WASM bindings
│   │   ├── renderer.rs   # WebGPU renderer
│   │   └── shaders/      # WebGPU shaders
│   └── Cargo.toml
├── example/              # Usage examples
├── dist/                 # Built library
└── build.sh             # Build script
```

### Testing the Examples

After building, open `example/index.html` in a browser that supports WebGPU to see the component in action.

## Architecture

FastGraph uses a multi-layer architecture:

1. **React Layer**: TypeScript React components with hooks for lifecycle management
2. **WASM Bindings**: Rust-generated WebAssembly for performance-critical operations
3. **WebGPU Core**: Rust-based renderer using WebGPU for hardware acceleration
4. **Shader Layer**: WGSL shaders for GPU-based rendering effects

## Roadmap

- [ ] Multiple graph types (line, bar, scatter)
- [ ] Data binding and real-time updates
- [ ] More color format support
- [ ] Animation controls
- [ ] Touch/mouse interaction
- [ ] WebGL fallback for older browsers
- [ ] Performance profiling tools

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [wgpu-rs](https://github.com/gfx-rs/wgpu) for WebGPU bindings
- Inspired by high-performance visualization libraries
- Thanks to the Rust and WebAssembly communities