import type { ICDeclaration } from "./ICDeclaration";

/** C declarations sharing one symbol identity inside one physical source file. */
export interface ICDeclarationGroup {
  id: string;
  declarations: ICDeclaration[];
}
