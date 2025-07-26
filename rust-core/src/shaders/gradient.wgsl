// Vertex shader - creates a full-screen triangle
@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );
    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
}

// Uniforms struct
struct Uniforms {
    time: f32,
    _padding1: f32,
    resolution: vec2<f32>,
    color1: vec4<f32>,
    color2: vec4<f32>,
    camera_position: vec2<f32>,
    camera_zoom: f32,
    _padding2: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// Fragment shader - creates animated gradient
@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    // Normalize coordinates to [0, 1]
    let uv = fragCoord.xy / uniforms.resolution.xy;
    
    // Create animated gradient factor
    // This creates a diagonal gradient that moves over time
    let gradient_factor = (uv.x + uv.y + sin(uniforms.time * 0.5) * 0.5) * 0.5;
    
    // Smooth the gradient factor
    let smooth_factor = smoothstep(0.0, 1.0, gradient_factor);
    
    // Mix the two colors based on the gradient factor
    let final_color = mix(uniforms.color1.rgb, uniforms.color2.rgb, smooth_factor);
    
    return vec4<f32>(final_color, 1.0);
}