use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;
use wgpu::*;

pub struct Renderer {
    device: Option<Device>,
    queue: Option<Queue>,
    surface: Option<Surface<'static>>,
    config: Option<SurfaceConfiguration>,
    render_pipeline: Option<RenderPipeline>,
    canvas: Option<HtmlCanvasElement>,
    uniform_buffer: Option<Buffer>,
    uniform_bind_group: Option<BindGroup>,
}

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct Uniforms {
    time: f32,
    _padding1: f32,
    resolution: [f32; 2],
    color1: [f32; 4],
    color2: [f32; 4],
}

impl Renderer {
    pub fn new() -> Self {
        Self {
            device: None,
            queue: None,
            surface: None,
            config: None,
            render_pipeline: None,
            canvas: None,
            uniform_buffer: None,
            uniform_bind_group: None,
        }
    }

    pub async fn init(&mut self, canvas: &HtmlCanvasElement) -> Result<(), JsValue> {
        let width = canvas.width();
        let height = canvas.height();
        
        // Validate canvas dimensions
        if width == 0 || height == 0 {
            return Err(JsValue::from_str("Canvas has invalid dimensions"));
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
                visibility: ShaderStages::FRAGMENT,
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
        };
        queue.write_buffer(&uniform_buffer, 0, bytemuck::cast_slice(&[initial_uniforms]));

        // Create render pipeline
        let render_pipeline = self.create_render_pipeline(&device, config.format, &uniform_bind_group_layout);

        self.device = Some(device);
        self.queue = Some(queue);
        self.surface = Some(surface);
        self.config = Some(config);
        self.render_pipeline = Some(render_pipeline);
        self.canvas = Some(canvas.clone());
        self.uniform_buffer = Some(uniform_buffer);
        self.uniform_bind_group = Some(uniform_bind_group);

        Ok(())
    }

    fn create_render_pipeline(&self, device: &Device, format: TextureFormat, uniform_bind_group_layout: &BindGroupLayout) -> RenderPipeline {
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
            label: Some("Render Pipeline"),
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

    pub fn render(&mut self, time: f64, color1: &[f32; 4], color2: &[f32; 4]) {
        if let (Some(device), Some(queue), Some(surface), Some(render_pipeline), Some(uniform_buffer), Some(uniform_bind_group), Some(config)) = (
            &self.device,
            &self.queue,
            &self.surface,
            &self.render_pipeline,
            &self.uniform_buffer,
            &self.uniform_bind_group,
            &self.config,
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

                render_pass.set_pipeline(render_pipeline);
                render_pass.set_bind_group(0, uniform_bind_group, &[]);
                render_pass.draw(0..3, 0..1); // Draw a triangle
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