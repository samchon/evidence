import type { IScalaDeclaration } from "./IScalaDeclaration";

/** An explicitly named forwarding declaration awaiting its source member. */
export interface IScalaExport {
  /** Placeholder forwarding declaration, retaining its own host and site. */
  declaration: IScalaDeclaration;
  /** Lexical paths at which to look up the source singleton object. */
  paths: string[][];
  /** Literal member name requested by this export. */
  member: string;
}
