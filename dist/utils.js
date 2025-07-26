/**
 * Utility functions for graph data processing and validation
 */
import { DEFAULT_NODE_COLOR, DEFAULT_NODE_SIZE, DEFAULT_EDGE_COLOR, DEFAULT_EDGE_WIDTH } from './types';
/**
 * Validates a single graph node
 */
export function validateNode(node) {
    const errors = [];
    if (!node.id || typeof node.id !== 'string') {
        errors.push('Node must have a valid string id');
    }
    if (typeof node.x !== 'number' || node.x < 0 || node.x > 1) {
        errors.push(`Node ${node.id}: x coordinate must be between 0 and 1`);
    }
    if (typeof node.y !== 'number' || node.y < 0 || node.y > 1) {
        errors.push(`Node ${node.id}: y coordinate must be between 0 and 1`);
    }
    if (node.size !== undefined && (typeof node.size !== 'number' || node.size <= 0)) {
        errors.push(`Node ${node.id}: size must be a positive number`);
    }
    if (node.color !== undefined && !isValidHexColor(node.color)) {
        errors.push(`Node ${node.id}: color must be a valid hex color`);
    }
    return errors;
}
/**
 * Validates a single graph edge
 */
export function validateEdge(edge, nodeIds) {
    const errors = [];
    if (!edge.source || typeof edge.source !== 'string') {
        errors.push('Edge must have a valid string source id');
    }
    else if (!nodeIds.has(edge.source)) {
        errors.push(`Edge source "${edge.source}" does not exist in nodes`);
    }
    if (!edge.target || typeof edge.target !== 'string') {
        errors.push('Edge must have a valid string target id');
    }
    else if (!nodeIds.has(edge.target)) {
        errors.push(`Edge target "${edge.target}" does not exist in nodes`);
    }
    if (edge.width !== undefined && (typeof edge.width !== 'number' || edge.width <= 0)) {
        errors.push(`Edge ${edge.source}->${edge.target}: width must be a positive number`);
    }
    if (edge.color !== undefined && !isValidHexColor(edge.color)) {
        errors.push(`Edge ${edge.source}->${edge.target}: color must be a valid hex color`);
    }
    return errors;
}
/**
 * Validates an entire graph data structure
 */
export function validateGraph(nodes, edges) {
    const errors = [];
    // Check for duplicate node IDs
    const nodeIds = new Set();
    const duplicateIds = new Set();
    for (const node of nodes) {
        if (nodeIds.has(node.id)) {
            duplicateIds.add(node.id);
        }
        nodeIds.add(node.id);
    }
    if (duplicateIds.size > 0) {
        errors.push(`Duplicate node IDs found: ${Array.from(duplicateIds).join(', ')}`);
    }
    // Validate individual nodes
    for (const node of nodes) {
        errors.push(...validateNode(node));
    }
    // Validate individual edges
    for (const edge of edges) {
        errors.push(...validateEdge(edge, nodeIds));
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
/**
 * Checks if a string is a valid hex color
 */
export function isValidHexColor(color) {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}|[A-Fa-f0-9]{8})$/.test(color);
}
/**
 * Converts hex color to RGBA values (0-1 range)
 */
export function hexToRgba(hex) {
    const cleanHex = hex.replace('#', '');
    let r, g, b, a = 1;
    if (cleanHex.length === 3) {
        // Short format: #RGB
        r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
        g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
        b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
    }
    else if (cleanHex.length === 6) {
        // Standard format: #RRGGBB
        r = parseInt(cleanHex.substr(0, 2), 16) / 255;
        g = parseInt(cleanHex.substr(2, 2), 16) / 255;
        b = parseInt(cleanHex.substr(4, 2), 16) / 255;
    }
    else if (cleanHex.length === 8) {
        // RGBA format: #RRGGBBAA
        r = parseInt(cleanHex.substr(0, 2), 16) / 255;
        g = parseInt(cleanHex.substr(2, 2), 16) / 255;
        b = parseInt(cleanHex.substr(4, 2), 16) / 255;
        a = parseInt(cleanHex.substr(6, 2), 16) / 255;
    }
    else {
        // Invalid format, return white
        return { r: 1, g: 1, b: 1, a: 1 };
    }
    return { r, g, b, a };
}
/**
 * Normalizes node data by applying defaults and validating ranges
 */
export function normalizeNode(node) {
    return {
        id: node.id,
        x: Math.max(0, Math.min(1, node.x)),
        y: Math.max(0, Math.min(1, node.y)),
        vx: node.vx || 0,
        vy: node.vy || 0,
        color: node.color && isValidHexColor(node.color) ? node.color : DEFAULT_NODE_COLOR,
        size: Math.max(0.1, node.size || DEFAULT_NODE_SIZE),
        label: node.label
    };
}
/**
 * Normalizes edge data by applying defaults
 */
export function normalizeEdge(edge) {
    return {
        source: edge.source,
        target: edge.target,
        color: edge.color && isValidHexColor(edge.color) ? edge.color : DEFAULT_EDGE_COLOR,
        width: Math.max(0.1, edge.width || DEFAULT_EDGE_WIDTH)
    };
}
/**
 * Converts normalized coordinates (0-1) to canvas pixel coordinates
 */
export function normalizedToCanvas(normalizedX, normalizedY, canvasWidth, canvasHeight) {
    return {
        x: normalizedX * canvasWidth,
        y: normalizedY * canvasHeight
    };
}
/**
 * Converts canvas pixel coordinates to normalized coordinates (0-1)
 */
export function canvasToNormalized(canvasX, canvasY, canvasWidth, canvasHeight) {
    return {
        x: canvasX / canvasWidth,
        y: canvasY / canvasHeight
    };
}
/**
 * Finds a node by its ID
 */
export function findNodeById(nodes, id) {
    return nodes.find(node => node.id === id);
}
/**
 * Gets all edges connected to a specific node
 */
export function getConnectedEdges(edges, nodeId) {
    return edges.filter(edge => edge.source === nodeId || edge.target === nodeId);
}
/**
 * Prepares graph data for efficient GPU rendering
 * Returns flattened arrays suitable for buffer creation
 */
export function prepareGraphDataForGPU(nodes, edges, canvasWidth, canvasHeight) {
    const normalizedNodes = nodes.map(normalizeNode);
    const normalizedEdges = edges.map(normalizeEdge);
    // Prepare node data as flat array: [x, y, r, g, b, a, size, ...]
    const nodeData = [];
    for (const node of normalizedNodes) {
        const canvasPos = normalizedToCanvas(node.x, node.y, canvasWidth, canvasHeight);
        const color = hexToRgba(node.color);
        nodeData.push(canvasPos.x, // x position
        canvasPos.y, // y position
        color.r, // red
        color.g, // green
        color.b, // blue
        color.a, // alpha
        node.size, // size/radius
        0 // padding for alignment
        );
    }
    // Prepare edge data as flat array: [x1, y1, x2, y2, r, g, b, a, width, ...]
    const edgeData = [];
    const nodeMap = new Map(normalizedNodes.map(node => [node.id, node]));
    for (const edge of normalizedEdges) {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (sourceNode && targetNode) {
            const sourcePos = normalizedToCanvas(sourceNode.x, sourceNode.y, canvasWidth, canvasHeight);
            const targetPos = normalizedToCanvas(targetNode.x, targetNode.y, canvasWidth, canvasHeight);
            const color = hexToRgba(edge.color);
            edgeData.push(sourcePos.x, // x1
            sourcePos.y, // y1
            targetPos.x, // x2
            targetPos.y, // y2
            color.r, // red
            color.g, // green
            color.b, // blue
            color.a, // alpha
            edge.width, // width
            0, 0, 0 // padding for alignment
            );
        }
    }
    return {
        nodeData: new Float32Array(nodeData),
        edgeData: new Float32Array(edgeData),
        nodeCount: normalizedNodes.length,
        edgeCount: normalizedEdges.length,
        nodeStride: 8, // 8 floats per node
        edgeStride: 12 // 12 floats per edge
    };
}
/**
 * Calculates the bounding box of all nodes
 */
export function getGraphBounds(nodes) {
    if (nodes.length === 0) {
        return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    }
    let minX = nodes[0].x;
    let minY = nodes[0].y;
    let maxX = nodes[0].x;
    let maxY = nodes[0].y;
    for (const node of nodes) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    }
    return { minX, minY, maxX, maxY };
}
// Entity count limits (must match Rust constants)
export const MAX_NODES = 100000;
export const MAX_EDGES = 200000;
/**
 * Checks if graph data exceeds rendering limits and provides warnings
 */
export function checkGraphLimits(nodes, edges, truncate = false) {
    const nodeCountExceeded = nodes.length > MAX_NODES;
    const edgeCountExceeded = edges.length > MAX_EDGES;
    const warnings = [];
    if (nodeCountExceeded) {
        warnings.push(`Node count (${nodes.length}) exceeds maximum (${MAX_NODES}). ${truncate ? `Only first ${MAX_NODES} nodes will be rendered.` : 'Consider reducing the number of nodes.'}`);
    }
    if (edgeCountExceeded) {
        warnings.push(`Edge count (${edges.length}) exceeds maximum (${MAX_EDGES}). ${truncate ? `Only first ${MAX_EDGES} edges will be rendered.` : 'Consider reducing the number of edges.'}`);
    }
    const result = {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodeCountExceeded,
        edgeCountExceeded,
        warnings
    };
    if (truncate) {
        result.truncatedNodes = nodeCountExceeded ? nodes.slice(0, MAX_NODES) : nodes;
        result.truncatedEdges = edgeCountExceeded ? edges.slice(0, MAX_EDGES) : edges;
    }
    return result;
}
/**
 * Gets performance recommendations based on graph size
 */
export function getPerformanceRecommendations(nodeCount, edgeCount) {
    const recommendations = [];
    if (nodeCount > 10000) {
        recommendations.push('Large node count detected. Consider using smaller node sizes for better performance.');
    }
    if (edgeCount > 20000) {
        recommendations.push('Large edge count detected. Consider using thinner edges for better performance.');
    }
    if (nodeCount > 50000 || edgeCount > 100000) {
        recommendations.push('Very large graph detected. Consider implementing data virtualization or level-of-detail rendering.');
    }
    const totalEntities = nodeCount + edgeCount;
    if (totalEntities > 100000) {
        recommendations.push('Consider clustering or aggregating nodes to improve performance and readability.');
    }
    return recommendations;
}
/**
 * Adds random velocity to a node for physics simulation
 */
export function addRandomVelocity(node, minSpeed = 0.01, maxSpeed = 0.05) {
    const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
    const angle = Math.random() * 2 * Math.PI;
    return {
        ...node,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
    };
}
/**
 * Updates node position based on velocity and deltaTime
 */
export function updateNodePosition(node, deltaTime) {
    if (!node.vx && !node.vy) {
        return node;
    }
    const vx = node.vx || 0;
    const vy = node.vy || 0;
    const newX = node.x + vx * deltaTime;
    const newY = node.y + vy * deltaTime;
    return {
        ...node,
        x: newX,
        y: newY,
        vx: vx,
        vy: vy
    };
}
/**
 * Applies damping/friction to node velocity
 */
export function applyDamping(node, dampingFactor = 0.99) {
    if (!node.vx && !node.vy) {
        return node;
    }
    return {
        ...node,
        vx: (node.vx || 0) * dampingFactor,
        vy: (node.vy || 0) * dampingFactor
    };
}
/**
 * Calculates spring force between two connected nodes
 */
export function calculateSpringForce(node1, node2, restLength = 0.1, springConstant = 0.01) {
    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0)
        return { fx: 0, fy: 0 };
    // Spring force: F = k * (distance - restLength)
    const force = springConstant * (distance - restLength);
    // Normalize direction and apply force
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    return { fx, fy };
}
/**
 * Applies spring forces to all nodes based on edges
 */
export function applySpringForces(nodes, edges, restLength = 0.1, springConstant = 0.01) {
    // Create a map for quick node lookup
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    // Initialize force accumulator for each node
    const forces = new Map(nodes.map(node => [node.id, { fx: 0, fy: 0 }]));
    // Calculate spring forces for each edge
    for (const edge of edges) {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (sourceNode && targetNode) {
            const springForce = calculateSpringForce(sourceNode, targetNode, restLength, springConstant);
            // Apply force to source node (toward target)
            const sourceForce = forces.get(edge.source);
            sourceForce.fx += springForce.fx;
            sourceForce.fy += springForce.fy;
            // Apply equal and opposite force to target node (toward source)
            const targetForce = forces.get(edge.target);
            targetForce.fx -= springForce.fx;
            targetForce.fy -= springForce.fy;
        }
    }
    // Apply forces to node velocities
    return nodes.map(node => {
        const force = forces.get(node.id);
        if (!force)
            return node;
        const vx = (node.vx || 0) + force.fx;
        const vy = (node.vy || 0) + force.fy;
        return {
            ...node,
            vx,
            vy
        };
    });
}
/**
 * Updates all nodes in a graph with physics simulation including spring forces
 */
export function updateGraphPhysics(nodes, edges, deltaTime, dampingFactor = 0.99, springConstant = 0.01, restLength = 0.1) {
    // Apply spring forces
    let updatedNodes = applySpringForces(nodes, edges, restLength, springConstant);
    // Update positions and apply damping
    updatedNodes = updatedNodes.map(node => {
        let updatedNode = updateNodePosition(node, deltaTime);
        updatedNode = applyDamping(updatedNode, dampingFactor);
        return updatedNode;
    });
    return updatedNodes;
}
