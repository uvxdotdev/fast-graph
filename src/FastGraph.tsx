import React, { useRef, useEffect, useCallback, useState } from 'react';
import { GraphNode, GraphEdge } from './types';
import { prepareGraphDataForGPU, normalizedToCanvas, hexToRgba } from './utils';

interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface FastGraphProps {
  /** Array of graph nodes to render */
  nodes?: GraphNode[];
  
  /** Array of graph edges to render */
  edges?: GraphEdge[];
  
  /** Background gradient color 1 (fallback to gradient mode if no nodes) */
  color1?: string;
  
  /** Background gradient color 2 (fallback to gradient mode if no nodes) */
  color2?: string;
  
  /** Canvas width in pixels */
  width?: number;
  
  /** Canvas height in pixels */
  height?: number;
  
  /** CSS class name for the canvas element */
  className?: string;
  
  /** React CSS properties for styling */
  style?: React.CSSProperties;
}

// Singleton WebGPU manager - only one component can be active
let activeComponentId: string | null = null;


const registerComponent = (id: string): boolean => {
  if (activeComponentId === null) {
    activeComponentId = id;
    return true;
  }
  return activeComponentId === id;
};

const unregisterComponent = (id: string): void => {
  if (activeComponentId === id) {
    activeComponentId = null;
  }
};
let wasmModule: any = null;
let wasmModulePromise: Promise<any> | null = null;

const loadWasmModule = async (): Promise<any> => {
  if (wasmModule) {
    return wasmModule;
  }

  if (wasmModulePromise) {
    return wasmModulePromise;
  }

  wasmModulePromise = (async () => {
    try {
      let module;
      
      // Try multiple import strategies for different environments
      try {
        // Strategy 1: Direct relative import (development/local build)
        // @ts-ignore - WASM module will be available at runtime
        module = await import('./pkg/fast_graph_core.js');
      } catch (relativeError) {
        try {
          // Strategy 2: Try resolving from the package root
          // @ts-ignore - Dynamic import for npm package
          module = await import('@uvxdotdev/fastgraph/dist/pkg/fast_graph_core.js');
        } catch (packageError) {
          try {
            // Strategy 3: Use current module URL as base for resolution
            const currentScript = document.currentScript as HTMLScriptElement;
            const baseUrl = currentScript?.src || window.location.href;
            const wasmUrl = new URL('pkg/fast_graph_core.js', baseUrl).href;
            // @ts-ignore - Dynamic URL-based import
            module = await import(wasmUrl);
          } catch (urlError) {
            // Strategy 4: Try common CDN/package paths
            const possiblePaths = [
              '/node_modules/@uvxdotdev/fastgraph/dist/pkg/fast_graph_core.js',
              './node_modules/@uvxdotdev/fastgraph/dist/pkg/fast_graph_core.js',
              '../pkg/fast_graph_core.js'
            ];
            
            for (const path of possiblePaths) {
              try {
                // @ts-ignore - Dynamic path import
                module = await import(path);
                break;
              } catch (pathError) {
                continue;
              }
            }
            
            if (!module) {
              throw new Error('All WASM import strategies failed');
            }
          }
        }
      }

      // Initialize the WASM module
      await module.default();
      wasmModule = module;
      return module;
    } catch (error) {
      console.error('Failed to load WASM module:', error);
      wasmModulePromise = null; // Reset promise to allow retry
      throw new Error(`Failed to load FastGraph WASM module: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();

  return wasmModulePromise;
};

export const FastGraph: React.FC<FastGraphProps> = ({
  nodes = [],
  edges = [],
  color1 = '#ff0000',
  color2 = '#0000ff',
  width = 800,
  height = 600,
  className,
  style,
}) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<any>(null);
  const animationIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isGraphMode, setIsGraphMode] = useState(false);
  
  // Camera state
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, zoom: 1 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const componentId = useRef(`fast-graph-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`);
  const initialColorsRef = useRef({ color1, color2 });
  const mountedRef = useRef(true);
  const lastSizeRef = useRef({ width: 0, height: 0 });

  console.log('FastGraph render:', { isActive, isInitialized, isInitializing, error, canvas: !!canvas, nodeCount: nodes.length, edgeCount: edges.length, camera: cameraRef.current });

  // Callback ref that triggers when canvas is actually mounted
  const canvasRef = useCallback((canvasElement: HTMLCanvasElement | null) => {
    console.log('Canvas ref callback:', !!canvasElement);
    setCanvas(canvasElement);
  }, []);



  // Update initial colors ref when props change
  useEffect(() => {
    initialColorsRef.current = { color1, color2 };
  }, [color1, color2]);

  // Determine if we're in graph mode or gradient mode
  useEffect(() => {
    setIsGraphMode(nodes.length > 0);
  }, [nodes.length]);

  // Validate entity limits and show warnings
  useEffect(() => {
    if (!rendererRef.current || !isInitialized) return;

    try {
      const maxNodes = rendererRef.current.get_max_nodes();
      const maxEdges = rendererRef.current.get_max_edges();
      
      if (nodes.length > maxNodes) {
        console.warn(`FastGraph: Node count (${nodes.length}) exceeds maximum (${maxNodes}). Only first ${maxNodes} nodes will be rendered.`);
      }
      
      if (edges.length > maxEdges) {
        console.warn(`FastGraph: Edge count (${edges.length}) exceeds maximum (${maxEdges}). Only first ${maxEdges} edges will be rendered.`);
      }
    } catch (err) {
      console.error('Failed to validate entity limits:', err);
    }
  }, [nodes.length, edges.length, isInitialized]);

  // Update graph data when nodes or edges change
  useEffect(() => {
    if (rendererRef.current && isInitialized && canvas && isGraphMode) {
      try {
        // Prepare node data for GPU
        const nodeData: number[] = [];
        for (const node of nodes) {
          const canvasPos = normalizedToCanvas(node.x, node.y, canvas.width, canvas.height);
          const color = hexToRgba(node.color || '#3498db');
          const size = node.size || 5;
          
          nodeData.push(
            canvasPos.x,    // x position
            canvasPos.y,    // y position
            color.r,        // red
            color.g,        // green
            color.b,        // blue
            color.a,        // alpha
            size           // size/radius
          );
        }

        // Prepare edge data for GPU
        const edgeData: number[] = [];
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        
        for (const edge of edges) {
          const sourceNode = nodeMap.get(edge.source);
          const targetNode = nodeMap.get(edge.target);
          
          if (sourceNode && targetNode) {
            const sourcePos = normalizedToCanvas(sourceNode.x, sourceNode.y, canvas.width, canvas.height);
            const targetPos = normalizedToCanvas(targetNode.x, targetNode.y, canvas.width, canvas.height);
            const color = hexToRgba(edge.color || '#95a5a6');
            const width = edge.width || 1;
            
            edgeData.push(
              sourcePos.x,    // x1
              sourcePos.y,    // y1
              targetPos.x,    // x2
              targetPos.y,    // y2
              color.r,        // red
              color.g,        // green
              color.b,        // blue
              color.a,        // alpha
              width          // width
            );
          }
        }

        // Send data to Rust renderer
        rendererRef.current.set_nodes(new Float32Array(nodeData));
        rendererRef.current.set_edges(new Float32Array(edgeData));
        
        console.log('Updated graph data:', { nodeCount: nodes.length, edgeCount: edges.length });
      } catch (err) {
        console.error('Failed to update graph data:', err);
      }
    }
  }, [nodes, edges, isInitialized, canvas, isGraphMode]);

  // Update camera in renderer
  useEffect(() => {
    if (rendererRef.current && isInitialized) {
      try {
        rendererRef.current.set_camera_position(cameraRef.current.x, cameraRef.current.y);
        rendererRef.current.set_camera_zoom(cameraRef.current.zoom);
      } catch (err) {
        console.error('Failed to update camera:', err);
      }
    }
  }, [isInitialized]);

  // Camera control handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvas) return;
    
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    

  }, [canvas]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !canvas || !rendererRef.current) return;

    const deltaX = e.clientX - lastMousePosRef.current.x;
    const deltaY = e.clientY - lastMousePosRef.current.y;
    
    // Convert screen delta to world delta (accounting for zoom and device pixel ratio)
    const pixelRatio = window.devicePixelRatio || 1;
    const worldDeltaX = (deltaX * pixelRatio) / cameraRef.current.zoom;
    const worldDeltaY = (deltaY * pixelRatio) / cameraRef.current.zoom;
    
    cameraRef.current.x -= worldDeltaX;
    cameraRef.current.y -= worldDeltaY;
    
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    
    try {
      rendererRef.current.set_camera_position(cameraRef.current.x, cameraRef.current.y);
    } catch (err) {
      console.error('Failed to update camera position:', err);
    }
    

  }, [canvas]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!rendererRef.current) return;
    
    const newZoom = Math.min(10, cameraRef.current.zoom * 1.2);
    cameraRef.current.zoom = newZoom;
    
    try {
      rendererRef.current.set_camera_zoom(cameraRef.current.zoom);
    } catch (err) {
      console.error('Failed to update camera zoom:', err);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!rendererRef.current) return;
    
    const newZoom = Math.max(0.1, cameraRef.current.zoom * 0.8);
    cameraRef.current.zoom = newZoom;
    
    try {
      rendererRef.current.set_camera_zoom(cameraRef.current.zoom);
    } catch (err) {
      console.error('Failed to update camera zoom:', err);
    }
  }, []);

  const handleResetCamera = useCallback(() => {
    if (!rendererRef.current) return;
    
    cameraRef.current = { x: 0, y: 0, zoom: 1 };
    
    try {
      rendererRef.current.reset_camera();
    } catch (err) {
      console.error('Failed to reset camera:', err);
    }
  }, []);

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: touch.clientX, y: touch.clientY };
    }

  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDraggingRef.current && canvas && rendererRef.current) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastMousePosRef.current.x;
      const deltaY = touch.clientY - lastMousePosRef.current.y;
      
      const pixelRatio = window.devicePixelRatio || 1;
      const worldDeltaX = (deltaX * pixelRatio) / cameraRef.current.zoom;
      const worldDeltaY = (deltaY * pixelRatio) / cameraRef.current.zoom;
      
      cameraRef.current.x -= worldDeltaX;
      cameraRef.current.y -= worldDeltaY;
      
      lastMousePosRef.current = { x: touch.clientX, y: touch.clientY };
      
      try {
        rendererRef.current.set_camera_position(cameraRef.current.x, cameraRef.current.y);
      } catch (err) {
        console.error('Failed to update camera position:', err);
      }
    }

  }, [canvas]);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Retry function
  const handleRetry = useCallback(() => {
    setError(null);
    setIsInitialized(false);
    setIsInitializing(false);
    startTimeRef.current = null;
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    rendererRef.current = null;
    

    
    // Trigger re-initialization
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }, []);

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    if (!rendererRef.current || !isInitialized || error) return;

    if (startTimeRef.current === null) {
      startTimeRef.current = timestamp;
    }

    const elapsed = (timestamp - startTimeRef.current) / 1000.0;
    
    try {
      if (rendererRef.current && typeof rendererRef.current.render === 'function') {
        rendererRef.current.render(elapsed);
        if (isInitialized && !error) {
          animationIdRef.current = requestAnimationFrame(animate);
        }
      }
    } catch (err) {
      console.error('Render error:', err);
      setError(err instanceof Error ? err.message : 'Render error');
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    }
  }, [isInitialized, error]);

  // Handle canvas resize
  const handleResize = useCallback(() => {
    if (!canvas || !containerRef.current || !rendererRef.current || !isInitialized) return;

    const rect = containerRef.current.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2); // Cap pixel ratio to prevent excessive memory usage

    // Add size limits to prevent WebGPU texture size errors and infinite growth
    const maxDimension = 2048;
    const minDimension = 100;
    
    // Ensure minimum size and prevent zero dimensions
    const containerWidth = Math.max(rect.width, minDimension);
    const containerHeight = Math.max(rect.height, minDimension);
    
    const targetWidth = Math.min(Math.floor(containerWidth * pixelRatio), maxDimension);
    const targetHeight = Math.min(Math.floor(containerHeight * pixelRatio), maxDimension);

    // Check if size actually changed to prevent unnecessary operations
    const lastSize = lastSizeRef.current;
    if (lastSize.width === targetWidth && lastSize.height === targetHeight) {
      return;
    }

    // Update size tracking
    lastSizeRef.current = { width: targetWidth, height: targetHeight };

    // Set actual canvas resolution for high-DPI displays
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    try {
      if (rendererRef.current && typeof rendererRef.current.resize === 'function') {
        rendererRef.current.resize(canvas.width, canvas.height);
      }
    } catch (err) {
      console.error('Resize error:', err);
    }
  }, [canvas, isInitialized]);

  // Update colors when props change
  useEffect(() => {
    if (rendererRef.current && isInitialized) {
      try {
        if (typeof rendererRef.current.set_color1_hex === 'function') {
          rendererRef.current.set_color1_hex(color1);
        }
        if (typeof rendererRef.current.set_color2_hex === 'function') {
          rendererRef.current.set_color2_hex(color2);
        }
      } catch (err) {
        console.error('Color update error:', err);
      }
    }
  }, [color1, color2, isInitialized]);

  // Register component and check if it should be active
  useEffect(() => {
    const isActiveComponent = registerComponent(componentId.current);
    console.log('Component registration:', componentId.current, 'isActive:', isActiveComponent);
    setIsActive(isActiveComponent);
    
    return () => {
      unregisterComponent(componentId.current);
    };
  }, []);

  // Initialize renderer when canvas becomes available and component is active
  useEffect(() => {
    console.log('Init useEffect:', { canvas: !!canvas, isActive, isInitialized, isInitializing, mounted: mountedRef.current });
    
    if (!canvas || !isActive || isInitialized || isInitializing || !mountedRef.current) {
      return;
    }

    const init = async () => {
      try {
        console.log('Starting WebGPU initialization...');
        setIsInitializing(true);

        // Ensure canvas has proper dimensions
        const rect = canvas.getBoundingClientRect();
        const pixelRatio = window.devicePixelRatio || 1;
        
        console.log('Canvas dimensions:', { rect, pixelRatio, currentWidth: canvas.width, currentHeight: canvas.height });
        
        // Add size limits to prevent WebGPU texture size errors
        const maxDimension = 2048;
        const targetWidth = Math.min(Math.floor((rect.width || width) * pixelRatio), maxDimension);
        const targetHeight = Math.min(Math.floor((rect.height || height) * pixelRatio), maxDimension);
        
        // Set canvas dimensions if not already set
        if (canvas.width === 0 || canvas.height === 0) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          canvas.style.width = (rect.width || width) + 'px';
          canvas.style.height = (rect.height || height) + 'px';
          console.log('Set canvas dimensions:', canvas.width, 'x', canvas.height, 'with pixel ratio:', pixelRatio);
        }
        
        // Validate final dimensions
        if (canvas.width === 0 || canvas.height === 0) {
          throw new Error('Canvas has invalid dimensions after auto-sizing');
        }

        // Get shared WASM module instance
        console.log('Loading WASM module...');
        const wasmModule = await loadWasmModule();
        console.log('WASM module loaded');

        let renderer;
        try {
          console.log('Creating renderer...');
          renderer = new wasmModule.FastGraphRenderer();
          console.log('Renderer created');
        } catch (err) {
          throw new Error(`Failed to create renderer: ${err}`);
        }

        try {
          console.log('Initializing WebGPU...');
          await renderer.init(canvas);
          console.log('WebGPU initialized successfully');
        } catch (err) {
          throw new Error(`Failed to initialize WebGPU: ${err}`);
        }

        if (!mountedRef.current) return; // Check if still mounted after async operation
        
        rendererRef.current = renderer;
        setIsInitialized(true);
        setError(null);
        
        // Set initial colors after renderer is stored
        if (renderer && mountedRef.current) {
          try {
            renderer.set_color1_hex(initialColorsRef.current.color1);
            renderer.set_color2_hex(initialColorsRef.current.color2);
            console.log('Initial colors set');
          } catch (err) {
            console.warn('Failed to set initial colors:', err);
          }
        }
      } catch (err) {
        console.error('Failed to initialize WebGPU renderer:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize renderer';
        setError(`WebGPU initialization failed: ${errorMessage}`);
        setRetryCount(prev => prev + 1);
      } finally {
        if (mountedRef.current) {
          setIsInitializing(false);
        }
      }
    };

    init();
  }, [canvas, isActive, isInitialized, isInitializing, width, height]);

  // Start animation loop when initialized
  useEffect(() => {
    if (isInitialized && !animationIdRef.current) {
      animationIdRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
  }, [isInitialized, animate]);

  // Handle canvas sizing
  useEffect(() => {
    handleResize();
  }, [width, height, handleResize]);

  // Setup resize observer with debouncing - observe container, not canvas
  useEffect(() => {
    if (!containerRef.current) return;

    let resizeTimeout: number;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 100);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      // Only trigger resize if the container actually changed size
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const lastSize = lastSizeRef.current;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const targetWidth = Math.min(Math.floor(width * pixelRatio), 2048);
        const targetHeight = Math.min(Math.floor(height * pixelRatio), 2048);
        
        if (lastSize.width !== targetWidth || lastSize.height !== targetHeight) {
          debouncedResize();
        }
      }
    });
    
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  // Mount/unmount management
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      if (rendererRef.current) {
        try {
          // Stop any ongoing operations
          rendererRef.current = null;
        } catch (err) {
          console.warn('Cleanup error:', err);
        }
      }
      setIsInitialized(false);
      setIsInitializing(false);
    };
  }, []);

  const containerStyle: React.CSSProperties = {
    width: width,
    height: height,
    position: 'relative',
    minWidth: '100px',
    minHeight: '100px',
    maxWidth: '2048px',
    maxHeight: '2048px',
    overflow: 'hidden',
    ...style,
  };

  const canvasStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'block',
    maxWidth: '100%',
    maxHeight: '100%',
  };

  // Always render canvas, but show overlays for different states
  return (
    <div ref={containerRef} style={containerStyle}>
      <canvas
        ref={canvasRef}
        className={className}
        style={canvasStyle}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Camera Control Buttons */}
      {isGraphMode && isInitialized && !error && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          zIndex: 20
        }}>
          <button
            onClick={handleZoomIn}
            style={{
              width: '30px',
              height: '30px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              color: '#333',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            style={{
              width: '30px',
              height: '30px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              color: '#333',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={handleResetCamera}
            style={{
              width: '30px',
              height: '30px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              color: '#333',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Reset Camera"
          >
            ⌂
          </button>
        </div>
      )}
      
      {!isActive && (
      <div 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: 'rgba(248, 249, 250, 0.95)',
          color: '#6c757d',
          fontSize: '14px',
          border: '2px dashed #dee2e6',
          borderRadius: '8px',
          zIndex: 10
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            ⚠️ WebGPU Limit
          </div>
          <div style={{ fontSize: '12px' }}>
            Only one FastGraph component can be active at a time.
            <br />
            Another component is currently using WebGPU.
          </div>
        </div>
      </div>
    )}

    {isGraphMode && isInitialized && !error && nodes.length === 0 && (
      <div 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: 'rgba(248, 248, 248, 0.95)',
          color: '#888',
          fontSize: '14px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          zIndex: 10
        }}
      >
        No nodes to display
      </div>
    )}

      {error && (
        <div 
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: 'rgba(240, 240, 240, 0.95)',
            color: '#666',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            zIndex: 10,
            flexDirection: 'column'
          }}
        >
          <div style={{ marginBottom: '10px' }}>
            <strong>Error:</strong> {error}
          </div>
          <button 
            onClick={handleRetry}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Retry {retryCount > 1 && `(Attempt ${retryCount})`}
          </button>
          {retryCount > 2 && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              Your browser may not support WebGPU or it's disabled.
            </div>
          )}
        </div>
      )}

      {isInitializing && !error && (
        <div 
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: 'rgba(248, 248, 248, 0.95)',
            color: '#888',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            zIndex: 10
          }}
        >
          Initializing WebGPU...
          {isGraphMode && <div style={{ fontSize: '12px', marginTop: '4px' }}>
            Preparing to render {nodes.length} nodes and {edges.length} edges
          </div>}
        </div>
      )}
    </div>
  );
};

export default FastGraph;