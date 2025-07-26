// Vertex shader for rendering edges as oriented rectangles
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

struct VertexInput {
    @location(0) position: vec2<f32>,  // Quad vertex position (-1 to 1)
    @location(1) instance_start: vec2<f32>,  // Start position in pixels
    @location(2) instance_end: vec2<f32>,    // End position in pixels
    @location(3) instance_color: vec4<f32>,  // Edge color
    @location(4) instance_width: f32,        // Edge width in pixels
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) uv: vec2<f32>,  // UV coordinates for anti-aliasing
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Apply camera transformations in pixel space
    let start_world_x = (input.instance_start.x - uniforms.camera_position.x) * uniforms.camera_zoom;
    let start_world_y = (input.instance_start.y - uniforms.camera_position.y) * uniforms.camera_zoom;
    let end_world_x = (input.instance_end.x - uniforms.camera_position.x) * uniforms.camera_zoom;
    let end_world_y = (input.instance_end.y - uniforms.camera_position.y) * uniforms.camera_zoom;
    
    // Convert to NDC
    let start_ndc = vec2<f32>(
        (start_world_x / uniforms.resolution.x) * 2.0 - 1.0,
        1.0 - (start_world_y / uniforms.resolution.y) * 2.0
    );
    let end_ndc = vec2<f32>(
        (end_world_x / uniforms.resolution.x) * 2.0 - 1.0,
        1.0 - (end_world_y / uniforms.resolution.y) * 2.0
    );
    
    // Calculate line direction and perpendicular vector
    let line_vec = end_ndc - start_ndc;
    let line_length = length(line_vec);
    
    if (line_length > 0.0) {
        let line_dir = line_vec / line_length;
        let line_perp = vec2<f32>(-line_dir.y, line_dir.x);
        
        // Convert width to NDC units (maintain aspect ratio and apply zoom)
        let width_ndc_x = (input.instance_width * uniforms.camera_zoom / uniforms.resolution.x) * 2.0;
        let width_ndc_y = (input.instance_width * uniforms.camera_zoom / uniforms.resolution.y) * 2.0;
        let width_ndc = min(width_ndc_x, width_ndc_y);
        
        // Calculate vertex position
        // position.x (-1 to 1) maps along the line direction
        // position.y (-1 to 1) maps across the line width
        let along_offset = input.position.x * line_length * 0.5;
        let across_offset = input.position.y * width_ndc * 0.5;
        
        let line_center = (start_ndc + end_ndc) * 0.5;
        let vertex_pos = line_center + line_dir * along_offset + line_perp * across_offset;
        
        output.clip_position = vec4<f32>(vertex_pos, 0.0, 1.0);
        output.uv = input.position;  // Pass through UV coordinates (-1 to 1)
    } else {
        // Degenerate line (zero length), hide it
        output.clip_position = vec4<f32>(0.0, 0.0, -1.0, 1.0);
        output.uv = vec2<f32>(0.0, 0.0);
    }
    
    output.color = input.instance_color;
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate distance from center line (along Y axis)
    let edge_distance = abs(input.uv.y);
    
    // Add anti-aliasing with smooth falloff at edges
    let edge_softness = 0.1;
    let alpha = 1.0 - smoothstep(1.0 - edge_softness, 1.0, edge_distance);
    
    // Apply alpha to the color
    return vec4<f32>(input.color.rgb, input.color.a * alpha);
}