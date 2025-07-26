import React from 'react';
import { GraphNode, GraphEdge } from './types';
export interface FastGraphProps {
    /** Array of graph nodes to render */
    nodes?: GraphNode[];
    /** Array of graph edges to render */
    edges?: GraphEdge[];
    /** Background gradient color 1 (fallback to gradient mode if no nodes) */
    color1?: string;
    /** Background gradient color 2 (fallback to gradient mode if no nodes) */
    color2?: string;
    /** Canvas width in pixels */
    width?: number;
    /** Canvas height in pixels */
    height?: number;
    /** CSS class name for the canvas element */
    className?: string;
    /** React CSS properties for styling */
    style?: React.CSSProperties;
}
export declare const FastGraph: React.FC<FastGraphProps>;
export default FastGraph;
//# sourceMappingURL=FastGraph.d.ts.map