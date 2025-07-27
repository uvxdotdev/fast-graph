import React, { useRef, useEffect, useCallback, useState } from 'react';
import { GraphNode, GraphEdge } from './types';
import { prepareGraphDataForGPU, normalizedToCanvas, hexToRgba, updateGraphPhysics } from './utils';

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

  /** Enable physics animation for nodes with velocity */
  enablePhysics?: boolean;

  /** Damping factor for velocity (0-1, closer to 1 = less damping) */
  dampingFactor?: number;

  /** Spring constant for edge forces (higher = stronger springs) */
  springConstant?: number;

  /** Rest length for spring forces (desired distance between connected nodes) */
  restLength?: number;

  /** Enable GPU acceleration for force calculations (experimental) */
  useGPUAcceleration?: boolean;
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
  enablePhysics = false,
  dampingFactor = 0.99,
  springConstant = 0.01,
  restLength = 0.1,
  useGPUAcceleration = false,
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

  // Physics state
  const [animatedNodes, setAnimatedNodes] = useState<GraphNode[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const physicsAnimationRef = useRef<number | null>(null);

  // FPS tracking state
  const [fps, setFps] = useState<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsLastTimeRef = useRef<number>(0);
  const fpsUpdateIntervalRef = useRef<number>(500); // Update FPS every 500ms

  // Camera state
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, zoom: 1 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Pan mode state
  const [isPanMode, setIsPanMode] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [canvasFocused, setCanvasFocused] = useState(false);

  // Node dragging state
  const [draggedNodeIndex, setDraggedNodeIndex] = useState<number | null>(null);
  const draggedNodeIndexRef = useRef<number | null>(null);
  const isDraggingNodeRef = useRef(false);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Node hover state
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState<number | null>(null);

  const componentId = useRef(`fast-graph-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`);
  const initialColorsRef = useRef({ color1, color2 });
  const mountedRef = useRef(true);
  const lastSizeRef = useRef({ width: 0, height: 0 });

  // Utility functions for node dragging
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    if (!canvas) return { worldX: 0, worldY: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    // Apply the inverse of the camera transform used in the shader
    // The shader applies: (pixel_pos - camera_position) * camera_zoom
    // So the inverse is: canvas_pixel_pos / camera_zoom + camera_position
    const originalPixelX = canvasX / cameraRef.current.zoom + cameraRef.current.x;
    const originalPixelY = canvasY / cameraRef.current.zoom + cameraRef.current.y;
    
    // Convert to normalized coordinates (0-1)
    const worldX = originalPixelX / canvas.clientWidth;
    const worldY = originalPixelY / canvas.clientHeight;
    
    return { worldX, worldY };
  }, [canvas]);

  const getNodeUnderMouse = useCallback((worldX: number, worldY: number) => {
    if (!canvas) return -1;

    let closestNode = -1;
    let closestDistance = Infinity;

    // Search backwards to prioritize nodes drawn on top
    for (let i = animatedNodes.length - 1; i >= 0; i--) {
      const node = animatedNodes[i];
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Convert pixel size to normalized coordinates
      const pixelSize = node.size || 20; // Default size in pixels
      const normalizedRadiusX = (pixelSize * 0.5) / canvas.clientWidth;
      const normalizedRadiusY = (pixelSize * 0.5) / canvas.clientHeight;
      
      // Use average of x and y radius for circular hit detection
      const normalizedRadius = (normalizedRadiusX + normalizedRadiusY) * 0.5;
      
      // Add a minimum hit radius for usability
      const minHitRadius = 0.01;
      const hitRadius = Math.max(normalizedRadius, minHitRadius);



      if (distance < closestDistance) {
        closestDistance = distance;
        closestNode = i;
      }

      if (distance <= hitRadius) {
        return i;
      }
    }

    return -1;
  }, [animatedNodes, canvas]);



  // Callback ref that triggers when canvas is actually mounted
  const canvasRef = useCallback((canvasElement: HTMLCanvasElement | null) => {
    console.log('Canvas ref callback:', !!canvasElement);
    setCanvas(canvasElement);
  }, []);



  // Update initial colors ref when props change
  useEffect(() => {
    initialColorsRef.current = { color1, color2 };
  }, [color1, color2]);

  // One-time debug log for sample node positions
  useEffect(() => {
    if (animatedNodes.length > 0) {
      console.log('📍 Sample node positions:', animatedNodes.slice(0, 3).map((node, i) => ({
        index: i,
        pos: { x: node.x, y: node.y },
        size: node.size
      })));
    }
  }, [animatedNodes.length > 0]);

  // Determine if we're in graph mode or gradient mode
  useEffect(() => {
    setIsGraphMode(nodes.length > 0);
  }, [nodes.length]);

  // Initialize animated nodes when nodes prop changes
  useEffect(() => {
    setAnimatedNodes([...nodes]);
  }, [nodes]);

  // Physics animation loop
  useEffect(() => {
    if (!enablePhysics || !isInitialized || animatedNodes.length === 0) {
      if (physicsAnimationRef.current) {
        cancelAnimationFrame(physicsAnimationRef.current);
        physicsAnimationRef.current = null;
      }
      return;
    }

    const animate = (currentTime: number) => {
      if (!mountedRef.current) return;

      const deltaTime = lastFrameTimeRef.current > 0
        ? (currentTime - lastFrameTimeRef.current) / 1000
        : 0.016; // Default to ~60fps

      lastFrameTimeRef.current = currentTime;

      setAnimatedNodes(prevNodes => {
        const hasVelocity = prevNodes.some(node => (node.vx && node.vx !== 0) || (node.vy && node.vy !== 0));
        if (!hasVelocity) return prevNodes;

        // Try GPU acceleration if enabled and available
        if (useGPUAcceleration && rendererRef.current && typeof rendererRef.current.integrate_physics === 'function') {
          try {
            // For now, skip GPU physics when dragging to avoid conflicts
            if (draggedNodeIndexRef.current !== null && draggedNodeIndexRef.current !== undefined) {

              // Fall through to CPU physics
            } else {
              rendererRef.current.integrate_physics(
                deltaTime * 0.01, // Convert to appropriate time scale
                dampingFactor,
                springConstant,
                restLength,
                0.001, // repulsion_strength
                0.3    // repulsion_radius
              );
              return prevNodes; // Skip CPU physics if GPU succeeded
            }
          } catch (err) {
            console.warn('GPU acceleration failed, falling back to CPU physics:', err);
          }
        }

        const currentDraggedIndex = draggedNodeIndexRef.current;
        return updateGraphPhysics(prevNodes, edges, deltaTime, dampingFactor, springConstant, restLength, currentDraggedIndex);
      });

      physicsAnimationRef.current = requestAnimationFrame(animate);
    };

    physicsAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (physicsAnimationRef.current) {
        cancelAnimationFrame(physicsAnimationRef.current);
        physicsAnimationRef.current = null;
      }
    };
  }, [enablePhysics, isInitialized, animatedNodes.length, dampingFactor, springConstant, restLength, useGPUAcceleration]);

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
        for (const node of animatedNodes) {
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
        const nodeMap = new Map(animatedNodes.map(node => [node.id, node]));

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

      } catch (err) {
        console.error('Failed to update graph data:', err);
      }
    }
  }, [animatedNodes, edges, isInitialized, canvas, isGraphMode]);

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

  // Keyboard event handlers for shift key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (canvasFocused && containerRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [canvasFocused]);

  // Camera control handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvas) return;

    // Try node dragging first (only when not in pan mode)
    if (!isPanMode && !isShiftPressed) {
      const { worldX, worldY } = screenToWorld(e.clientX, e.clientY);
      const nodeIndex = getNodeUnderMouse(worldX, worldY);



      if (nodeIndex >= 0) {

        setDraggedNodeIndex(nodeIndex);
        draggedNodeIndexRef.current = nodeIndex;
        isDraggingNodeRef.current = true;
        dragStartPosRef.current = { x: worldX, y: worldY };
        return; // Don't start camera panning
      }
    }

    // Fall back to camera panning if in pan mode or shift pressed
    if (isPanMode || isShiftPressed) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }

  }, [canvas, isPanMode, isShiftPressed, screenToWorld, getNodeUnderMouse]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvas) return;

    // Handle node dragging
    if (isDraggingNodeRef.current && draggedNodeIndex !== null) {
      const { worldX, worldY } = screenToWorld(e.clientX, e.clientY);



      // Update the dragged node's position directly
      setAnimatedNodes(prevNodes => {
        const updatedNodes = [...prevNodes];
        if (draggedNodeIndex < updatedNodes.length) {
          const oldNode = updatedNodes[draggedNodeIndex];

          updatedNodes[draggedNodeIndex] = {
            ...oldNode,
            x: worldX,
            y: worldY,
            vx: 0, // Reset velocity to prevent jitter
            vy: 0
          };
        }
        return updatedNodes;
      });
      return;
    }

    // Handle camera panning
    if (isDraggingRef.current && rendererRef.current) {
      // Only pan if pan mode is active or shift is pressed
      if (isPanMode || isShiftPressed) {
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
        } catch (error) {
          console.error('Error updating camera position:', error);
        }
      }
      return;
    }

    // Handle node hover detection (when not dragging anything)
    if (!isPanMode && !isShiftPressed) {
      const { worldX, worldY } = screenToWorld(e.clientX, e.clientY);
      const nodeIndex = getNodeUnderMouse(worldX, worldY);
      setHoveredNodeIndex(nodeIndex);
    } else {
      setHoveredNodeIndex(null);
    }
  }, [canvas, isPanMode, isShiftPressed, screenToWorld, getNodeUnderMouse, draggedNodeIndex]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;

    // End node dragging
    if (isDraggingNodeRef.current) {

      isDraggingNodeRef.current = false;
      setDraggedNodeIndex(null);
      draggedNodeIndexRef.current = null;
      dragStartPosRef.current = null;
    }
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
    if (e.touches.length === 1 && (isPanMode || isShiftPressed)) {
      const touch = e.touches[0];
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: touch.clientX, y: touch.clientY };
    }
  }, [isPanMode, isShiftPressed]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDraggingRef.current && canvas && rendererRef.current && (isPanMode || isShiftPressed)) {
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
      } catch (error) {
        console.error('Error updating camera position:', error);
      }
    }
  }, [canvas, isPanMode, isShiftPressed]);

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

    // Track FPS
    frameCountRef.current++;
    if (fpsLastTimeRef.current === 0) {
      fpsLastTimeRef.current = timestamp;
    }
    
    const timeSinceLastFpsUpdate = timestamp - fpsLastTimeRef.current;
    if (timeSinceLastFpsUpdate >= fpsUpdateIntervalRef.current) {
      const currentFps = Math.round((frameCountRef.current * 1000) / timeSinceLastFpsUpdate);
      setFps(currentFps);
      frameCountRef.current = 0;
      fpsLastTimeRef.current = timestamp;
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
      setError(`Render error: ${err}`);
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
        style={{
          ...canvasStyle,
          cursor: isDraggingNodeRef.current ? 'grabbing' :
                  (isPanMode || isShiftPressed) ? (isDraggingRef.current ? 'grabbing' : 'grab') :
                  hoveredNodeIndex !== null ? 'pointer' :
                  'default',
          outline: canvasFocused ? '2px solid rgba(0, 150, 255, 0.5)' : 'none',
          outlineOffset: '2px'
        }}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onFocus={() => setCanvasFocused(true)}
        onBlur={() => setCanvasFocused(false)}
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
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}
            title="Reset Camera"
          >
            🏠
          </button>
        </div>
      )}

      {/* Pan Mode Indicator */}
      {isGraphMode && isInitialized && !error && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '8px',
          zIndex: 20
        }}>
          <button
            onClick={() => setIsPanMode(!isPanMode)}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: (isPanMode || isShiftPressed) ? 'rgba(0, 150, 255, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              color: (isPanMode || isShiftPressed) ? 'white' : '#333',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease',
              outline: isShiftPressed ? '2px solid rgba(255, 193, 7, 0.8)' : 'none'
            }}
            title={
              isShiftPressed ? "Pan Mode: SHIFT HELD (Click to toggle manual mode)" :
              isPanMode ? "Pan Mode: ON (Click to disable)" :
              "Pan Mode: OFF (Click to enable)"
            }
          >
            🖱️ PAN
          </button>
        </div>
      )}

      {/* Help Panel for Pan Controls */}
      {isGraphMode && isInitialized && !error && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: 'monospace',
          lineHeight: '1.4',
          maxWidth: '200px',
          zIndex: 20,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#4CAF50' }}>
            🎮 Pan Controls
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#FFC107' }}>Hold Shift</span> to enable panning
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#2196F3' }}>PAN button</span> toggles manual mode
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#4CAF50' }}>Drag nodes</span> when not panning
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#FF9800' }}>Focus canvas</span> = no page scroll
          </div>
          <div style={{ color: '#9E9E9E', fontSize: '10px', marginTop: '6px' }}>
            Click canvas to focus
          </div>
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

      {/* FPS Counter */}
      {isInitialized && !error && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            padding: '4px 8px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            fontSize: '12px',
            fontFamily: 'monospace',
            borderRadius: '4px',
            zIndex: 5,
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        >
          {fps} FPS
        </div>
      )}
    </div>
  );
};

export default FastGraph;
