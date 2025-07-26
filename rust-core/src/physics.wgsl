// WebGPU Compute Shader for Physics Simulation
// Handles spring forces, repulsion forces, and position updates

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

@group(0) @binding(0) var<storage, read_write> nodes: array<NodeData>;
@group(0) @binding(1) var<storage, read> edges: array<EdgeData>;
@group(0) @binding(2) var<uniform> params: PhysicsParams;

// Calculate distance between two points
fn distance(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    let dx = x2 - x1;
    let dy = y2 - y1;
    return sqrt(dx * dx + dy * dy);
}

// Calculate spring force between two nodes
fn calculate_spring_force(node_a: NodeData, node_b: NodeData) -> vec2<f32> {
    let dx = node_b.x - node_a.x;
    let dy = node_b.y - node_a.y;
    let dist = sqrt(dx * dx + dy * dy);
    
    if (dist < 0.001) {
        return vec2<f32>(0.0, 0.0);
    }
    
    // Spring force: F = k * (distance - rest_length)
    let force_magnitude = params.spring_constant * (dist - params.rest_length);
    
    // Normalize direction
    let nx = dx / dist;
    let ny = dy / dist;
    
    return vec2<f32>(nx * force_magnitude, ny * force_magnitude);
}

// Calculate repulsion force between two nodes
fn calculate_repulsion_force(node_a: NodeData, node_b: NodeData) -> vec2<f32> {
    let dx = node_b.x - node_a.x;
    let dy = node_b.y - node_a.y;
    let dist = sqrt(dx * dx + dy * dy);
    
    // Skip if too far away (performance optimization)
    if (dist > params.repulsion_radius || dist < 0.001) {
        return vec2<f32>(0.0, 0.0);
    }
    
    // Inverse square law with minimum distance to prevent explosion
    let min_dist = max(dist, 0.01);
    let force_magnitude = params.repulsion_strength / (min_dist * min_dist);
    
    // Normalize direction (repulsive, so opposite direction)
    let nx = -dx / dist;
    let ny = -dy / dist;
    
    return vec2<f32>(nx * force_magnitude, ny * force_magnitude);
}

// Check if an edge connects to the given node index
fn edge_connects_to_node(edge: EdgeData, node_index: u32) -> bool {
    // Note: We need to match edges by position since we don't store indices directly
    // This is a simplified approach - in practice you'd want edge indices
    let node = nodes[node_index];
    let epsilon = 0.001;
    
    let matches_source = abs(edge.x1 - node.x) < epsilon && abs(edge.y1 - node.y) < epsilon;
    let matches_target = abs(edge.x2 - node.x) < epsilon && abs(edge.y2 - node.y) < epsilon;
    
    return matches_source || matches_target;
}

// Get the other node connected by an edge
fn get_connected_node_position(edge: EdgeData, node: NodeData) -> vec2<f32> {
    let epsilon = 0.001;
    let matches_source = abs(edge.x1 - node.x) < epsilon && abs(edge.y1 - node.y) < epsilon;
    
    if (matches_source) {
        return vec2<f32>(edge.x2, edge.y2);
    } else {
        return vec2<f32>(edge.x1, edge.y1);
    }
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    
    // Bounds check
    if (index >= params.node_count) {
        return;
    }
    
    var node = nodes[index];
    var total_force = vec2<f32>(0.0, 0.0);
    
    // Calculate spring forces from connected edges
    for (var i = 0u; i < params.edge_count; i++) {
        let edge = edges[i];
        
        if (edge_connects_to_node(edge, index)) {
            let connected_pos = get_connected_node_position(edge, node);
            
            // Create temporary node for force calculation
            var connected_node: NodeData;
            connected_node.x = connected_pos.x;
            connected_node.y = connected_pos.y;
            
            let spring_force = calculate_spring_force(node, connected_node);
            total_force += spring_force;
        }
    }
    
    // Calculate repulsion forces from all other nodes
    for (var i = 0u; i < params.node_count; i++) {
        if (i != index) {
            let other_node = nodes[i];
            let repulsion_force = calculate_repulsion_force(node, other_node);
            total_force -= repulsion_force; // Subtract because we want to repel
        }
    }
    
    // Update velocity with forces
    let acceleration = total_force / node.mass;
    node.vx += acceleration.x * params.delta_time;
    node.vy += acceleration.y * params.delta_time;
    
    // Apply damping
    node.vx *= params.damping_factor;
    node.vy *= params.damping_factor;
    
    // Update position
    node.x += node.vx * params.delta_time;
    node.y += node.vy * params.delta_time;
    
    // Store updated forces for debugging/visualization
    node.fx = total_force.x;
    node.fy = total_force.y;
    
    // Write back to buffer
    nodes[index] = node;
}