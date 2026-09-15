import type { EvidCSharpTypeKind } from "./EvidCSharpTypeKind";
import type { IEvidCSharpDeclarationAddress } from "./IEvidCSharpDeclarationAddress";

/**
 * Carries the enclosing C# type state while the scanner traverses nested
 * declarations.
 *
 * EvidCSharpFileScanner creates this context for each type and passes it to
 * member and nested-type scans. It keeps structural ownership, semantic
 * identity, and public address candidates aligned without repeatedly deriving
 * them from syntax.
 */
export interface IEvidCSharpTypeContext {
  /**
   * Identifies the scanner-local declaration record for the enclosing type.
   *
   * Nested declarations store this value as their ownerDeclarationId so later
   * materialization can preserve parent units and resolve public visibility.
   */
  declarationId: string;

  /**
   * Supplies the semantic path that nested declarations extend.
   *
   * The scanner appends each nested declaration name to this canonical
   * identity. It remains separate from public addresses because aliases may
   * expose other valid access paths.
   */
  identity: string[];

  /**
   * Supplies the public address candidates that nested declarations extend.
   *
   * Member scanning appends its name to every candidate while preserving
   * canonical and alias-prefix provenance. Partial types can therefore
   * contribute more than one valid public prefix.
   */
  addresses: IEvidCSharpDeclarationAddress[];

  /**
   * Classifies the enclosing type form for nested-member scanning.
   *
   * The scanner uses this value to apply interface-specific implicit-public
   * semantics without reinterpreting the enclosing type's syntax for each
   * member.
   */
  kind: EvidCSharpTypeKind;
}
