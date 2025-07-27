/* tslint:disable */
/* eslint-disable */
export class FastGraphRenderer {
  free(): void;
  constructor();
  init(canvas: HTMLCanvasElement): Promise<void>;
  render(time: number): void;
  resize(width: number, height: number): void;
  set_colors(color1_r: number, color1_g: number, color1_b: number, color1_a: number, color2_r: number, color2_g: number, color2_b: number, color2_a: number): void;
  set_color1(r: number, g: number, b: number, a: number): void;
  set_color2(r: number, g: number, b: number, a: number): void;
  set_color1_hex(hex: string): void;
  set_color2_hex(hex: string): void;
  set_nodes(node_data: Float32Array): void;
  set_edges(edge_data: Float32Array): void;
  set_camera_position(x: number, y: number): void;
  set_camera_zoom(zoom: number): void;
  get_camera_position_x(): number;
  get_camera_position_y(): number;
  get_camera_zoom(): number;
  reset_camera(): void;
  get_max_nodes(): number;
  get_max_edges(): number;
  get_current_node_count(): number;
  get_current_edge_count(): number;
  integrate_physics(delta_time: number, damping_factor: number, spring_constant: number, rest_length: number, repulsion_strength: number, repulsion_radius: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_fastgraphrenderer_free: (a: number, b: number) => void;
  readonly fastgraphrenderer_new: () => number;
  readonly fastgraphrenderer_init: (a: number, b: any) => any;
  readonly fastgraphrenderer_render: (a: number, b: number) => void;
  readonly fastgraphrenderer_resize: (a: number, b: number, c: number) => void;
  readonly fastgraphrenderer_set_colors: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
  readonly fastgraphrenderer_set_color1: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly fastgraphrenderer_set_color2: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly fastgraphrenderer_set_color1_hex: (a: number, b: number, c: number) => void;
  readonly fastgraphrenderer_set_color2_hex: (a: number, b: number, c: number) => void;
  readonly fastgraphrenderer_set_nodes: (a: number, b: number, c: number) => void;
  readonly fastgraphrenderer_set_edges: (a: number, b: number, c: number) => void;
  readonly fastgraphrenderer_set_camera_position: (a: number, b: number, c: number) => void;
  readonly fastgraphrenderer_set_camera_zoom: (a: number, b: number) => void;
  readonly fastgraphrenderer_get_camera_position_x: (a: number) => number;
  readonly fastgraphrenderer_get_camera_position_y: (a: number) => number;
  readonly fastgraphrenderer_get_camera_zoom: (a: number) => number;
  readonly fastgraphrenderer_reset_camera: (a: number) => void;
  readonly fastgraphrenderer_get_max_nodes: (a: number) => number;
  readonly fastgraphrenderer_get_max_edges: (a: number) => number;
  readonly fastgraphrenderer_get_current_node_count: (a: number) => number;
  readonly fastgraphrenderer_get_current_edge_count: (a: number) => number;
  readonly fastgraphrenderer_integrate_physics: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_6: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly closure779_externref_shim: (a: number, b: number, c: any) => void;
  readonly closure2214_externref_shim: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
