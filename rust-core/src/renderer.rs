use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, console};
use wgpu::*;
use crate::{NodeData, EdgeData};

// A macro to provide `println!(..)`-style syntax for `console.log` logging.
macro_rules! log {
    ( $( $t:tt )* ) => {
        console::log_1(&format!( $( $t )* ).into());
    }
}

const PHYSICS_SHADER: &str = r#"
struct NodeData {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    fx: f32,
    fy: f32,
    r: f32,
    g: f32,
    b: f32,
    a: f32,
    size: f32,
    mass: f32,
}

struct EdgeData {
    x1: f32,
    y1: f32,
    x2: f32,
    y2: f32,
    r: f32,
    g: f32,
    b: f32,
    a: f32,
    width: f32,
}

struct PhysicsParams {
    delta_time: f32,
    damping_factor: f32,
    spring_constant: f32,
    rest_length: f32,
    repulsion_strength: f32,
    repulsion_radius: f32,
    node_count: u32,
    edge_count: u32,
}

struct GridCell {
    node_indices: array<u32, 32>,  // Max 32 nodes per cell
    node_count: u32,
}

@group(0) @binding(0) var<storage, read_write> nodes: array<NodeData>;
@group(0) @binding(1) var<storage, read> edges: array<EdgeData>;
@group(0) @binding(2) var<uniform> params: PhysicsParams;
@group(0) @binding(3) var<storage, read_write> grid: array<GridCell, 1024>; // 32x32 grid

const GRID_SIZE: u32 = 32u;
const WORLD_MIN: f32 = -1.0;
const WORLD_MAX: f32 = 1.0;
const WORLD_SIZE: f32 = 2.0; // WORLD_MAX - WORLD_MIN

fn get_grid_cell(pos: vec2<f32>) -> vec2<u32> {
    let normalized_pos = (pos - vec2<f32>(WORLD_MIN)) / WORLD_SIZE;
    let clamped_pos = clamp(normalized_pos, vec2<f32>(0.0), vec2<f32>(0.999));
    return vec2<u32>(u32(clamped_pos.x * f32(GRID_SIZE)), u32(clamped_pos.y * f32(GRID_SIZE)));
}

fn get_grid_index(grid_pos: vec2<u32>) -> u32 {
    return grid_pos.y * GRID_SIZE + grid_pos.x;
}

fn calculate_repulsion_force(node_a: NodeData, node_b: NodeData) -> vec2<f32> {
    let dx = node_b.x - node_a.x;
    let dy = node_b.y - node_a.y;
    let dist = sqrt(dx * dx + dy * dy);
    
    if (dist > params.repulsion_radius || dist < 0.001) {
        return vec2<f32>(0.0, 0.0);
    }
    
    let min_dist = max(dist, 0.01);
    let force_magnitude = params.repulsion_strength / (min_dist * min_dist);
    let nx = -dx / dist;
    let ny = -dy / dist;
    
    return vec2<f32>(nx * force_magnitude, ny * force_magnitude);
}

// Pass 1: Clear grid and assign nodes to cells
@compute @workgroup_size(64)
fn clear_grid(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let grid_index = global_id.x;
    
    if (grid_index >= 1024u) {
        return;
    }
    
    grid[grid_index].node_count = 0u;
}

@compute @workgroup_size(64) 
fn assign_to_grid(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let node_index = global_id.x;
    
    if (node_index >= params.node_count) {
        return;
    }
    
    let node = nodes[node_index];
    let grid_pos = get_grid_cell(vec2<f32>(node.x, node.y));
    let grid_index = get_grid_index(grid_pos);
    
    // Atomically add node to grid cell
    let cell_node_count = atomicAdd(&grid[grid_index].node_count, 1u);
    
    // Only add if cell isn't full
    if (cell_node_count < 32u) {
        grid[grid_index].node_indices[cell_node_count] = node_index;
    }
}

// Pass 2: Calculate repulsion using grid
@compute @workgroup_size(64)
fn calculate_repulsion(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let node_index = global_id.x;
    
    if (node_index >= params.node_count) {
        return;
    }
    
    let node = nodes[node_index];
    let grid_pos = get_grid_cell(vec2<f32>(node.x, node.y));
    var total_force = vec2<f32>(0.0, 0.0);
    
    // Check current cell and 8 neighboring cells (3x3 area)
    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            let check_x = i32(grid_pos.x) + dx;
            let check_y = i32(grid_pos.y) + dy;
            
            // Bounds check
            if (check_x >= 0 && check_x < i32(GRID_SIZE) && 
                check_y >= 0 && check_y < i32(GRID_SIZE)) {
                
                let check_grid_pos = vec2<u32>(u32(check_x), u32(check_y));
                let check_grid_index = get_grid_index(check_grid_pos);
                let cell = grid[check_grid_index];
                
                // Check all nodes in this cell
                for (var i = 0u; i < cell.node_count && i < 32u; i++) {
                    let other_node_index = cell.node_indices[i];
                    
                    if (other_node_index != node_index) {
                        let other_node = nodes[other_node_index];
                        let repulsion_force = calculate_repulsion_force(node, other_node);
                        total_force -= repulsion_force;
                    }
                }
            }
        }
    }
    
    // Update node with calculated repulsion forces
    nodes[node_index].fx += total_force.x;
    nodes[node_index].fy += total_force.y;
}

// Pass 3: Physics integration
@compute @workgroup_size(64)
fn integrate_physics(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    
    if (index >= params.node_count) {
        return;
    }
    
    var node = nodes[index];
    
    // Integrate velocity: v += f * dt
    node.vx += node.fx * params.delta_time;
    node.vy += node.fy * params.delta_time;
    
    // Apply damping: v *= damping
    node.vx *= params.damping_factor;
    node.vy *= params.damping_factor;
    
    // Integrate position: x += v * dt
    node.x += node.vx * params.delta_time;
    node.y += node.vy * params.delta_time;
    
    // Reset force accumulators
    node.fx = 0.0;
    node.fy = 0.0;
    
    nodes[index] = node;
}
"#;

// Buffer size limits - can handle large graphs
pub const MAX_NODES: usize = 100_000;
pub const MAX_EDGES: usize = 200_000;
const FLOATS_PER_NODE: usize = 12;  // x, y, vx, vy, fx, fy, r, g, b, a, size, mass
const FLOATS_PER_EDGE: usize = 9;  // x1, y1, x2, y2, r, g, b, a, width

pub struct Renderer {
    device: Option<Device>,
    queue: Option<Queue>,
    surface: Option<Surface<'static>>,
    config: Option<SurfaceConfiguration>,
    gradient_pipeline: Option<RenderPipeline>,
    node_pipeline: Option<RenderPipeline>,
    edge_pipeline: Option<RenderPipeline>,
    clear_grid_pipeline: Option<ComputePipeline>,
    assign_grid_pipeline: Option<ComputePipeline>,
    repulsion_pipeline: Option<ComputePipeline>,
    integration_pipeline: Option<ComputePipeline>,
    canvas: Option<HtmlCanvasElement>,
    uniform_buffer: Option<Buffer>,
    uniform_bind_group: Option<BindGroup>,
    physics_params_buffer: Option<Buffer>,
    compute_bind_group: Option<BindGroup>,
    node_vertex_buffer: Option<Buffer>,
    node_instance_buffer: Option<Buffer>,
    edge_vertex_buffer: Option<Buffer>,
    edge_instance_buffer: Option<Buffer>,
    node_physics_buffer: Option<Buffer>,
    edge_physics_buffer: Option<Buffer>,
    grid_buffer: Option<Buffer>,
}

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct Uniforms {
    time: f32,
    _padding1: f32,
    resolution: [f32; 2],
    color1: [f32; 4],
    color2: [f32; 4],
    camera_position: [f32; 2],
    camera_zoom: f32,
    _padding2: f32,
}

impl Renderer {
    pub fn new() -> Self {
        Self {
            device: None,
            queue: None,
            surface: None,
            config: None,
            gradient_pipeline: None,
            node_pipeline: None,
            edge_pipeline: None,
            clear_grid_pipeline: None,
            assign_grid_pipeline: None,
            repulsion_pipeline: None,
            integration_pipeline: None,
            canvas: None,
            uniform_buffer: None,
            uniform_bind_group: None,
            physics_params_buffer: None,
            compute_bind_group: None,
            node_vertex_buffer: None,
            node_instance_buffer: None,
            edge_vertex_buffer: None,
            edge_instance_buffer: None,
            node_physics_buffer: None,
            edge_physics_buffer: None,
            grid_buffer: None,
        }
    }

    pub async fn init(&mut self, canvas: &HtmlCanvasElement) -> Result<(), JsValue> {
        let width = canvas.width();
        let height = canvas.height();
        
        // Validate canvas dimensions
        if width == 0 || height == 0 {
            return Err(JsValue::from_str("Canvas has invalid dimensions"));
        }
        
        // Validate WebGPU texture size limits
        const MAX_TEXTURE_SIZE: u32 = 2048;
        if width > MAX_TEXTURE_SIZE || height > MAX_TEXTURE_SIZE {
            return Err(JsValue::from_str(&format!(
                "Canvas dimensions exceed WebGPU limits: {}x{} (max: {}x{})",
                width, height, MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE
            )));
        }

        // Create WGPU instance
        let instance = Instance::new(&InstanceDescriptor {
            backends: Backends::GL,
            flags: Default::default(),
            ..Default::default()
        });

        // Create surface directly from canvas element
        let surface = instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
            .map_err(|e| JsValue::from_str(&format!("Failed to create surface: {:?}", e)))?;

        // Get adapter
        let adapter = instance
            .request_adapter(&RequestAdapterOptions {
                power_preference: PowerPreference::default(),
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .map_err(|e| JsValue::from_str(&format!("Failed to find suitable graphics adapter: {:?}", e)))?;

        // Get device and queue with compute shader support
        // First try with conservative compute limits
        let mut limits = Limits::downlevel_webgl2_defaults();
        limits.max_storage_buffers_per_shader_stage = 2; // Minimal for our compute shader needs
        limits.max_compute_workgroup_storage_size = 1024; // Conservative value
        limits.max_compute_invocations_per_workgroup = 64; // Conservative value
        limits.max_compute_workgroup_size_x = 64;
        limits.max_compute_workgroup_size_y = 1;
        limits.max_compute_workgroup_size_z = 1;
        limits.max_compute_workgroups_per_dimension = 1024;
        
        let (device, queue) = match adapter
            .request_device(
                &DeviceDescriptor {
                    label: None,
                    required_features: Features::empty(),
                    required_limits: limits.clone(),
                    memory_hints: Default::default(),
                    trace: Default::default(),
                },
            )
            .await
        {
            Ok(device_queue) => device_queue,
            Err(_) => {
                // Fallback: try without compute shader support
                log!("Failed to create device with compute support, falling back to basic limits");
                adapter
                    .request_device(
                        &DeviceDescriptor {
                            label: None,
                            required_features: Features::empty(),
                            required_limits: Limits::downlevel_webgl2_defaults(),
                            memory_hints: Default::default(),
                            trace: Default::default(),
                        },
                    )
                    .await
                    .map_err(|e| JsValue::from_str(&format!("Failed to create device: {:?}", e)))?
            }
        };

        // Configure surface
        let config = SurfaceConfiguration {
            usage: TextureUsages::RENDER_ATTACHMENT,
            format: surface.get_capabilities(&adapter).formats[0],
            width,
            height,
            present_mode: PresentMode::Fifo,
            alpha_mode: CompositeAlphaMode::Auto,
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &config);

        // Create uniform buffer
        let uniform_buffer = device.create_buffer(&BufferDescriptor {
            label: Some("Uniform Buffer"),
            size: std::mem::size_of::<Uniforms>() as u64,
            usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // Create bind group layout for uniforms
        let uniform_bind_group_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("Uniform Bind Group Layout"),
            entries: &[BindGroupLayoutEntry {
                binding: 0,
                visibility: ShaderStages::VERTEX | ShaderStages::FRAGMENT,
                ty: BindingType::Buffer {
                    ty: BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            }],
        });

        // Create bind group for uniforms
        let uniform_bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("Uniform Bind Group"),
            layout: &uniform_bind_group_layout,
            entries: &[BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        // Initialize uniform buffer
        let initial_uniforms = Uniforms {
            time: 0.0,
            _padding1: 0.0,
            resolution: [width as f32, height as f32],
            color1: [1.0, 0.0, 0.0, 1.0], // Red
            color2: [0.0, 0.0, 1.0, 1.0], // Blue
            camera_position: [0.0, 0.0],
            camera_zoom: 1.0,
            _padding2: 0.0,
        };
        queue.write_buffer(&uniform_buffer, 0, bytemuck::cast_slice(&[initial_uniforms]));

        // Create render pipelines
        let gradient_pipeline = self.create_gradient_pipeline(&device, config.format, &uniform_bind_group_layout);
        let node_pipeline = self.create_node_pipeline(&device, config.format, &uniform_bind_group_layout);
        let edge_pipeline = self.create_edge_pipeline(&device, config.format, &uniform_bind_group_layout);
        
        // Conditionally create compute pipeline for physics (only if device supports storage buffers)
        let (compute_pipelines, compute_bind_group, node_physics_buffer, edge_physics_buffer, physics_params_buffer, grid_buffer) = 
            if device.limits().max_storage_buffers_per_shader_stage >= 3 {
                log!("Device supports compute shaders, enabling GPU physics");
                let ((clear_grid_pipeline, assign_grid_pipeline, repulsion_pipeline, integration_pipeline), compute_bind_group_layout) = self.create_compute_pipeline(&device);
                
                // Create physics buffers
                let node_physics_buffer = device.create_buffer(&BufferDescriptor {
                    label: Some("Node Physics Buffer"),
                    size: (MAX_NODES * std::mem::size_of::<NodeData>()) as u64,
                    usage: BufferUsages::STORAGE | BufferUsages::COPY_DST | BufferUsages::COPY_SRC,
                    mapped_at_creation: false,
                });
                
                let edge_physics_buffer = device.create_buffer(&BufferDescriptor {
                    label: Some("Edge Physics Buffer"),
                    size: (MAX_EDGES * std::mem::size_of::<EdgeData>()) as u64,
                    usage: BufferUsages::STORAGE | BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });
                
                // Create physics params buffer
                let physics_params_buffer = device.create_buffer(&BufferDescriptor {
                    label: Some("Physics Params Buffer"),
                    size: std::mem::size_of::<[f32; 8]>() as u64, // delta_time, damping_factor, spring_constant, rest_length, repulsion_strength, repulsion_radius, node_count, edge_count
                    usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });
                
                // Create grid buffer for spatial partitioning (32x32 = 1024 cells)
                let grid_buffer = device.create_buffer(&BufferDescriptor {
                    label: Some("Spatial Grid Buffer"),
                    size: (1024 * (32 * 4 + 4)) as u64, // 1024 cells * (32 u32 indices + 1 u32 count) * 4 bytes
                    usage: BufferUsages::STORAGE | BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });
                
                // Create compute bind group
                let compute_bind_group = device.create_bind_group(&BindGroupDescriptor {
                    label: Some("Physics Compute Bind Group"),
                    layout: &compute_bind_group_layout,
                    entries: &[
                        BindGroupEntry {
                            binding: 0,
                            resource: node_physics_buffer.as_entire_binding(),
                        },
                        BindGroupEntry {
                            binding: 1,
                            resource: edge_physics_buffer.as_entire_binding(),
                        },
                        BindGroupEntry {
                            binding: 2,
                            resource: physics_params_buffer.as_entire_binding(),
                        },
                        BindGroupEntry {
                            binding: 3,
                            resource: grid_buffer.as_entire_binding(),
                        },
                    ],
                });

                (Some((clear_grid_pipeline, assign_grid_pipeline, repulsion_pipeline, integration_pipeline)), Some(compute_bind_group), Some(node_physics_buffer), Some(edge_physics_buffer), Some(physics_params_buffer), Some(grid_buffer))
            } else {
                log!("Device does not support compute shaders, physics will be CPU-only");
                (None, None, None, None, None, None)
            };
        
        // Create node vertex buffer (quad vertices)
        let quad_vertices: &[f32] = &[
            -1.0, -1.0,  // bottom left
             1.0, -1.0,  // bottom right
             1.0,  1.0,  // top right
            -1.0, -1.0,  // bottom left
             1.0,  1.0,  // top right
            -1.0,  1.0,  // top left
        ];
        
        let node_vertex_buffer = device.create_buffer(&BufferDescriptor {
            label: Some("Node Vertex Buffer"),
            size: (quad_vertices.len() * std::mem::size_of::<f32>()) as u64,
            usage: BufferUsages::VERTEX | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        queue.write_buffer(&node_vertex_buffer, 0, bytemuck::cast_slice(quad_vertices));

        // Create node instance buffer (will be updated per frame)
        let node_instance_buffer = device.create_buffer(&BufferDescriptor {
            label: Some("Node Instance Buffer"),
            size: (MAX_NODES * FLOATS_PER_NODE * std::mem::size_of::<f32>()) as u64,
            usage: BufferUsages::VERTEX | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // Create edge vertex buffer (quad vertices for line rectangles)
        let edge_quad_vertices: &[f32] = &[
            -1.0, -1.0,  // bottom left
             1.0, -1.0,  // bottom right
             1.0,  1.0,  // top right
            -1.0, -1.0,  // bottom left
             1.0,  1.0,  // top right
            -1.0,  1.0,  // top left
        ];
        
        let edge_vertex_buffer = device.create_buffer(&BufferDescriptor {
            label: Some("Edge Vertex Buffer"),
            size: (edge_quad_vertices.len() * std::mem::size_of::<f32>()) as u64,
            usage: BufferUsages::VERTEX | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        queue.write_buffer(&edge_vertex_buffer, 0, bytemuck::cast_slice(edge_quad_vertices));

        // Create edge instance buffer (will be updated per frame)
        let edge_instance_buffer = device.create_buffer(&BufferDescriptor {
            label: Some("Edge Instance Buffer"),
            size: (MAX_EDGES * FLOATS_PER_EDGE * std::mem::size_of::<f32>()) as u64,
            usage: BufferUsages::VERTEX | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        self.device = Some(device);
        self.queue = Some(queue);
        self.surface = Some(surface);
        self.config = Some(config);
        self.gradient_pipeline = Some(gradient_pipeline);
        self.node_pipeline = Some(node_pipeline);
        self.edge_pipeline = Some(edge_pipeline);
        
        if let Some((clear_grid, assign_grid, repulsion, integration)) = compute_pipelines {
            self.clear_grid_pipeline = Some(clear_grid);
            self.assign_grid_pipeline = Some(assign_grid);
            self.repulsion_pipeline = Some(repulsion);
            self.integration_pipeline = Some(integration);
        }
        self.canvas = Some(canvas.clone());
        self.uniform_buffer = Some(uniform_buffer);
        self.uniform_bind_group = Some(uniform_bind_group);
        self.physics_params_buffer = physics_params_buffer;
        self.compute_bind_group = compute_bind_group;
        self.node_vertex_buffer = Some(node_vertex_buffer);
        self.node_instance_buffer = Some(node_instance_buffer);
        self.edge_vertex_buffer = Some(edge_vertex_buffer);
        self.edge_instance_buffer = Some(edge_instance_buffer);
        self.node_physics_buffer = node_physics_buffer;
        self.edge_physics_buffer = edge_physics_buffer;
        
        self.grid_buffer = grid_buffer;

        Ok(())
    }

    fn create_gradient_pipeline(&self, device: &Device, format: TextureFormat, uniform_bind_group_layout: &BindGroupLayout) -> RenderPipeline {
        let shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Gradient Shader"),
            source: ShaderSource::Wgsl(include_str!("shaders/gradient.wgsl").into()),
        });

        let render_pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("Render Pipeline Layout"),
            bind_group_layouts: &[uniform_bind_group_layout],
            push_constant_ranges: &[],
        });

        device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Gradient Pipeline"),
            layout: Some(&render_pipeline_layout),
            vertex: VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[],
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format,
                    blend: Some(BlendState::REPLACE),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: FrontFace::Ccw,
                cull_mode: Some(Face::Back),
                polygon_mode: PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: None,
            multisample: MultisampleState {
                count: 1,
                mask: !0,
                alpha_to_coverage_enabled: false,
            },
            multiview: None,
            cache: None,
        })
    }

    fn create_node_pipeline(&self, device: &Device, format: TextureFormat, uniform_bind_group_layout: &BindGroupLayout) -> RenderPipeline {
        let shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Node Shader"),
            source: ShaderSource::Wgsl(include_str!("shaders/nodes.wgsl").into()),
        });

        let render_pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("Node Pipeline Layout"),
            bind_group_layouts: &[uniform_bind_group_layout],
            push_constant_ranges: &[],
        });

        device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Node Pipeline"),
            layout: Some(&render_pipeline_layout),
            vertex: VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[
                    // Vertex buffer (quad positions)
                    VertexBufferLayout {
                        array_stride: 2 * std::mem::size_of::<f32>() as BufferAddress,
                        step_mode: VertexStepMode::Vertex,
                        attributes: &[
                            VertexAttribute {
                                offset: 0,
                                shader_location: 0,
                                format: VertexFormat::Float32x2,
                            }
                        ],
                    },
                    // Instance buffer (node data)
                    VertexBufferLayout {
                        array_stride: 7 * std::mem::size_of::<f32>() as BufferAddress,
                        step_mode: VertexStepMode::Instance,
                        attributes: &[
                            // Position
                            VertexAttribute {
                                offset: 0,
                                shader_location: 1,
                                format: VertexFormat::Float32x2,
                            },
                            // Color
                            VertexAttribute {
                                offset: 2 * std::mem::size_of::<f32>() as BufferAddress,
                                shader_location: 2,
                                format: VertexFormat::Float32x4,
                            },
                            // Size
                            VertexAttribute {
                                offset: 6 * std::mem::size_of::<f32>() as BufferAddress,
                                shader_location: 3,
                                format: VertexFormat::Float32,
                            },
                        ],
                    },
                ],
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format,
                    blend: Some(BlendState::ALPHA_BLENDING),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: FrontFace::Ccw,
                cull_mode: Some(Face::Back),
                polygon_mode: PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: None,
            multisample: MultisampleState {
                count: 1,
                mask: !0,
                alpha_to_coverage_enabled: false,
            },
            multiview: None,
            cache: None,
        })
    }

    fn create_edge_pipeline(&self, device: &Device, format: TextureFormat, uniform_bind_group_layout: &BindGroupLayout) -> RenderPipeline {
        let shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Edge Shader"),
            source: ShaderSource::Wgsl(include_str!("shaders/edges.wgsl").into()),
        });

        let render_pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("Edge Pipeline Layout"),
            bind_group_layouts: &[uniform_bind_group_layout],
            push_constant_ranges: &[],
        });

        device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Edge Pipeline"),
            layout: Some(&render_pipeline_layout),
            vertex: VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[
                    // Vertex buffer (quad positions)
                    VertexBufferLayout {
                        array_stride: 2 * std::mem::size_of::<f32>() as BufferAddress,
                        step_mode: VertexStepMode::Vertex,
                        attributes: &[
                            VertexAttribute {
                                offset: 0,
                                shader_location: 0,
                                format: VertexFormat::Float32x2,
                            }
                        ],
                    },
                    // Instance buffer (edge data)
                    VertexBufferLayout {
                        array_stride: 9 * std::mem::size_of::<f32>() as BufferAddress,
                        step_mode: VertexStepMode::Instance,
                        attributes: &[
                            // Start position
                            VertexAttribute {
                                offset: 0,
                                shader_location: 1,
                                format: VertexFormat::Float32x2,
                            },
                            // End position
                            VertexAttribute {
                                offset: 2 * std::mem::size_of::<f32>() as BufferAddress,
                                shader_location: 2,
                                format: VertexFormat::Float32x2,
                            },
                            // Color
                            VertexAttribute {
                                offset: 4 * std::mem::size_of::<f32>() as BufferAddress,
                                shader_location: 3,
                                format: VertexFormat::Float32x4,
                            },
                            // Width
                            VertexAttribute {
                                offset: 8 * std::mem::size_of::<f32>() as BufferAddress,
                                shader_location: 4,
                                format: VertexFormat::Float32,
                            },
                        ],
                    },
                ],
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format,
                    blend: Some(BlendState::ALPHA_BLENDING),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: FrontFace::Ccw,
                cull_mode: Some(Face::Back),
                polygon_mode: PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: None,
            multisample: MultisampleState {
                count: 1,
                mask: !0,
                alpha_to_coverage_enabled: false,
            },
            multiview: None,
            cache: None,
        })
    }

    fn create_compute_pipeline(&self, device: &Device) -> ((ComputePipeline, ComputePipeline, ComputePipeline, ComputePipeline), BindGroupLayout) {
        let shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Physics Compute Shader"),
            source: ShaderSource::Wgsl(PHYSICS_SHADER.into()),
        });

        let bind_group_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("Physics Compute Bind Group Layout"),
            entries: &[
                // Nodes buffer (read-write)
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: ShaderStages::COMPUTE,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                // Edges buffer (read-only)
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: ShaderStages::COMPUTE,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                // Physics params (uniform)
                BindGroupLayoutEntry {
                    binding: 2,
                    visibility: ShaderStages::COMPUTE,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                // Grid buffer (read-write)
                BindGroupLayoutEntry {
                    binding: 3,
                    visibility: ShaderStages::COMPUTE,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("Physics Compute Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        // Create multiple compute pipelines for different passes
        let clear_grid_pipeline = device.create_compute_pipeline(&ComputePipelineDescriptor {
            label: Some("Clear Grid Pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("clear_grid"),
            cache: None,
            compilation_options: Default::default(),
        });

        let assign_grid_pipeline = device.create_compute_pipeline(&ComputePipelineDescriptor {
            label: Some("Assign Grid Pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("assign_to_grid"),
            cache: None,
            compilation_options: Default::default(),
        });

        let repulsion_pipeline = device.create_compute_pipeline(&ComputePipelineDescriptor {
            label: Some("Repulsion Pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("calculate_repulsion"),
            cache: None,
            compilation_options: Default::default(),
        });

        let integration_pipeline = device.create_compute_pipeline(&ComputePipelineDescriptor {
            label: Some("Integration Pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("integrate_physics"),
            cache: None,
            compilation_options: Default::default(),
        });

        // Return all pipelines
        ((clear_grid_pipeline, assign_grid_pipeline, repulsion_pipeline, integration_pipeline), bind_group_layout)
    }

    pub fn integrate_physics(&mut self, nodes: &mut [NodeData], edges: &[EdgeData], delta_time: f32, damping_factor: f32, spring_constant: f32, rest_length: f32, repulsion_strength: f32, repulsion_radius: f32) -> Result<(), JsValue> {
        if let (Some(device), Some(queue), Some(clear_grid_pipeline), Some(assign_grid_pipeline), Some(repulsion_pipeline), Some(integration_pipeline), Some(physics_params_buffer), Some(compute_bind_group), Some(node_physics_buffer), Some(edge_physics_buffer)) = (
            &self.device,
            &self.queue,
            &self.clear_grid_pipeline,
            &self.assign_grid_pipeline,
            &self.repulsion_pipeline,
            &self.integration_pipeline,
            &self.physics_params_buffer,
            &self.compute_bind_group,
            &self.node_physics_buffer,
            &self.edge_physics_buffer,
        ) {
            // Update physics parameters for full integration
            let physics_params = [
                delta_time,
                damping_factor,
                spring_constant,
                rest_length,
                repulsion_strength,
                repulsion_radius,
                nodes.len() as f32,
                edges.len() as f32,
            ];
            queue.write_buffer(physics_params_buffer, 0, bytemuck::cast_slice(&physics_params));
            
            // Copy node data to physics buffer
            queue.write_buffer(node_physics_buffer, 0, bytemuck::cast_slice(nodes));
            
            // Copy edge data to physics buffer (convert EdgeData to match shader layout)
            let edge_data: Vec<[f32; 9]> = edges.iter().map(|edge| [
                edge.x1, edge.y1, edge.x2, edge.y2,
                edge.r, edge.g, edge.b, edge.a, edge.width
            ]).collect();
            queue.write_buffer(edge_physics_buffer, 0, bytemuck::cast_slice(&edge_data));
            
            // Create command encoder for three-pass grid-based physics
            let mut encoder = device.create_command_encoder(&CommandEncoderDescriptor {
                label: Some("Grid Physics Compute Encoder"),
            });
            
            {
                let mut compute_pass = encoder.begin_compute_pass(&ComputePassDescriptor {
                    label: Some("Grid Physics Compute Pass"),
                    timestamp_writes: None,
                });
                
                // Pass 1: Clear grid
                compute_pass.set_pipeline(clear_grid_pipeline);
                compute_pass.set_bind_group(0, compute_bind_group, &[]);
                compute_pass.dispatch_workgroups(16, 1, 1); // 1024 cells / 64 threads = 16 workgroups
                
                // Pass 2: Assign nodes to grid
                compute_pass.set_pipeline(assign_grid_pipeline);
                compute_pass.set_bind_group(0, compute_bind_group, &[]);
                let node_workgroups = (nodes.len() + 63) / 64;
                compute_pass.dispatch_workgroups(node_workgroups as u32, 1, 1);
                
                // Pass 3: Calculate repulsion using grid
                compute_pass.set_pipeline(repulsion_pipeline);
                compute_pass.set_bind_group(0, compute_bind_group, &[]);
                compute_pass.dispatch_workgroups(node_workgroups as u32, 1, 1);
                
                // Pass 4: Integrate physics
                compute_pass.set_pipeline(integration_pipeline);
                compute_pass.set_bind_group(0, compute_bind_group, &[]);
                compute_pass.dispatch_workgroups(node_workgroups as u32, 1, 1);
            }
            
            // Submit all compute work
            queue.submit(std::iter::once(encoder.finish()));
            
            // Physics integration completed on GPU
            // Updated node data will be read back during next render pass
            
            Ok(())
        } else {
            // No compute shader support available, physics will run on CPU
            log!("GPU physics integration not available, falling back to CPU physics");
            Ok(())
        }
    }

    pub fn render(&mut self, time: f64, color1: &[f32; 4], color2: &[f32; 4], nodes: &[NodeData], edges: &[EdgeData], camera_position: &[f32; 2], camera_zoom: f32) {
        if let (Some(device), Some(queue), Some(surface), Some(gradient_pipeline), Some(node_pipeline), Some(edge_pipeline), Some(uniform_buffer), Some(uniform_bind_group), Some(config), Some(node_vertex_buffer), Some(node_instance_buffer), Some(edge_vertex_buffer), Some(edge_instance_buffer)) = (
            &self.device,
            &self.queue,
            &self.surface,
            &self.gradient_pipeline,
            &self.node_pipeline,
            &self.edge_pipeline,
            &self.uniform_buffer,
            &self.uniform_bind_group,
            &self.config,
            &self.node_vertex_buffer,
            &self.node_instance_buffer,
            &self.edge_vertex_buffer,
            &self.edge_instance_buffer,
        ) {
            // Validate configuration
            if config.width == 0 || config.height == 0 {
                return;
            }
            
            // Update uniforms with error handling
            let uniforms = Uniforms {
                time: time as f32,
                _padding1: 0.0,
                resolution: [config.width as f32, config.height as f32],
                color1: *color1,
                color2: *color2,
                camera_position: *camera_position,
                camera_zoom: camera_zoom,
                _padding2: 0.0,
            };
            
            queue.write_buffer(uniform_buffer, 0, bytemuck::cast_slice(&[uniforms]));

            // Get surface texture with error handling
            let output = match surface.get_current_texture() {
                Ok(texture) => texture,
                Err(_) => return, // Skip frame if surface is not ready
            };
            
            let view = output
                .texture
                .create_view(&TextureViewDescriptor::default());

            let mut encoder = device.create_command_encoder(&CommandEncoderDescriptor {
                label: Some("Render Encoder"),
            });

            {
                let mut render_pass = encoder.begin_render_pass(&RenderPassDescriptor {
                    label: Some("Render Pass"),
                    color_attachments: &[Some(RenderPassColorAttachment {
                        view: &view,
                        resolve_target: None,
                        ops: Operations {
                            load: LoadOp::Clear(Color {
                                r: 0.0,
                                g: 0.0,
                                b: 0.0,
                                a: 1.0,
                            }),
                            store: StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    occlusion_query_set: None,
                    timestamp_writes: None,
                });

                // Render background gradient if no nodes or edges
                if nodes.is_empty() && edges.is_empty() {
                    render_pass.set_pipeline(gradient_pipeline);
                    render_pass.set_bind_group(0, uniform_bind_group, &[]);
                    render_pass.draw(0..3, 0..1); // Draw a triangle
                }

                // Render edges first (behind nodes)
                if !edges.is_empty() {
                    // Check edge count limit
                    if edges.len() > MAX_EDGES {
                        console::log_1(&format!("Warning: {} edges exceeds limit of {}. Only rendering first {} edges.", 
                                               edges.len(), MAX_EDGES, MAX_EDGES).into());
                    }
                    
                    // Prepare edge instance data
                    let mut edge_instance_data = Vec::new();
                    let edges_to_render = edges.iter().take(MAX_EDGES);
                    for edge in edges_to_render {
                        edge_instance_data.extend_from_slice(&[
                            edge.x1, edge.y1,           // start position
                            edge.x2, edge.y2,           // end position
                            edge.r, edge.g, edge.b, edge.a,  // color
                            edge.width,                  // width
                        ]);
                    }

                    // Update edge instance buffer
                    if !edge_instance_data.is_empty() {
                        queue.write_buffer(
                            edge_instance_buffer,
                            0,
                            bytemuck::cast_slice(&edge_instance_data)
                        );

                        render_pass.set_pipeline(edge_pipeline);
                        render_pass.set_bind_group(0, uniform_bind_group, &[]);
                        render_pass.set_vertex_buffer(0, edge_vertex_buffer.slice(..));
                        render_pass.set_vertex_buffer(1, edge_instance_buffer.slice(..));
                        let edge_count = edges.len().min(MAX_EDGES) as u32;
                        render_pass.draw(0..6, 0..edge_count); // 6 vertices per quad, N instances
                    }
                }

                // Render nodes if any
                if !nodes.is_empty() {
                    // Check node count limit
                    if nodes.len() > MAX_NODES {
                        console::log_1(&format!("Warning: {} nodes exceeds limit of {}. Only rendering first {} nodes.", 
                                               nodes.len(), MAX_NODES, MAX_NODES).into());
                    }
                    
                    // Prepare node instance data
                    let mut instance_data = Vec::new();
                    let nodes_to_render = nodes.iter().take(MAX_NODES);
                    for node in nodes_to_render {
                        // Convert normalized coordinates (0-1) to pixel coordinates
                        let pixel_x = node.x;
                        let pixel_y = node.y;
                        
                        // Convert to NDC in the shader, just pass pixel coordinates
                        let ndc_x = (pixel_x / config.width as f32) * 2.0 - 1.0;
                        let ndc_y = 1.0 - (pixel_y / config.height as f32) * 2.0;
                        
                        instance_data.extend_from_slice(&[
                            ndc_x, ndc_y,             // position in NDC (calculated here for now)
                            node.r, node.g, node.b, node.a,  // color
                            node.size,                // size in pixels
                        ]);
                    }

                    // Update instance buffer
                    if !instance_data.is_empty() {
                        queue.write_buffer(
                            node_instance_buffer,
                            0,
                            bytemuck::cast_slice(&instance_data)
                        );

                        render_pass.set_pipeline(node_pipeline);
                        render_pass.set_bind_group(0, uniform_bind_group, &[]);
                        render_pass.set_vertex_buffer(0, node_vertex_buffer.slice(..));
                        render_pass.set_vertex_buffer(1, node_instance_buffer.slice(..));
                        let node_count = nodes.len().min(MAX_NODES) as u32;
                        render_pass.draw(0..6, 0..node_count); // 6 vertices per quad, N instances
                    }
                }
            }

            // Submit commands and present with error handling
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                queue.submit(std::iter::once(encoder.finish()));
                output.present();
            })) {
                Ok(_) => {},
                Err(_) => {
                    // Skip this frame if submission fails
                    return;
                }
            }
        }
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        if let (Some(surface), Some(device), Some(config)) =
            (&self.surface, &self.device, &mut self.config)
        {
            // Validate dimensions
            if width == 0 || height == 0 {
                return;
            }
            
            // Validate WebGPU texture size limits
            const MAX_TEXTURE_SIZE: u32 = 2048;
            if width > MAX_TEXTURE_SIZE || height > MAX_TEXTURE_SIZE {
                return;
            }
            
            config.width = width;
            config.height = height;
            
            // Configure surface with error handling
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                surface.configure(device, config);
            })) {
                Ok(_) => {},
                Err(_) => {
                    // Reset to previous valid size if configure fails
                    config.width = 800;
                    config.height = 600;
                }
            }
        }
    }
}