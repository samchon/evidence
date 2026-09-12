import type { ICSharpDeclaration } from "./ICSharpDeclaration";

/** Declarations sharing one C# symbol identity within a source snapshot. */
export interface ICSharpDeclarationGroup {
  id: string;
  declarations: ICSharpDeclaration[];
}
