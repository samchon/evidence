import type { IPythonResolvedBinding } from "./IPythonResolvedBinding";

/** Static result for one Python module attribute lookup. */
export interface IPythonResolution {
  bindings: IPythonResolvedBinding[];
  cyclic: boolean;
}
