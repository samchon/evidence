import type { ITtsxExecutables } from "./ITtsxExecutables";

/** Package metadata required to locate the consumer's ttsx launcher. */
export interface ITtsxManifest {
  bin: ITtsxExecutables;
}
