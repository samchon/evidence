import type { IRustDeclaration } from "./IRustDeclaration";
import type { IRustFilePlacement } from "./IRustFilePlacement";
import type { IRustUse } from "./IRustUse";

/** One inline or file-backed Rust module in a selected crate graph. */
export interface IRustModuleRecord {
  key: string;
  rootKey: string;
  path: string[];
  localPath: string[];
  placement: IRustFilePlacement;
  declaration?: IRustDeclaration;
  bindings: Map<string, IRustDeclaration[]>;
  uses: IRustUse[];
}
