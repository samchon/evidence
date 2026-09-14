import type { IRustDeclaration } from "./IRustDeclaration";
import type { IRustFilePlacement } from "./IRustFilePlacement";

/** One public module binding and the source position that exposes its alias. */
export interface IRustExportRecord {
  name: string;
  declaration: IRustDeclaration;
  carrier: IRustFilePlacement;
}
