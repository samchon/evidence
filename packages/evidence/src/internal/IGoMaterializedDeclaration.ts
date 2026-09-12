import type { IGoDeclaration } from "./IGoDeclaration";
import type { IGoFileAnalysis } from "./IGoFileAnalysis";

/** A Go source declaration assigned to its package-wide semantic unit. */
export interface IGoMaterializedDeclaration {
  analysis: IGoFileAnalysis;
  declaration: IGoDeclaration;
  unitId: string;
}
