use wasm_bindgen::prelude::*;
use web_sys::{console, HtmlCanvasElement};

mod renderer;
use renderer::Renderer;

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
            self.renderer.render(time, &self.color1, &self.color2);
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