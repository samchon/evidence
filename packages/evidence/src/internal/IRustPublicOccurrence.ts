import type { IRustExportRecord } from "./IRustExportRecord";
import type { IRustFilePlacement } from "./IRustFilePlacement";
import type { IRustLocatedDeclaration } from "./IRustLocatedDeclaration";

/** One externally reachable Rust declaration path from a selected crate root. */
export interface IRustPublicOccurrence {
  located: IRustLocatedDeclaration;
  exported: IRustExportRecord;
  namespaceCarrier: IRustFilePlacement;
  publicPath: string[];
}
