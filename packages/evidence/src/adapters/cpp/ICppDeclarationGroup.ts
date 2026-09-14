import type { ICppDeclaration } from "./ICppDeclaration";

/** C++ declarations sharing one qualified symbol identity in the snapshot. */
export interface ICppDeclarationGroup {
  id: string;
  declarations: ICppDeclaration[];
}
