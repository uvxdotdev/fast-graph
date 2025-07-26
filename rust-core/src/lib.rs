use wasm_bindgen::prelude::*;
use web_sys::{console, HtmlCanvasElement};

mod renderer;
use renderer::{Renderer, MAX_NODES, MAX_EDGES};

// Struct to represent a node for WebGPU rendering
#[derive(Clone, Debug)]
pub struct NodeData {
    pub x: f32,
    pub y: f32,
    pub r: f32,
    pub g: f32,
    pub b: f32,
    pub a: f32,
    pub size: f32,
}

// Struct to represent an edge for WebGPU rendering
#[derive(Clone, Debug)]
pub struct EdgeData {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
    pub r: f32,
    pub g: f32,
    pub b: f32,
    pub a: f32,
    pub width: f32,
}

// A macro to provide `println!(..)`-style syntax for `console.log` logging.
macro_rules! log {
    ( $( $t:tt )* ) => {
        console::log_1(&format!( $( $t )* ).into());
    }
}

#[wasm_bindgen]
pub struct FastGraphRenderer {
    renderer: Renderer,
    color1: [f32; 4],
    color2: [f32; 4],
    nodes: Vec<NodeData>,
    edges: Vec<EdgeData>,
    camera_position: [f32; 2],
    camera_zoom: f32,
    is_initialized: bool,
    is_rendering: bool,
}

#[wasm_bindgen]
impl FastGraphRenderer {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_error_panic_hook::set_once();
        log!("Initializing FastGraph renderer...");

        Self {
            renderer: Renderer::new(),
            color1: [1.0, 0.0, 0.0, 1.0], // Default red
            color2: [0.0, 0.0, 1.0, 1.0], // Default blue
            nodes: Vec::new(),
            edges: Vec::new(),
            camera_position: [0.0, 0.0],
            camera_zoom: 1.0,
            is_initialized: false,
            is_rendering: false,
        }
    }

    #[wasm_bindgen]
    pub async fn init(&mut self, canvas: &HtmlCanvasElement) -> Result<(), JsValue> {
        if self.is_initialized {
            log!("Renderer already initialized");
            return Ok(());
        }
        
        log!("Initializing WebGPU renderer for canvas");
        
        // Simple retry logic for WebGPU initialization
        let mut attempts = 0;
        let max_attempts = 2;
        
        while attempts < max_attempts {
            match self.renderer.init(canvas).await {
                Ok(_) => {
                    self.is_initialized = true;
                    log!("WebGPU renderer initialized successfully");
                    return Ok(());
                }
                Err(e) => {
                    attempts += 1;
                    log!("WebGPU initialization attempt {} failed: {:?}", attempts, e);
                    
                    if attempts >= max_attempts {
                        return Err(JsValue::from_str(&format!(
                            "Failed to initialize WebGPU: {:?}", e
                        )));
                    }
                }
            }
        }
        
        Err(JsValue::from_str("Failed to initialize WebGPU"))
    }

    #[wasm_bindgen]
    pub fn render(&mut self, time: f64) {
        if !self.is_initialized {
            return;
        }
        
        if self.is_rendering {
            return; // Skip frame if already rendering
        }
        
        self.is_rendering = true;
        
        // Perform render with error handling
        match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            self.renderer.render(time, &self.color1, &self.color2, &self.nodes, &self.edges, &self.camera_position, self.camera_zoom);
        })) {
            Ok(_) => {},
            Err(_) => {
                log!("Render operation failed, skipping frame");
            }
        }
        
        self.is_rendering = false;
    }

    #[wasm_bindgen]
    pub fn resize(&mut self, width: u32, height: u32) {
        if !self.is_initialized || self.is_rendering {
            return;
        }
        
        self.renderer.resize(width, height);
    }

    #[wasm_bindgen]
    pub fn set_colors(&mut self, color1_r: f32, color1_g: f32, color1_b: f32, color1_a: f32,
                      color2_r: f32, color2_g: f32, color2_b: f32, color2_a: f32) {
        self.color1 = [color1_r, color1_g, color1_b, color1_a];
        self.color2 = [color2_r, color2_g, color2_b, color2_a];
    }

    #[wasm_bindgen]
    pub fn set_color1(&mut self, r: f32, g: f32, b: f32, a: f32) {
        self.color1 = [r, g, b, a];
    }

    #[wasm_bindgen]
    pub fn set_color2(&mut self, r: f32, g: f32, b: f32, a: f32) {
        self.color2 = [r, g, b, a];
    }

    #[wasm_bindgen]
    pub fn set_color1_hex(&mut self, hex: &str) {
        if let Some(color) = parse_hex_color(hex) {
            self.color1 = color;
        }
    }

    #[wasm_bindgen]
    pub fn set_color2_hex(&mut self, hex: &str) {
        if let Some(color) = parse_hex_color(hex) {
            self.color2 = color;
        }
    }

    #[wasm_bindgen]
    pub fn set_nodes(&mut self, node_data: &[f32]) {
        self.nodes.clear();
        
        // Each node has 7 floats: x, y, r, g, b, a, size
        let stride = 7;
        let node_count = node_data.len() / stride;
        
        for i in 0..node_count {
            let base = i * stride;
            if base + stride <= node_data.len() {
                self.nodes.push(NodeData {
                    x: node_data[base],
                    y: node_data[base + 1],
                    r: node_data[base + 2],
                    g: node_data[base + 3],
                    b: node_data[base + 4],
                    a: node_data[base + 5],
                    size: node_data[base + 6],
                });
            }
        }
        
        log!("Updated nodes: {} nodes", self.nodes.len());
    }

    #[wasm_bindgen]
    pub fn set_edges(&mut self, edge_data: &[f32]) {
        self.edges.clear();
        
        // Each edge has 9 floats: x1, y1, x2, y2, r, g, b, a, width
        let stride = 9;
        let edge_count = edge_data.len() / stride;
        
        for i in 0..edge_count {
            let base = i * stride;
            if base + stride <= edge_data.len() {
                self.edges.push(EdgeData {
                    x1: edge_data[base],
                    y1: edge_data[base + 1],
                    x2: edge_data[base + 2],
                    y2: edge_data[base + 3],
                    r: edge_data[base + 4],
                    g: edge_data[base + 5],
                    b: edge_data[base + 6],
                    a: edge_data[base + 7],
                    width: edge_data[base + 8],
                });
            }
        }
        
        log!("Updated edges: {} edges", self.edges.len());
    }

    #[wasm_bindgen]
    pub fn set_camera_position(&mut self, x: f32, y: f32) {
        self.camera_position = [x, y];
    }

    #[wasm_bindgen]
    pub fn set_camera_zoom(&mut self, zoom: f32) {
        self.camera_zoom = zoom.max(0.1).min(10.0); // Clamp zoom between 0.1x and 10x
    }

    #[wasm_bindgen]
    pub fn get_camera_position_x(&self) -> f32 {
        self.camera_position[0]
    }

    #[wasm_bindgen]
    pub fn get_camera_position_y(&self) -> f32 {
        self.camera_position[1]
    }

    #[wasm_bindgen]
    pub fn get_camera_zoom(&self) -> f32 {
        self.camera_zoom
    }

    #[wasm_bindgen]
    pub fn reset_camera(&mut self) {
        self.camera_position = [0.0, 0.0];
        self.camera_zoom = 1.0;
    }

    #[wasm_bindgen]
    pub fn get_max_nodes(&self) -> u32 {
        MAX_NODES as u32
    }

    #[wasm_bindgen]
    pub fn get_max_edges(&self) -> u32 {
        MAX_EDGES as u32
    }

    #[wasm_bindgen]
    pub fn get_current_node_count(&self) -> u32 {
        self.nodes.len() as u32
    }

    #[wasm_bindgen]
    pub fn get_current_edge_count(&self) -> u32 {
        self.edges.len() as u32
    }
}

fn parse_hex_color(hex: &str) -> Option<[f32; 4]> {
    let hex = hex.trim_start_matches('#');
    
    match hex.len() {
        6 => {
            // RGB format
            if let (Ok(r), Ok(g), Ok(b)) = (
                u8::from_str_radix(&hex[0..2], 16),
                u8::from_str_radix(&hex[2..4], 16),
                u8::from_str_radix(&hex[4..6], 16),
            ) {
                Some([
                    r as f32 / 255.0,
                    g as f32 / 255.0,
                    b as f32 / 255.0,
                    1.0,
                ])
            } else {
                None
            }
        }
        8 => {
            // RGBA format
            if let (Ok(r), Ok(g), Ok(b), Ok(a)) = (
                u8::from_str_radix(&hex[0..2], 16),
                u8::from_str_radix(&hex[2..4], 16),
                u8::from_str_radix(&hex[4..6], 16),
                u8::from_str_radix(&hex[6..8], 16),
            ) {
                Some([
                    r as f32 / 255.0,
                    g as f32 / 255.0,
                    b as f32 / 255.0,
                    a as f32 / 255.0,
                ])
            } else {
                None
            }
        }
        3 => {
            // Short RGB format
            if let (Ok(r), Ok(g), Ok(b)) = (
                u8::from_str_radix(&hex[0..1], 16),
                u8::from_str_radix(&hex[1..2], 16),
                u8::from_str_radix(&hex[2..3], 16),
            ) {
                Some([
                    (r * 17) as f32 / 255.0, // Convert single digit to double
                    (g * 17) as f32 / 255.0,
                    (b * 17) as f32 / 255.0,
                    1.0,
                ])
            } else {
                None
            }
        }
        _ => None,
    }
}