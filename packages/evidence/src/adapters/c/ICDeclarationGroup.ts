import type { ICDeclaration } from "./ICDeclaration";

/**
 * Collects C declarations that claim one file-local semantic identity.
 *
 * The C adapter deliberately limits this group to one physical source file:
 * equal names in separate translation units do not prove C linkage equivalence.
 * Materialization uses the members to detect incompatible forms and duplicate
 * definitions before it publishes a single Evidence unit.
 */
export interface ICDeclarationGroup {
  /** File-qualified identifier shared by every member of the group. */
  id: string;

  /** Declarations whose forms and definitions must be mutually compatible. */
  declarations: ICDeclaration[];
}
