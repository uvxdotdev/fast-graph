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
  color1 = "#ff0000",
  color2 = "#0000ff",
  width = 800,
  height = 600,
  className,
  style
}) => {
  const [canvas, setCanvas] = useState(null);
  const rendererRef = useRef(null);
  const animationIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const componentId = useRef(`fast-graph-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`);
  const initialColorsRef = useRef({ color1, color2 });
  const mountedRef = useRef(true);
  console.log("FastGraph render:", { isActive, isInitialized, isInitializing, error, canvas: !!canvas });
  const canvasRef = useCallback((canvasElement) => {
    console.log("Canvas ref callback:", !!canvasElement);
    setCanvas(canvasElement);
  }, []);
  useEffect(() => {
    initialColorsRef.current = { color1, color2 };
  }, [color1, color2]);
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
      setError(err instanceof Error ? err.message : "Render error");
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    }
  }, [isInitialized, error]);
  const handleResize = useCallback(() => {
    if (!canvas || !rendererRef.current || !isInitialized)
      return;
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = rect.width * pixelRatio;
    canvas.height = rect.height * pixelRatio;
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
        if (canvas.width === 0 || canvas.height === 0) {
          canvas.width = (rect.width || width) * pixelRatio;
          canvas.height = (rect.height || height) * pixelRatio;
          console.log("Set canvas dimensions:", canvas.width, "x", canvas.height);
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
    if (!canvas)
      return;
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);
    return () => {
      resizeObserver.disconnect();
    };
  }, [canvas, handleResize]);
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
  const canvasStyle = {
    width,
    height,
    display: "block",
    ...style
  };
  return /* @__PURE__ */ React.createElement("div", {
    style: { position: "relative", ...canvasStyle }
  }, /* @__PURE__ */ React.createElement("canvas", {
    ref: canvasRef,
    className,
    style: canvasStyle,
    width,
    height
  }), !isActive && /* @__PURE__ */ React.createElement("div", {
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
  }, "Only one FastGraph component can be active at a time.", /* @__PURE__ */ React.createElement("br", null), "Another component is currently using WebGPU."))), error && /* @__PURE__ */ React.createElement("div", {
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
  }, "Initializing WebGPU..."));
};
export {
  FastGraph as default,
  FastGraph
};
