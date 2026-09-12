import type { IRustLocatedDeclaration } from "./IRustLocatedDeclaration";

/** One Rust impl member assigned to a selected local nominal owner. */
export interface IRustResolvedMember {
  declaration: IRustLocatedDeclaration;
  owner: IRustLocatedDeclaration;
  qualifier?: string;
  localTraitId?: string;
}
