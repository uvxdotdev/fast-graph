var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/FastGraph.tsx
import React, { useRef, useEffect, useCallback, useState } from "react";

// src/types.ts
var DEFAULT_NODE_COLOR = "#3498db";
var DEFAULT_NODE_SIZE = 5;
var DEFAULT_EDGE_COLOR = "#95a5a6";
var DEFAULT_EDGE_WIDTH = 1;

// src/utils.ts
function validateNode(node) {
  const errors = [];
  if (!node.id || typeof node.id !== "string") {
    errors.push("Node must have a valid string id");
  }
  if (typeof node.x !== "number" || node.x < 0 || node.x > 1) {
    errors.push(`Node ${node.id}: x coordinate must be between 0 and 1`);
  }
  if (typeof node.y !== "number" || node.y < 0 || node.y > 1) {
    errors.push(`Node ${node.id}: y coordinate must be between 0 and 1`);
  }
  if (node.size !== undefined && (typeof node.size !== "number" || node.size <= 0)) {
    errors.push(`Node ${node.id}: size must be a positive number`);
  }
  if (node.color !== undefined && !isValidHexColor(node.color)) {
    errors.push(`Node ${node.id}: color must be a valid hex color`);
  }
  return errors;
}
function validateEdge(edge, nodeIds) {
  const errors = [];
  if (!edge.source || typeof edge.source !== "string") {
    errors.push("Edge must have a valid string source id");
  } else if (!nodeIds.has(edge.source)) {
    errors.push(`Edge source "${edge.source}" does not exist in nodes`);
  }
  if (!edge.target || typeof edge.target !== "string") {
    errors.push("Edge must have a valid string target id");
  } else if (!nodeIds.has(edge.target)) {
    errors.push(`Edge target "${edge.target}" does not exist in nodes`);
  }
  if (edge.width !== undefined && (typeof edge.width !== "number" || edge.width <= 0)) {
    errors.push(`Edge ${edge.source}->${edge.target}: width must be a positive number`);
  }
  if (edge.color !== undefined && !isValidHexColor(edge.color)) {
    errors.push(`Edge ${edge.source}->${edge.target}: color must be a valid hex color`);
  }
  return errors;
}
function validateGraph(nodes, edges) {
  const errors = [];
  const nodeIds = new Set;
  const duplicateIds = new Set;
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      duplicateIds.add(node.id);
    }
    nodeIds.add(node.id);
  }
  if (duplicateIds.size > 0) {
    errors.push(`Duplicate node IDs found: ${Array.from(duplicateIds).join(", ")}`);
  }
  for (const node of nodes) {
    errors.push(...validateNode(node));
  }
  for (const edge of edges) {
    errors.push(...validateEdge(edge, nodeIds));
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}
function isValidHexColor(color) {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}|[A-Fa-f0-9]{8})$/.test(color);
}
function hexToRgba(hex) {
  const cleanHex = hex.replace("#", "");
  let r, g, b, a = 1;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
    g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
    b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substr(0, 2), 16) / 255;
    g = parseInt(cleanHex.substr(2, 2), 16) / 255;
    b = parseInt(cleanHex.substr(4, 2), 16) / 255;
  } else if (cleanHex.length === 8) {
    r = parseInt(cleanHex.substr(0, 2), 16) / 255;
    g = parseInt(cleanHex.substr(2, 2), 16) / 255;
    b = parseInt(cleanHex.substr(4, 2), 16) / 255;
    a = parseInt(cleanHex.substr(6, 2), 16) / 255;
  } else {
    return { r: 1, g: 1, b: 1, a: 1 };
  }
  return { r, g, b, a };
}
function normalizeNode(node) {
  return {
    id: node.id,
    x: Math.max(0, Math.min(1, node.x)),
    y: Math.max(0, Math.min(1, node.y)),
    vx: node.vx || 0,
    vy: node.vy || 0,
    color: node.color && isValidHexColor(node.color) ? node.color : DEFAULT_NODE_COLOR,
    size: Math.max(0.1, node.size || DEFAULT_NODE_SIZE),
    label: node.label
  };
}
function normalizeEdge(edge) {
  return {
    source: edge.source,
    target: edge.target,
    color: edge.color && isValidHexColor(edge.color) ? edge.color : DEFAULT_EDGE_COLOR,
    width: Math.max(0.1, edge.width || DEFAULT_EDGE_WIDTH)
  };
}
function normalizedToCanvas(normalizedX, normalizedY, canvasWidth, canvasHeight) {
  return {
    x: normalizedX * canvasWidth,
    y: normalizedY * canvasHeight
  };
}
function canvasToNormalized(canvasX, canvasY, canvasWidth, canvasHeight) {
  return {
    x: canvasX / canvasWidth,
    y: canvasY / canvasHeight
  };
}
function findNodeById(nodes, id) {
  return nodes.find((node) => node.id === id);
}
function getConnectedEdges(edges, nodeId) {
  return edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
}
function prepareGraphDataForGPU(nodes, edges, canvasWidth, canvasHeight) {
  const normalizedNodes = nodes.map(normalizeNode);
  const normalizedEdges = edges.map(normalizeEdge);
  const nodeData = [];
  for (const node of normalizedNodes) {
    const canvasPos = normalizedToCanvas(node.x, node.y, canvasWidth, canvasHeight);
    const color = hexToRgba(node.color);
    nodeData.push(canvasPos.x, canvasPos.y, color.r, color.g, color.b, color.a, node.size, 0);
  }
  const edgeData = [];
  const nodeMap = new Map(normalizedNodes.map((node) => [node.id, node]));
  for (const edge of normalizedEdges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (sourceNode && targetNode) {
      const sourcePos = normalizedToCanvas(sourceNode.x, sourceNode.y, canvasWidth, canvasHeight);
      const targetPos = normalizedToCanvas(targetNode.x, targetNode.y, canvasWidth, canvasHeight);
      const color = hexToRgba(edge.color);
      edgeData.push(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, color.r, color.g, color.b, color.a, edge.width, 0, 0, 0);
    }
  }
  return {
    nodeData: new Float32Array(nodeData),
    edgeData: new Float32Array(edgeData),
    nodeCount: normalizedNodes.length,
    edgeCount: normalizedEdges.length,
    nodeStride: 8,
    edgeStride: 12
  };
}
function getGraphBounds(nodes) {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  let minX = nodes[0].x;
  let minY = nodes[0].y;
  let maxX = nodes[0].x;
  let maxY = nodes[0].y;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }
  return { minX, minY, maxX, maxY };
}
var MAX_NODES = 1e5;
var MAX_EDGES = 200000;
function checkGraphLimits(nodes, edges, truncate = false) {
  const nodeCountExceeded = nodes.length > MAX_NODES;
  const edgeCountExceeded = edges.length > MAX_EDGES;
  const warnings = [];
  if (nodeCountExceeded) {
    warnings.push(`Node count (${nodes.length}) exceeds maximum (${MAX_NODES}). ${truncate ? `Only first ${MAX_NODES} nodes will be rendered.` : "Consider reducing the number of nodes."}`);
  }
  if (edgeCountExceeded) {
    warnings.push(`Edge count (${edges.length}) exceeds maximum (${MAX_EDGES}). ${truncate ? `Only first ${MAX_EDGES} edges will be rendered.` : "Consider reducing the number of edges."}`);
  }
  const result = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeCountExceeded,
    edgeCountExceeded,
    warnings
  };
  if (truncate) {
    result.truncatedNodes = nodeCountExceeded ? nodes.slice(0, MAX_NODES) : nodes;
    result.truncatedEdges = edgeCountExceeded ? edges.slice(0, MAX_EDGES) : edges;
  }
  return result;
}
function getPerformanceRecommendations(nodeCount, edgeCount) {
  const recommendations = [];
  if (nodeCount > 1e4) {
    recommendations.push("Large node count detected. Consider using smaller node sizes for better performance.");
  }
  if (edgeCount > 20000) {
    recommendations.push("Large edge count detected. Consider using thinner edges for better performance.");
  }
  if (nodeCount > 50000 || edgeCount > 1e5) {
    recommendations.push("Very large graph detected. Consider implementing data virtualization or level-of-detail rendering.");
  }
  const totalEntities = nodeCount + edgeCount;
  if (totalEntities > 1e5) {
    recommendations.push("Consider clustering or aggregating nodes to improve performance and readability.");
  }
  return recommendations;
}
function addRandomVelocity(node, minSpeed = 0.01, maxSpeed = 0.05) {
  const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
  const angle = Math.random() * 2 * Math.PI;
  return {
    ...node,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed
  };
}
function updateNodePosition(node, deltaTime) {
  if (!node.vx && !node.vy) {
    return node;
  }
  const vx = node.vx || 0;
  const vy = node.vy || 0;
  const newX = node.x + vx * deltaTime;
  const newY = node.y + vy * deltaTime;
  return {
    ...node,
    x: newX,
    y: newY,
    vx,
    vy
  };
}
function applyDamping(node, dampingFactor = 0.99) {
  if (!node.vx && !node.vy) {
    return node;
  }
  return {
    ...node,
    vx: (node.vx || 0) * dampingFactor,
    vy: (node.vy || 0) * dampingFactor
  };
}
function calculateSpringForce(node1, node2, restLength = 0.1, springConstant = 0.01) {
  const dx = node2.x - node1.x;
  const dy = node2.y - node1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0)
    return { fx: 0, fy: 0 };
  const force = springConstant * (distance - restLength);
  const fx = dx / distance * force;
  const fy = dy / distance * force;
  return { fx, fy };
}
function applySpringForces(nodes, edges, restLength = 0.1, springConstant = 0.01, draggedNodeIndex) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const forces = new Map(nodes.map((node) => [node.id, { fx: 0, fy: 0 }]));
  const draggedNodeId = draggedNodeIndex !== null && draggedNodeIndex !== undefined && draggedNodeIndex < nodes.length ? nodes[draggedNodeIndex].id : null;
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (sourceNode && targetNode) {
      const springForce = calculateSpringForce(sourceNode, targetNode, restLength, springConstant);
      if (edge.source !== draggedNodeId) {
        const sourceForce = forces.get(edge.source);
        sourceForce.fx += springForce.fx;
        sourceForce.fy += springForce.fy;
      }
      if (edge.target !== draggedNodeId) {
        const targetForce = forces.get(edge.target);
        targetForce.fx -= springForce.fx;
        targetForce.fy -= springForce.fy;
      }
    }
  }
  return nodes.map((node, index) => {
    if (draggedNodeIndex !== null && draggedNodeIndex !== undefined && index === draggedNodeIndex) {
      return node;
    }
    const force = forces.get(node.id);
    if (!force)
      return node;
    const vx = (node.vx || 0) + force.fx;
    const vy = (node.vy || 0) + force.fy;
    return {
      ...node,
      vx,
      vy
    };
  });
}
function updateGraphPhysics(nodes, edges, deltaTime, dampingFactor = 0.99, springConstant = 0.01, restLength = 0.1, draggedNodeIndex) {
  let updatedNodes = applySpringForces(nodes, edges, restLength, springConstant, draggedNodeIndex);
  updatedNodes = updatedNodes.map((node, index) => {
    if (draggedNodeIndex !== null && draggedNodeIndex !== undefined && index === draggedNodeIndex) {
      return {
        ...node,
        vx: 0,
        vy: 0
      };
    }
    let updatedNode = updateNodePosition(node, deltaTime);
    updatedNode = applyDamping(updatedNode, dampingFactor);
    return updatedNode;
  });
  return updatedNodes;
}

// src/FastGraph.tsx
var activeComponentId = null;
var registerComponent = (id) => {
  if (activeComponentId === null) {
    activeComponentId = id;
    return true;
  }
  return activeComponentId === id;
};
var unregisterComponent = (id) => {
  if (activeComponentId === id) {
    activeComponentId = null;
  }
};
var wasmModule = null;
var wasmModulePromise = null;
var loadWasmModule = async () => {
  if (wasmModule) {
    return wasmModule;
  }
  if (wasmModulePromise) {
    return wasmModulePromise;
  }
  wasmModulePromise = (async () => {
    try {
      let module;
      try {
        module = await import("./pkg/fast_graph_core.js");
      } catch (relativeError) {
        try {
          module = await import("@uvxdotdev/fastgraph/dist/pkg/fast_graph_core.js");
        } catch (packageError) {
          try {
            const currentScript = document.currentScript;
            const baseUrl = currentScript?.src || window.location.href;
            const wasmUrl = new URL("pkg/fast_graph_core.js", baseUrl).href;
            module = await import(wasmUrl);
          } catch (urlError) {
            const possiblePaths = [
              "/node_modules/@uvxdotdev/fastgraph/dist/pkg/fast_graph_core.js",
              "./node_modules/@uvxdotdev/fastgraph/dist/pkg/fast_graph_core.js",
              "../pkg/fast_graph_core.js"
            ];
            for (const path of possiblePaths) {
              try {
                module = await import(path);
                break;
              } catch (pathError) {
                continue;
              }
            }
            if (!module) {
              throw new Error("All WASM import strategies failed");
            }
          }
        }
      }
      await module.default();
      wasmModule = module;
      return module;
    } catch (error) {
      console.error("Failed to load WASM module:", error);
      wasmModulePromise = null;
      throw new Error(`Failed to load FastGraph WASM module: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();
  return wasmModulePromise;
};
var FastGraph = ({
  nodes = [],
  edges = [],
  color1 = "#ff0000",
  color2 = "#0000ff",
  width = 800,
  height = 600,
  className,
  style,
  enablePhysics = false,
  dampingFactor = 0.99,
  springConstant = 0.01,
  restLength = 0.1,
  useGPUAcceleration = false
}) => {
  const [canvas, setCanvas] = useState(null);
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const animationIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isGraphMode, setIsGraphMode] = useState(false);
  const [animatedNodes, setAnimatedNodes] = useState([]);
  const lastFrameTimeRef = useRef(0);
  const physicsAnimationRef = useRef(null);
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(0);
  const fpsUpdateIntervalRef = useRef(500);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [canvasFocused, setCanvasFocused] = useState(false);
  const [draggedNodeIndex, setDraggedNodeIndex] = useState(null);
  const draggedNodeIndexRef = useRef(null);
  const isDraggingNodeRef = useRef(false);
  const dragStartPosRef = useRef(null);
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState(null);
  const componentId = useRef(`fast-graph-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`);
  const initialColorsRef = useRef({ color1, color2 });
  const mountedRef = useRef(true);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  const screenToWorld = useCallback((screenX, screenY) => {
    if (!canvas)
      return { worldX: 0, worldY: 0 };
    const rect = canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    const originalPixelX = canvasX / cameraRef.current.zoom + cameraRef.current.x;
    const originalPixelY = canvasY / cameraRef.current.zoom + cameraRef.current.y;
    const worldX = originalPixelX / canvas.clientWidth;
    const worldY = originalPixelY / canvas.clientHeight;
    return { worldX, worldY };
  }, [canvas]);
  const getNodeUnderMouse = useCallback((worldX, worldY) => {
    if (!canvas)
      return -1;
    let closestNode = -1;
    let closestDistance = Infinity;
    for (let i = animatedNodes.length - 1;i >= 0; i--) {
      const node = animatedNodes[i];
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const pixelSize = node.size || 20;
      const normalizedRadiusX = pixelSize * 0.5 / canvas.clientWidth;
      const normalizedRadiusY = pixelSize * 0.5 / canvas.clientHeight;
      const normalizedRadius = (normalizedRadiusX + normalizedRadiusY) * 0.5;
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
  const canvasRef = useCallback((canvasElement) => {
    console.log("Canvas ref callback:", !!canvasElement);
    setCanvas(canvasElement);
  }, []);
  useEffect(() => {
    initialColorsRef.current = { color1, color2 };
  }, [color1, color2]);
  useEffect(() => {
    if (animatedNodes.length > 0) {
      console.log("\uD83D\uDCCD Sample node positions:", animatedNodes.slice(0, 3).map((node, i) => ({
        index: i,
        pos: { x: node.x, y: node.y },
        size: node.size
      })));
    }
  }, [animatedNodes.length > 0]);
  useEffect(() => {
    setIsGraphMode(nodes.length > 0);
  }, [nodes.length]);
  useEffect(() => {
    setAnimatedNodes([...nodes]);
  }, [nodes]);
  useEffect(() => {
    if (!enablePhysics || !isInitialized || animatedNodes.length === 0) {
      if (physicsAnimationRef.current) {
        cancelAnimationFrame(physicsAnimationRef.current);
        physicsAnimationRef.current = null;
      }
      return;
    }
    const animate2 = (currentTime) => {
      if (!mountedRef.current)
        return;
      const deltaTime = lastFrameTimeRef.current > 0 ? (currentTime - lastFrameTimeRef.current) / 1000 : 0.016;
      lastFrameTimeRef.current = currentTime;
      setAnimatedNodes((prevNodes) => {
        const hasVelocity = prevNodes.some((node) => node.vx && node.vx !== 0 || node.vy && node.vy !== 0);
        if (!hasVelocity)
          return prevNodes;
        if (useGPUAcceleration && rendererRef.current && typeof rendererRef.current.integrate_physics === "function") {
          try {
            if (draggedNodeIndexRef.current !== null && draggedNodeIndexRef.current !== undefined) {} else {
              rendererRef.current.integrate_physics(deltaTime * 0.01, dampingFactor, springConstant, restLength, 0.001, 0.3);
              return prevNodes;
            }
          } catch (err) {
            console.warn("GPU acceleration failed, falling back to CPU physics:", err);
          }
        }
        const currentDraggedIndex = draggedNodeIndexRef.current;
        return updateGraphPhysics(prevNodes, edges, deltaTime, dampingFactor, springConstant, restLength, currentDraggedIndex);
      });
      physicsAnimationRef.current = requestAnimationFrame(animate2);
    };
    physicsAnimationRef.current = requestAnimationFrame(animate2);
    return () => {
      if (physicsAnimationRef.current) {
        cancelAnimationFrame(physicsAnimationRef.current);
        physicsAnimationRef.current = null;
      }
    };
  }, [enablePhysics, isInitialized, animatedNodes.length, dampingFactor, springConstant, restLength, useGPUAcceleration]);
  useEffect(() => {
    if (!rendererRef.current || !isInitialized)
      return;
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
      console.error("Failed to validate entity limits:", err);
    }
  }, [nodes.length, edges.length, isInitialized]);
  useEffect(() => {
    if (rendererRef.current && isInitialized && canvas && isGraphMode) {
      try {
        const nodeData = [];
        for (const node of animatedNodes) {
          const canvasPos = normalizedToCanvas(node.x, node.y, canvas.width, canvas.height);
          const color = hexToRgba(node.color || "#3498db");
          const size = node.size || 5;
          nodeData.push(canvasPos.x, canvasPos.y, color.r, color.g, color.b, color.a, size);
        }
        const edgeData = [];
        const nodeMap = new Map(animatedNodes.map((node) => [node.id, node]));
        for (const edge of edges) {
          const sourceNode = nodeMap.get(edge.source);
          const targetNode = nodeMap.get(edge.target);
          if (sourceNode && targetNode) {
            const sourcePos = normalizedToCanvas(sourceNode.x, sourceNode.y, canvas.width, canvas.height);
            const targetPos = normalizedToCanvas(targetNode.x, targetNode.y, canvas.width, canvas.height);
            const color = hexToRgba(edge.color || "#95a5a6");
            const width2 = edge.width || 1;
            edgeData.push(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, color.r, color.g, color.b, color.a, width2);
          }
        }
        rendererRef.current.set_nodes(new Float32Array(nodeData));
        rendererRef.current.set_edges(new Float32Array(edgeData));
      } catch (err) {
        console.error("Failed to update graph data:", err);
      }
    }
  }, [animatedNodes, edges, isInitialized, canvas, isGraphMode]);
  useEffect(() => {
    if (rendererRef.current && isInitialized) {
      try {
        rendererRef.current.set_camera_position(cameraRef.current.x, cameraRef.current.y);
        rendererRef.current.set_camera_zoom(cameraRef.current.zoom);
      } catch (err) {
        console.error("Failed to update camera:", err);
      }
    }
  }, [isInitialized]);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Shift") {
        setIsShiftPressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === "Shift") {
        setIsShiftPressed(false);
      }
    };
    const handleWheel = (e) => {
      if (canvasFocused && containerRef.current?.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    document.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("wheel", handleWheel);
    };
  }, [canvasFocused]);
  const handleMouseDown = useCallback((e) => {
    if (!canvas)
      return;
    if (!isPanMode && !isShiftPressed) {
      const { worldX, worldY } = screenToWorld(e.clientX, e.clientY);
      const nodeIndex = getNodeUnderMouse(worldX, worldY);
      if (nodeIndex >= 0) {
        setDraggedNodeIndex(nodeIndex);
        draggedNodeIndexRef.current = nodeIndex;
        isDraggingNodeRef.current = true;
        dragStartPosRef.current = { x: worldX, y: worldY };
        return;
      }
    }
    if (isPanMode || isShiftPressed) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [canvas, isPanMode, isShiftPressed, screenToWorld, getNodeUnderMouse]);
  const handleMouseMove = useCallback((e) => {
    if (!canvas)
      return;
    if (isDraggingNodeRef.current && draggedNodeIndex !== null) {
      const { worldX, worldY } = screenToWorld(e.clientX, e.clientY);
      setAnimatedNodes((prevNodes) => {
        const updatedNodes = [...prevNodes];
        if (draggedNodeIndex < updatedNodes.length) {
          const oldNode = updatedNodes[draggedNodeIndex];
          updatedNodes[draggedNodeIndex] = {
            ...oldNode,
            x: worldX,
            y: worldY,
            vx: 0,
            vy: 0
          };
        }
        return updatedNodes;
      });
      return;
    }
    if (isDraggingRef.current && rendererRef.current) {
      if (isPanMode || isShiftPressed) {
        const deltaX = e.clientX - lastMousePosRef.current.x;
        const deltaY = e.clientY - lastMousePosRef.current.y;
        const pixelRatio = window.devicePixelRatio || 1;
        const worldDeltaX = deltaX * pixelRatio / cameraRef.current.zoom;
        const worldDeltaY = deltaY * pixelRatio / cameraRef.current.zoom;
        cameraRef.current.x -= worldDeltaX;
        cameraRef.current.y -= worldDeltaY;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        try {
          rendererRef.current.set_camera_position(cameraRef.current.x, cameraRef.current.y);
        } catch (error2) {
          console.error("Error updating camera position:", error2);
        }
      }
      return;
    }
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
    if (isDraggingNodeRef.current) {
      isDraggingNodeRef.current = false;
      setDraggedNodeIndex(null);
      draggedNodeIndexRef.current = null;
      dragStartPosRef.current = null;
    }
  }, []);
  const handleZoomIn = useCallback(() => {
    if (!rendererRef.current)
      return;
    const newZoom = Math.min(10, cameraRef.current.zoom * 1.2);
    cameraRef.current.zoom = newZoom;
    try {
      rendererRef.current.set_camera_zoom(cameraRef.current.zoom);
    } catch (err) {
      console.error("Failed to update camera zoom:", err);
    }
  }, []);
  const handleZoomOut = useCallback(() => {
    if (!rendererRef.current)
      return;
    const newZoom = Math.max(0.1, cameraRef.current.zoom * 0.8);
    cameraRef.current.zoom = newZoom;
    try {
      rendererRef.current.set_camera_zoom(cameraRef.current.zoom);
    } catch (err) {
      console.error("Failed to update camera zoom:", err);
    }
  }, []);
  const handleResetCamera = useCallback(() => {
    if (!rendererRef.current)
      return;
    cameraRef.current = { x: 0, y: 0, zoom: 1 };
    try {
      rendererRef.current.reset_camera();
    } catch (err) {
      console.error("Failed to reset camera:", err);
    }
  }, []);
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1 && (isPanMode || isShiftPressed)) {
      const touch = e.touches[0];
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: touch.clientX, y: touch.clientY };
    }
  }, [isPanMode, isShiftPressed]);
  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 1 && isDraggingRef.current && canvas && rendererRef.current && (isPanMode || isShiftPressed)) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastMousePosRef.current.x;
      const deltaY = touch.clientY - lastMousePosRef.current.y;
      const pixelRatio = window.devicePixelRatio || 1;
      const worldDeltaX = deltaX * pixelRatio / cameraRef.current.zoom;
      const worldDeltaY = deltaY * pixelRatio / cameraRef.current.zoom;
      cameraRef.current.x -= worldDeltaX;
      cameraRef.current.y -= worldDeltaY;
      lastMousePosRef.current = { x: touch.clientX, y: touch.clientY };
      try {
        rendererRef.current.set_camera_position(cameraRef.current.x, cameraRef.current.y);
      } catch (error2) {
        console.error("Error updating camera position:", error2);
      }
    }
  }, [canvas, isPanMode, isShiftPressed]);
  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);
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
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }, []);
  const animate = useCallback((timestamp) => {
    if (!rendererRef.current || !isInitialized || error)
      return;
    if (startTimeRef.current === null) {
      startTimeRef.current = timestamp;
    }
    frameCountRef.current++;
    if (fpsLastTimeRef.current === 0) {
      fpsLastTimeRef.current = timestamp;
    }
    const timeSinceLastFpsUpdate = timestamp - fpsLastTimeRef.current;
    if (timeSinceLastFpsUpdate >= fpsUpdateIntervalRef.current) {
      const currentFps = Math.round(frameCountRef.current * 1000 / timeSinceLastFpsUpdate);
      setFps(currentFps);
      frameCountRef.current = 0;
      fpsLastTimeRef.current = timestamp;
    }
    const elapsed = (timestamp - startTimeRef.current) / 1000;
    try {
      if (rendererRef.current && typeof rendererRef.current.render === "function") {
        rendererRef.current.render(elapsed);
        if (isInitialized && !error) {
          animationIdRef.current = requestAnimationFrame(animate);
        }
      }
    } catch (err) {
      console.error("Render error:", err);
      setError(`Render error: ${err}`);
    }
  }, [isInitialized, error]);
  const handleResize = useCallback(() => {
    if (!canvas || !containerRef.current || !rendererRef.current || !isInitialized)
      return;
    const rect = containerRef.current.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const maxDimension = 2048;
    const minDimension = 100;
    const containerWidth = Math.max(rect.width, minDimension);
    const containerHeight = Math.max(rect.height, minDimension);
    const targetWidth = Math.min(Math.floor(containerWidth * pixelRatio), maxDimension);
    const targetHeight = Math.min(Math.floor(containerHeight * pixelRatio), maxDimension);
    const lastSize = lastSizeRef.current;
    if (lastSize.width === targetWidth && lastSize.height === targetHeight) {
      return;
    }
    lastSizeRef.current = { width: targetWidth, height: targetHeight };
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    try {
      if (rendererRef.current && typeof rendererRef.current.resize === "function") {
        rendererRef.current.resize(canvas.width, canvas.height);
      }
    } catch (err) {
      console.error("Resize error:", err);
    }
  }, [canvas, isInitialized]);
  useEffect(() => {
    if (rendererRef.current && isInitialized) {
      try {
        if (typeof rendererRef.current.set_color1_hex === "function") {
          rendererRef.current.set_color1_hex(color1);
        }
        if (typeof rendererRef.current.set_color2_hex === "function") {
          rendererRef.current.set_color2_hex(color2);
        }
      } catch (err) {
        console.error("Color update error:", err);
      }
    }
  }, [color1, color2, isInitialized]);
  useEffect(() => {
    const isActiveComponent = registerComponent(componentId.current);
    console.log("Component registration:", componentId.current, "isActive:", isActiveComponent);
    setIsActive(isActiveComponent);
    return () => {
      unregisterComponent(componentId.current);
    };
  }, []);
  useEffect(() => {
    console.log("Init useEffect:", { canvas: !!canvas, isActive, isInitialized, isInitializing, mounted: mountedRef.current });
    if (!canvas || !isActive || isInitialized || isInitializing || !mountedRef.current) {
      return;
    }
    const init = async () => {
      try {
        console.log("Starting WebGPU initialization...");
        setIsInitializing(true);
        const rect = canvas.getBoundingClientRect();
        const pixelRatio = window.devicePixelRatio || 1;
        console.log("Canvas dimensions:", { rect, pixelRatio, currentWidth: canvas.width, currentHeight: canvas.height });
        const maxDimension = 2048;
        const targetWidth = Math.min(Math.floor((rect.width || width) * pixelRatio), maxDimension);
        const targetHeight = Math.min(Math.floor((rect.height || height) * pixelRatio), maxDimension);
        if (canvas.width === 0 || canvas.height === 0) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          canvas.style.width = (rect.width || width) + "px";
          canvas.style.height = (rect.height || height) + "px";
          console.log("Set canvas dimensions:", canvas.width, "x", canvas.height, "with pixel ratio:", pixelRatio);
        }
        if (canvas.width === 0 || canvas.height === 0) {
          throw new Error("Canvas has invalid dimensions after auto-sizing");
        }
        console.log("Loading WASM module...");
        const wasmModule2 = await loadWasmModule();
        console.log("WASM module loaded");
        let renderer;
        try {
          console.log("Creating renderer...");
          renderer = new wasmModule2.FastGraphRenderer;
          console.log("Renderer created");
        } catch (err) {
          throw new Error(`Failed to create renderer: ${err}`);
        }
        try {
          console.log("Initializing WebGPU...");
          await renderer.init(canvas);
          console.log("WebGPU initialized successfully");
        } catch (err) {
          throw new Error(`Failed to initialize WebGPU: ${err}`);
        }
        if (!mountedRef.current)
          return;
        rendererRef.current = renderer;
        setIsInitialized(true);
        setError(null);
        if (renderer && mountedRef.current) {
          try {
            renderer.set_color1_hex(initialColorsRef.current.color1);
            renderer.set_color2_hex(initialColorsRef.current.color2);
            console.log("Initial colors set");
          } catch (err) {
            console.warn("Failed to set initial colors:", err);
          }
        }
      } catch (err) {
        console.error("Failed to initialize WebGPU renderer:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize renderer";
        setError(`WebGPU initialization failed: ${errorMessage}`);
        setRetryCount((prev) => prev + 1);
      } finally {
        if (mountedRef.current) {
          setIsInitializing(false);
        }
      }
    };
    init();
  }, [canvas, isActive, isInitialized, isInitializing, width, height]);
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
  useEffect(() => {
    handleResize();
  }, [width, height, handleResize]);
  useEffect(() => {
    if (!containerRef.current)
      return;
    let resizeTimeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 100);
    };
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: width2, height: height2 } = entry.contentRect;
        const lastSize = lastSizeRef.current;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const targetWidth = Math.min(Math.floor(width2 * pixelRatio), 2048);
        const targetHeight = Math.min(Math.floor(height2 * pixelRatio), 2048);
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
          rendererRef.current = null;
        } catch (err) {
          console.warn("Cleanup error:", err);
        }
      }
      setIsInitialized(false);
      setIsInitializing(false);
    };
  }, []);
  const containerStyle = {
    width,
    height,
    position: "relative",
    minWidth: "100px",
    minHeight: "100px",
    maxWidth: "2048px",
    maxHeight: "2048px",
    overflow: "hidden",
    ...style
  };
  const canvasStyle = {
    width: "100%",
    height: "100%",
    display: "block",
    maxWidth: "100%",
    maxHeight: "100%"
  };
  return /* @__PURE__ */ React.createElement("div", {
    ref: containerRef,
    style: containerStyle
  }, /* @__PURE__ */ React.createElement("canvas", {
    ref: canvasRef,
    className,
    style: {
      ...canvasStyle,
      cursor: isDraggingNodeRef.current ? "grabbing" : isPanMode || isShiftPressed ? isDraggingRef.current ? "grabbing" : "grab" : hoveredNodeIndex !== null ? "pointer" : "default",
      outline: canvasFocused ? "2px solid rgba(0, 150, 255, 0.5)" : "none",
      outlineOffset: "2px"
    },
    tabIndex: 0,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseUp,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onFocus: () => setCanvasFocused(true),
    onBlur: () => setCanvasFocused(false)
  }), isGraphMode && isInitialized && !error && /* @__PURE__ */ React.createElement("div", {
    style: {
      position: "absolute",
      top: "10px",
      right: "10px",
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      zIndex: 20
    }
  }, /* @__PURE__ */ React.createElement("button", {
    onClick: handleZoomIn,
    style: {
      width: "30px",
      height: "30px",
      border: "none",
      borderRadius: "4px",
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      color: "#333",
      cursor: "pointer",
      fontSize: "16px",
      fontWeight: "bold",
      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    title: "Zoom In"
  }, "+"), /* @__PURE__ */ React.createElement("button", {
    onClick: handleZoomOut,
    style: {
      width: "30px",
      height: "30px",
      border: "none",
      borderRadius: "4px",
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      color: "#333",
      cursor: "pointer",
      fontSize: "16px",
      fontWeight: "bold",
      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    title: "Zoom Out"
  }, "−"), /* @__PURE__ */ React.createElement("button", {
    onClick: handleResetCamera,
    style: {
      width: "30px",
      height: "30px",
      border: "none",
      borderRadius: "4px",
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      color: "#333",
      fontSize: "16px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)"
    },
    title: "Reset Camera"
  }, "\uD83C\uDFE0")), isGraphMode && isInitialized && !error && /* @__PURE__ */ React.createElement("div", {
    style: {
      position: "absolute",
      bottom: "10px",
      right: "10px",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: "8px",
      zIndex: 20
    }
  }, /* @__PURE__ */ React.createElement("button", {
    onClick: () => setIsPanMode(!isPanMode),
    style: {
      padding: "8px 12px",
      border: "none",
      borderRadius: "6px",
      backgroundColor: isPanMode || isShiftPressed ? "rgba(0, 150, 255, 0.9)" : "rgba(255, 255, 255, 0.9)",
      color: isPanMode || isShiftPressed ? "white" : "#333",
      fontSize: "12px",
      fontWeight: "500",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "4px",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      transition: "all 0.2s ease",
      outline: isShiftPressed ? "2px solid rgba(255, 193, 7, 0.8)" : "none"
    },
    title: isShiftPressed ? "Pan Mode: SHIFT HELD (Click to toggle manual mode)" : isPanMode ? "Pan Mode: ON (Click to disable)" : "Pan Mode: OFF (Click to enable)"
  }, "\uD83D\uDDB1️ PAN")), isGraphMode && isInitialized && !error && /* @__PURE__ */ React.createElement("div", {
    style: {
      position: "absolute",
      top: "10px",
      left: "10px",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      color: "white",
      padding: "12px",
      borderRadius: "6px",
      fontSize: "12px",
      fontFamily: "monospace",
      lineHeight: "1.4",
      maxWidth: "200px",
      zIndex: 20,
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)"
    }
  }, /* @__PURE__ */ React.createElement("div", {
    style: { fontWeight: "bold", marginBottom: "8px", color: "#4CAF50" }
  }, "\uD83C\uDFAE Pan Controls"), /* @__PURE__ */ React.createElement("div", {
    style: { marginBottom: "4px" }
  }, /* @__PURE__ */ React.createElement("span", {
    style: { color: "#FFC107" }
  }, "Hold Shift"), " to enable panning"), /* @__PURE__ */ React.createElement("div", {
    style: { marginBottom: "4px" }
  }, /* @__PURE__ */ React.createElement("span", {
    style: { color: "#2196F3" }
  }, "PAN button"), " toggles manual mode"), /* @__PURE__ */ React.createElement("div", {
    style: { marginBottom: "4px" }
  }, /* @__PURE__ */ React.createElement("span", {
    style: { color: "#4CAF50" }
  }, "Drag nodes"), " when not panning"), /* @__PURE__ */ React.createElement("div", {
    style: { marginBottom: "4px" }
  }, /* @__PURE__ */ React.createElement("span", {
    style: { color: "#FF9800" }
  }, "Focus canvas"), " = no page scroll"), /* @__PURE__ */ React.createElement("div", {
    style: { color: "#9E9E9E", fontSize: "10px", marginTop: "6px" }
  }, "Click canvas to focus")), !isActive && /* @__PURE__ */ React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(248, 249, 250, 0.95)",
      color: "#6c757d",
      fontSize: "14px",
      border: "2px dashed #dee2e6",
      borderRadius: "8px",
      zIndex: 10
    }
  }, /* @__PURE__ */ React.createElement("div", {
    style: { textAlign: "center" }
  }, /* @__PURE__ */ React.createElement("div", {
    style: { marginBottom: "8px", fontWeight: "bold" }
  }, "⚠️ WebGPU Limit"), /* @__PURE__ */ React.createElement("div", {
    style: { fontSize: "12px" }
  }, "Only one FastGraph component can be active at a time.", /* @__PURE__ */ React.createElement("br", null), "Another component is currently using WebGPU."))), isGraphMode && isInitialized && !error && nodes.length === 0 && /* @__PURE__ */ React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(248, 248, 248, 0.95)",
      color: "#888",
      fontSize: "14px",
      border: "1px solid #ddd",
      borderRadius: "8px",
      zIndex: 10
    }
  }, "No nodes to display"), error && /* @__PURE__ */ React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(240, 240, 240, 0.95)",
      color: "#666",
      fontSize: "14px",
      border: "1px solid #ddd",
      borderRadius: "8px",
      zIndex: 10,
      flexDirection: "column"
    }
  }, /* @__PURE__ */ React.createElement("div", {
    style: { marginBottom: "10px" }
  }, /* @__PURE__ */ React.createElement("strong", null, "Error:"), " ", error), /* @__PURE__ */ React.createElement("button", {
    onClick: handleRetry,
    style: {
      padding: "8px 16px",
      backgroundColor: "#007bff",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "12px"
    }
  }, "Retry ", retryCount > 1 && `(Attempt ${retryCount})`), retryCount > 2 && /* @__PURE__ */ React.createElement("div", {
    style: { marginTop: "8px", fontSize: "12px", color: "#666" }
  }, "Your browser may not support WebGPU or it's disabled.")), isInitializing && !error && /* @__PURE__ */ React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(248, 248, 248, 0.95)",
      color: "#888",
      fontSize: "14px",
      border: "1px solid #ddd",
      borderRadius: "8px",
      zIndex: 10
    }
  }, "Initializing WebGPU...", isGraphMode && /* @__PURE__ */ React.createElement("div", {
    style: { fontSize: "12px", marginTop: "4px" }
  }, "Preparing to render ", nodes.length, " nodes and ", edges.length, " edges")), isInitialized && !error && /* @__PURE__ */ React.createElement("div", {
    style: {
      position: "absolute",
      bottom: "8px",
      left: "8px",
      padding: "4px 8px",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      color: "#fff",
      fontSize: "12px",
      fontFamily: "monospace",
      borderRadius: "4px",
      zIndex: 5,
      userSelect: "none",
      pointerEvents: "none"
    }
  }, fps, " FPS"));
};
// src/examples.ts
function generateLinearGraph(nodeCount = 5) {
  const nodes = [];
  const edges = [];
  for (let i = 0;i < nodeCount; i++) {
    nodes.push({
      id: `node-${i}`,
      x: 0.1 + 0.8 * i / (nodeCount - 1),
      y: 0.5,
      color: `hsl(${i * 360 / nodeCount}, 70%, 50%)`,
      size: 8,
      label: `Node ${i}`
    });
    if (i > 0) {
      edges.push({
        source: `node-${i - 1}`,
        target: `node-${i}`,
        color: "#34495e",
        width: 2
      });
    }
  }
  return { nodes, edges };
}
function generateGridGraph(rows = 3, cols = 4) {
  const nodes = [];
  const edges = [];
  for (let row = 0;row < rows; row++) {
    for (let col = 0;col < cols; col++) {
      const id = `node-${row}-${col}`;
      nodes.push({
        id,
        x: 0.1 + 0.8 * col / (cols - 1),
        y: 0.1 + 0.8 * row / (rows - 1),
        color: "#3498db",
        size: 6,
        label: `(${row},${col})`
      });
    }
  }
  for (let row = 0;row < rows; row++) {
    for (let col = 0;col < cols; col++) {
      const currentId = `node-${row}-${col}`;
      if (col < cols - 1) {
        edges.push({
          source: currentId,
          target: `node-${row}-${col + 1}`,
          color: "#95a5a6",
          width: 1
        });
      }
      if (row < rows - 1) {
        edges.push({
          source: currentId,
          target: `node-${row + 1}-${col}`,
          color: "#95a5a6",
          width: 1
        });
      }
    }
  }
  return { nodes, edges };
}
function generateRandomGraph(nodeCount = 10, edgeProbability = 0.3) {
  const nodes = [];
  const edges = [];
  for (let i = 0;i < nodeCount; i++) {
    nodes.push({
      id: `node-${i}`,
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
      color: `hsl(${Math.random() * 360}, 60%, 50%)`,
      size: 4 + Math.random() * 8,
      label: `R${i}`
    });
  }
  for (let i = 0;i < nodeCount; i++) {
    for (let j = i + 1;j < nodeCount; j++) {
      if (Math.random() < edgeProbability) {
        edges.push({
          source: `node-${i}`,
          target: `node-${j}`,
          color: "#7f8c8d",
          width: 0.5 + Math.random() * 2
        });
      }
    }
  }
  return { nodes, edges };
}
function generateCircularGraph(nodeCount = 8) {
  const nodes = [];
  const edges = [];
  const centerX = 0.5;
  const centerY = 0.5;
  const radius = 0.35;
  for (let i = 0;i < nodeCount; i++) {
    const angle = 2 * Math.PI * i / nodeCount;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    nodes.push({
      id: `node-${i}`,
      x,
      y,
      color: `hsl(${i * 360 / nodeCount}, 80%, 60%)`,
      size: 10,
      label: `C${i}`
    });
    const nextIndex = (i + 1) % nodeCount;
    edges.push({
      source: `node-${i}`,
      target: `node-${nextIndex}`,
      color: "#2c3e50",
      width: 3
    });
  }
  return { nodes, edges };
}
function generateTreeGraph(depth = 3, branchingFactor = 2) {
  const nodes = [];
  const edges = [];
  let nodeId = 0;
  function addNode(x, y, level) {
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
  function generateLevel(parentId, level, x, y, width) {
    if (level >= depth)
      return [];
    const levelNodes = [];
    const nodeCount = level === 0 ? 1 : branchingFactor;
    for (let i = 0;i < nodeCount; i++) {
      const nodeX = nodeCount === 1 ? x : x - width / 2 + width * i / (nodeCount - 1);
      const nodeId2 = addNode(nodeX, y, level);
      levelNodes.push(nodeId2);
      if (parentId) {
        edges.push({
          source: parentId,
          target: nodeId2,
          color: "#34495e",
          width: 2
        });
      }
      const nextY = y + 0.8 / depth;
      const nextWidth = width / branchingFactor;
      generateLevel(nodeId2, level + 1, nodeX, nextY, nextWidth);
    }
    return levelNodes;
  }
  generateLevel(null, 0, 0.5, 0.1, 0.8);
  return { nodes, edges };
}
function generateStarGraph(outerNodeCount = 6) {
  const nodes = [];
  const edges = [];
  nodes.push({
    id: "center",
    x: 0.5,
    y: 0.5,
    color: "#e74c3c",
    size: 15,
    label: "Center"
  });
  const radius = 0.3;
  for (let i = 0;i < outerNodeCount; i++) {
    const angle = 2 * Math.PI * i / outerNodeCount;
    const x = 0.5 + radius * Math.cos(angle);
    const y = 0.5 + radius * Math.sin(angle);
    const id = `outer-${i}`;
    nodes.push({
      id,
      x,
      y,
      color: "#3498db",
      size: 8,
      label: `O${i}`
    });
    edges.push({
      source: "center",
      target: id,
      color: "#9b59b6",
      width: 2
    });
  }
  return { nodes, edges };
}
function generateCompleteGraph(nodeCount = 5) {
  const nodes = [];
  const edges = [];
  const centerX = 0.5;
  const centerY = 0.5;
  const radius = 0.3;
  for (let i = 0;i < nodeCount; i++) {
    const angle = 2 * Math.PI * i / nodeCount;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    nodes.push({
      id: `node-${i}`,
      x,
      y,
      color: `hsl(${i * 360 / nodeCount}, 70%, 55%)`,
      size: 8,
      label: `K${i}`
    });
  }
  for (let i = 0;i < nodeCount; i++) {
    for (let j = i + 1;j < nodeCount; j++) {
      edges.push({
        source: `node-${i}`,
        target: `node-${j}`,
        color: "#34495e",
        width: 1
      });
    }
  }
  return { nodes, edges };
}
function generateBipartiteGraph(leftCount = 4, rightCount = 3, connectionProbability = 0.6) {
  const nodes = [];
  const edges = [];
  for (let i = 0;i < leftCount; i++) {
    nodes.push({
      id: `left-${i}`,
      x: 0.2,
      y: 0.1 + 0.8 * i / (leftCount - 1),
      color: "#e67e22",
      size: 8,
      label: `L${i}`
    });
  }
  for (let i = 0;i < rightCount; i++) {
    nodes.push({
      id: `right-${i}`,
      x: 0.8,
      y: 0.1 + 0.8 * i / (rightCount - 1),
      color: "#27ae60",
      size: 8,
      label: `R${i}`
    });
  }
  for (let i = 0;i < leftCount; i++) {
    for (let j = 0;j < rightCount; j++) {
      if (Math.random() < connectionProbability) {
        edges.push({
          source: `left-${i}`,
          target: `right-${j}`,
          color: "#95a5a6",
          width: 1.5
        });
      }
    }
  }
  return { nodes, edges };
}
var exampleGraphs = {
  linear: generateLinearGraph,
  grid: generateGridGraph,
  random: generateRandomGraph,
  circular: generateCircularGraph,
  tree: generateTreeGraph,
  star: generateStarGraph,
  complete: generateCompleteGraph,
  bipartite: generateBipartiteGraph
};
function getExampleGraph(name) {
  switch (name) {
    case "linear":
      return generateLinearGraph(6);
    case "grid":
      return generateGridGraph(3, 4);
    case "random":
      return generateRandomGraph(8, 0.4);
    case "circular":
      return generateCircularGraph(8);
    case "tree":
      return generateTreeGraph(3, 3);
    case "star":
      return generateStarGraph(7);
    case "complete":
      return generateCompleteGraph(5);
    case "bipartite":
      return generateBipartiteGraph(4, 3, 0.7);
    default:
      return generateLinearGraph(5);
  }
}
export {
  validateNode,
  validateGraph,
  validateEdge,
  updateNodePosition,
  updateGraphPhysics,
  prepareGraphDataForGPU,
  normalizedToCanvas,
  normalizeNode,
  normalizeEdge,
  isValidHexColor,
  hexToRgba,
  getPerformanceRecommendations,
  getGraphBounds,
  getExampleGraph,
  getConnectedEdges,
  generateTreeGraph,
  generateStarGraph,
  generateRandomGraph,
  generateLinearGraph,
  generateGridGraph,
  generateCompleteGraph,
  generateCircularGraph,
  generateBipartiteGraph,
  findNodeById,
  exampleGraphs,
  FastGraph as default,
  checkGraphLimits,
  canvasToNormalized,
  applyDamping,
  addRandomVelocity,
  MAX_NODES,
  MAX_EDGES,
  FastGraph,
  DEFAULT_NODE_SIZE,
  DEFAULT_NODE_COLOR,
  DEFAULT_EDGE_WIDTH,
  DEFAULT_EDGE_COLOR
};
