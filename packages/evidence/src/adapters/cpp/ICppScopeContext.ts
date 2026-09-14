import type { CppScopeKind } from "./CppScopeKind";

/** Carries the enclosing C++ structural scope while `CppFileScanner` descends through declarations.
 *
 * The scanner derives child identities, public addresses, and visibility from this context. It represents a source-level namespace, record, or enum owner rather than a fully materialized Evidence unit.
 */
export interface ICppScopeContext {
  /** Scanner-local declaration record for this scope when it materializes a declaration.
   *
   * Omission denotes a namespace scope, which contributes paths and visibility but has no declaration record of its own.
   */
  declarationId?: string;

  /** Semantic path used to identify child declarations beneath this owner.
   *
   * The scanner prefixes unqualified child names with this path and uses it to resolve qualified definitions relative to a record or namespace.
   */
  identity: string[];

  /** Public accessor path available through this owner.
   *
   * Child declarations inherit this path when the scope is public; it remains distinct from `identity` because aliases can change public spelling.
   */
  address: string[];

  /** Source construct that establishes this scope.
   *
   * The scanner uses the kind to apply C++ ownership rules, including namespace qualification and record member visibility.
   */
  kind: CppScopeKind;

  /** Unqualified source spelling of the scope owner.
   *
   * It supports diagnostics and declaration construction while `identity` retains the complete enclosing path.
   */
  name: string;

  /** Whether declarations directly contained by this scope can be publicly published.
   *
   * The scanner combines this inherited boundary with member access before emitting a declaration's visibility.
   */
  public: boolean;
}
