import React, { useRef, useEffect, useCallback, useState } from 'react';

export interface FastGraphProps {
  color1?: string;
  color2?: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Singleton WebGPU manager - only one component can be active
let activeComponentId: string | null = null;
let wasmModule: any = null;
let wasmModulePromise: Promise<any> | null = null;

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

const initWasmModule = async (): Promise<any> => {
  if (wasmModule) {
    return wasmModule;
  }
  
  if (wasmModulePromise) {
    return wasmModulePromise;
  }
  
  wasmModulePromise = (async () => {
    try {
      // @ts-ignore - WASM module will be available at runtime
      const module = await import('./pkg/fast_graph_core.js');
      await module.default();
      wasmModule = module;
      return module;
    } catch (error) {
      wasmModulePromise = null;
      throw error;
    }
  })();
  
  return wasmModulePromise;
};

export const FastGraph: React.FC<FastGraphProps> = ({
  color1 = '#ff0000',
  color2 = '#0000ff',
  width = 800,
  height = 600,
  className,
  style,
}) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<any>(null);
  const animationIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const componentId = useRef(`fast-graph-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`);
  const initialColorsRef = useRef({ color1, color2 });
  const mountedRef = useRef(true);

  console.log('FastGraph render:', { isActive, isInitialized, isInitializing, error, canvas: !!canvas });

  // Callback ref that triggers when canvas is actually mounted
  const canvasRef = useCallback((canvasElement: HTMLCanvasElement | null) => {
    console.log('Canvas ref callback:', !!canvasElement);
    setCanvas(canvasElement);
  }, []);



  // Update initial colors ref when props change
  useEffect(() => {
    initialColorsRef.current = { color1, color2 };
  }, [color1, color2]);

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
    if (!canvas || !rendererRef.current || !isInitialized) return;

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = rect.width * pixelRatio;
    canvas.height = rect.height * pixelRatio;

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
        
        // Set canvas dimensions if not already set
        if (canvas.width === 0 || canvas.height === 0) {
          canvas.width = (rect.width || width) * pixelRatio;
          canvas.height = (rect.height || height) * pixelRatio;
          console.log('Set canvas dimensions:', canvas.width, 'x', canvas.height);
        }
        
        // Validate final dimensions
        if (canvas.width === 0 || canvas.height === 0) {
          throw new Error('Canvas has invalid dimensions after auto-sizing');
        }

        // Get shared WASM module instance
        console.log('Loading WASM module...');
        const module = await initWasmModule();
        console.log('WASM module loaded');

        let renderer;
        try {
          console.log('Creating renderer...');
          renderer = new module.FastGraphRenderer();
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

  // Setup resize observer
  useEffect(() => {
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [canvas, handleResize]);

  // Cleanup on unmount
  useEffect(() => {
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

  const canvasStyle: React.CSSProperties = {
    width: width,
    height: height,
    display: 'block',
    ...style,
  };

  // Always render canvas, but show overlays for different states
  return (
    <div style={{ position: 'relative', ...canvasStyle }}>
      <canvas
        ref={canvasRef}
        className={className}
        style={canvasStyle}
        width={width}
        height={height}
      />
      
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
        </div>
      )}
    </div>
  );
};

export default FastGraph;