use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, console};
use wgpu::*;
use crate::{NodeData, EdgeData};

// Buffer size limits - can handle large graphs
pub const MAX_NODES: usize = 100_000;
pub const MAX_EDGES: usize = 200_000;
const FLOATS_PER_NODE: usize = 7;  // x, y, r, g, b, a, size
const FLOATS_PER_EDGE: usize = 9;  // x1, y1, x2, y2, r, g, b, a, width

pub struct Renderer {
    device: Option<Device>,
    queue: Option<Queue>,
    surface: Option<Surface<'static>>,
    config: Option<SurfaceConfiguration>,
    gradient_pipeline: Option<RenderPipeline>,
    node_pipeline: Option<RenderPipeline>,
    edge_pipeline: Option<RenderPipeline>,
    canvas: Option<HtmlCanvasElement>,
    uniform_buffer: Option<Buffer>,
    uniform_bind_group: Option<BindGroup>,
    node_vertex_buffer: Option<Buffer>,
    node_instance_buffer: Option<Buffer>,
    edge_vertex_buffer: Option<Buffer>,
    edge_instance_buffer: Option<Buffer>,
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
            canvas: None,
            uniform_buffer: None,
            uniform_bind_group: None,
            node_vertex_buffer: None,
            node_instance_buffer: None,
            edge_vertex_buffer: None,
            edge_instance_buffer: None,
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

        // Get device and queue
        let (device, queue) = adapter
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
            .map_err(|e| JsValue::from_str(&format!("Failed to create device: {:?}", e)))?;

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
        self.canvas = Some(canvas.clone());
        self.uniform_buffer = Some(uniform_buffer);
        self.uniform_bind_group = Some(uniform_bind_group);
        self.node_vertex_buffer = Some(node_vertex_buffer);
        self.node_instance_buffer = Some(node_instance_buffer);
        self.edge_vertex_buffer = Some(edge_vertex_buffer);
        self.edge_instance_buffer = Some(edge_instance_buffer);

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