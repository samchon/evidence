import type { PythonAllState } from "./PythonAllState";

/** Names recovered from supported top-level __all__ initialization. */
export interface IPythonAll {
  state: PythonAllState;
  names: string[];
}
