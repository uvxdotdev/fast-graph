# 🚀 FastGraph

High-performance React component library for rendering animated gradients and graphics, powered by **Rust**, **WebAssembly**, and **WebGPU**.

[![npm version](https://badge.fury.io/js/@uvxdotdev%2Ffastgraph.svg)](https://badge.fury.io/js/@uvxdotdev%2Ffastgraph)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔥 **Hardware Accelerated**: Powered by WebGPU for maximum performance
- ⚡ **Lightning Fast**: Core rendering engine written in Rust + WASM
- 🎨 **Beautiful Gradients**: Smooth, animated color transitions
- 📱 **Responsive**: Automatic canvas sizing with device pixel ratio support
- 🔧 **TypeScript**: Full type safety out of the box
- 🪶 **Lightweight**: Minimal bundle size with zero dependencies
- 🎯 **React Ready**: Drop-in component for any React project

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

function App() {
  return (
    <div>
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

## 📖 API Reference

### FastGraph Component

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `color1` | `string` | `#ff0000` | First gradient color (hex format) |
| `color2` | `string` | `#0000ff` | Second gradient color (hex format) |
| `width` | `number` | `600` | Canvas width in pixels |
| `height` | `number` | `300` | Canvas height in pixels |
| `className` | `string` | `undefined` | CSS class name for the container |
| `style` | `CSSProperties` | `undefined` | Inline styles for the container |

#### Example with All Props

```tsx
<FastGraph 
  color1="#ff6b6b"
  color2="#4ecdc4"
  width={1200}
  height={600}
  className="my-gradient"
  style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
/>
```

## 🎨 Usage Examples

### Interactive Color Picker

```tsx
import React, { useState } from 'react';
import { FastGraph } from '@uvxdotdev/fastgraph';

function InteractiveDemo() {
  const [color1, setColor1] = useState('#ff0000');
  const [color2, setColor2] = useState('#0000ff');

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <label>
          Color 1: 
          <input 
            type="color" 
            value={color1} 
            onChange={(e) => setColor1(e.target.value)} 
          />
        </label>
        <label>
          Color 2: 
          <input 
            type="color" 
            value={color2} 
            onChange={(e) => setColor2(e.target.value)} 
          />
        </label>
      </div>
      
      <FastGraph 
        color1={color1}
        color2={color2}
        width={800}
        height={400}
      />
    </div>
  );
}
```

### Responsive Design

```tsx
import React, { useEffect, useState } from 'react';
import { FastGraph } from '@uvxdotdev/fastgraph';

function ResponsiveGradient() {
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: Math.min(window.innerWidth - 40, 1200),
        height: Math.min(window.innerHeight * 0.6, 600)
      });
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <FastGraph 
      color1="#667eea"
      color2="#764ba2"
      width={dimensions.width}
      height={dimensions.height}
    />
  );
}
```

## ⚙️ Vite Configuration

If you're using **Vite** as your build tool, you need special configuration to properly serve WASM files. Add the following to your `vite.config.ts`:

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
    },
    watch: {
      ignored: ['!**/node_modules/@uvxdotdev/fastgraph/**']
    }
  },
  optimizeDeps: {
    exclude: ['@uvxdotdev/fastgraph'],
    include: ['react', 'react-dom']
  },
  assetsInclude: ['**/*.wasm'],
  define: {
    global: 'globalThis',
  },
  worker: {
    format: 'es'
  }
})
```

### 🔍 **Why These Settings Are Needed:**

- **CORS Headers**: Required for WebGPU and WASM SharedArrayBuffer support
- **File System Access**: Allows Vite to serve files from node_modules 
- **Exclude from Optimization**: Prevents Vite from pre-bundling the WASM module
- **WASM Assets**: Treats .wasm files as static assets with correct MIME types
- **Global Definition**: Ensures compatibility with WASM-generated code

### 🚨 **Alternative: Use Bun Serve**

If you encounter issues with Vite, you can use Bun's built-in server which handles WASM perfectly:

```bash
# Instead of: npm run dev
bunx serve . -p 3000
```

## 🛠️ Troubleshooting

### Common Issues

#### "WebGPU not supported" Error
```bash
# Enable WebGPU in your browser:
# Chrome/Edge: chrome://flags/#enable-unsafe-webgpu
# Firefox: about:config → dom.webgpu.enabled = true
```

#### WASM Loading Errors with Vite
```bash
# Error: "Failed to fetch dynamically imported module"
# Solution: Use the Vite configuration above or switch to bun serve
bunx serve . -p 3000
```

#### "Canvas element not found" Error
```tsx
// Make sure your canvas has proper dimensions
<FastGraph 
  width={800}    // Must be > 0
  height={400}   // Must be > 0
  color1="#ff0000"
  color2="#0000ff"
/>
```

#### Performance Issues
```tsx
// Limit the number of FastGraph components (only one active at a time)
// Use smaller canvas dimensions for better performance
<FastGraph width={400} height={200} />
```

#### Build Errors with TypeScript
```json
// Add to tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  }
}
```

## 🔧 Requirements

### Browser Support

FastGraph requires browsers with **WebGPU support**:

- ✅ Chrome 113+ (stable)
- ✅ Edge 113+ (stable) 
- ✅ Firefox 121+ (behind flag)
- ✅ Safari 18+ (preview)

### Fallback Handling

```tsx
function App() {
  const [webGPUSupported, setWebGPUSupported] = useState(false);

  useEffect(() => {
    setWebGPUSupported('gpu' in navigator);
  }, []);

  if (!webGPUSupported) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3>WebGPU Not Supported</h3>
        <p>This browser doesn't support WebGPU. Please use Chrome 113+ or Edge 113+.</p>
      </div>
    );
  }

  return <FastGraph color1="#ff0000" color2="#0000ff" />;
}
```

## 🏗️ Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/uvxdotdev/fastgraph.git
cd fastgraph

# Install dependencies
bun install

# Build the library
./build.sh

# Test the component
bun run serve
```

### Project Structure

```
@uvxdotdev/fastgraph/
├── src/                    # TypeScript React components
│   ├── FastGraph.tsx      # Main component
│   └── index.ts           # Public exports
├── rust-core/             # Rust + WASM core
│   ├── src/               # Rust source code
│   ├── shaders/           # WebGPU shaders
│   └── Cargo.toml         # Rust dependencies
├── dist/                  # Built library
└── sample-app/            # Example React app
```

## 🎯 Roadmap

- [ ] 📊 Graph plotting components (line, bar, scatter)
- [ ] 🎛️ Interactive controls and zoom
- [ ] 🎨 More gradient patterns and effects
- [ ] 📱 React Native support
- [ ] 🔄 Animation timeline controls
- [ ] 🎪 3D visualizations

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [wgpu](https://wgpu.rs/) for WebGPU bindings
- Powered by [wasm-pack](https://github.com/rustwasm/wasm-pack) for Rust/WASM integration
- Inspired by modern graphics programming techniques

---

**Made with ❤️ and ⚡ by the FastGraph team**

For questions, issues, or feature requests, please visit our [GitHub repository](https://github.com/uvxdotdev/fastgraph).