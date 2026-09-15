import type { EvidRubyContainerKind } from "./EvidRubyContainerKind";
import type { EvidRubyMethodSide } from "./EvidRubyMethodSide";
import type { EvidRubyScopeKind } from "./EvidRubyScopeKind";
import type { EvidRubyVisibility } from "./EvidRubyVisibility";

/**
 * Carries mutable lexical state while scanning one Ruby scope.
 *
 * EvidRubyFileScanner updates this record as visibility and `module_function` change,
 * so members receive the state in effect at their own source position.
 */
export interface IEvidRubyScopeContext {
  /**
   * Kind of lexical body that owns declarations scanned through this context.
   *
   * It determines which Ruby constructs can introduce members or alter visibility.
   */
  kind: EvidRubyScopeKind;

  /**
   * Semantic constant path for declarations nested in this scope.
   *
   * Reopened bodies with the same path later merge into one identity.
   */
  identity: string[];

  /**
   * Receiver side assigned to methods declared in the current body.
   *
   * It separates instance and singleton method addresses under the same owner.
   */
  side: EvidRubyMethodSide;

  /**
   * Visibility currently inherited by newly scanned declarations.
   *
   * Visibility modifiers mutate this value only for following members.
   */
  visibility: EvidRubyVisibility;

  /**
   * Whether module-function mode duplicates eligible instance methods as module APIs.
   *
   * The scanner records both resulting surfaces so later publication can reconcile them.
   */
  moduleFunction: boolean;

  /**
   * Nominal container form when this scope belongs to a class or module.
   *
   * Omission denotes top-level or singleton contexts that cannot be reopened as a type.
   */
  containerKind?: EvidRubyContainerKind;
}
