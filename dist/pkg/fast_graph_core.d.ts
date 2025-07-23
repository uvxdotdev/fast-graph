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
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_6: WebAssembly.Table;
  readonly closure748_externref_shim: (a: number, b: number, c: any) => void;
  readonly closure2182_externref_shim: (a: number, b: number, c: any, d: any) => void;
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
