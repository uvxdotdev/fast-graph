// Vertex shader for rendering circular nodes
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
    @location(1) instance_pos: vec2<f32>,  // Node center position in NDC
    @location(2) instance_color: vec4<f32>,  // Node color
    @location(3) instance_size: f32,  // Node radius in pixels
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) uv: vec2<f32>,  // UV coordinates relative to circle center (-1 to 1)
    @location(2) radius: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Calculate aspect ratio to maintain circular nodes
    let aspect_ratio = uniforms.resolution.x / uniforms.resolution.y;
    
    // Convert NDC position back to pixel coordinates
    let pixel_x = (input.instance_pos.x + 1.0) * 0.5 * uniforms.resolution.x;
    let pixel_y = (1.0 - input.instance_pos.y) * 0.5 * uniforms.resolution.y;
    
    // Apply camera transformations in pixel space
    let world_pixel_x = (pixel_x - uniforms.camera_position.x) * uniforms.camera_zoom;
    let world_pixel_y = (pixel_y - uniforms.camera_position.y) * uniforms.camera_zoom;
    
    // Convert back to NDC
    let world_ndc_x = (world_pixel_x / uniforms.resolution.x) * 2.0 - 1.0;
    let world_ndc_y = 1.0 - (world_pixel_y / uniforms.resolution.y) * 2.0;
    
    // Convert pixel size to NDC size with zoom correction
    let ndc_size_x = (input.instance_size * uniforms.camera_zoom / uniforms.resolution.x) * 2.0;
    let ndc_size_y = (input.instance_size * uniforms.camera_zoom / uniforms.resolution.y) * 2.0;
    
    // Apply aspect ratio correction to vertex offset
    var vertex_offset = input.position;
    vertex_offset.x *= ndc_size_x;
    vertex_offset.y *= ndc_size_y;
    
    let ndc_pos = vec2<f32>(world_ndc_x, world_ndc_y) + vertex_offset;
    
    output.clip_position = vec4<f32>(ndc_pos.x, ndc_pos.y, 0.0, 1.0);
    output.color = input.instance_color;
    output.uv = input.position;  // This will be -1 to 1 for the quad
    output.radius = 1.0;  // Normalized radius
    
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate distance from center
    let dist = length(input.uv);
    
    // Anti-aliased circle
    let edge_softness = 0.05;
    let alpha = 1.0 - smoothstep(input.radius - edge_softness, input.radius, dist);
    
    // Discard pixels outside the circle
    if (alpha <= 0.0) {
        discard;
    }
    
    return vec4<f32>(input.color.rgb, input.color.a * alpha);
}