import type { IRustDeclaration } from "./IRustDeclaration";
import type { IRustFilePlacement } from "./IRustFilePlacement";
import type { IRustModuleRecord } from "./IRustModuleRecord";

/** One Rust declaration assigned to a crate, module, source file, and identity. */
export interface IRustLocatedDeclaration {
  declaration: IRustDeclaration;
  placement: IRustFilePlacement;
  module: IRustModuleRecord;
  identity: string[];
}
