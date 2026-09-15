import type { EvidencePythonAllState } from "./EvidencePythonAllState";

/**
 * Records the statically known portion of a module's `__all__` declaration.
 *
 * EvidencePythonExportResolver uses this state to choose between explicit
 * exports and Python's underscore convention. Dynamic mutation stays incomplete
 * because executing module code would make coverage depend on runtime state.
 */
export interface IEvidencePythonAll {
  /**
   * Whether `__all__` is absent, fully static, or changed dynamically.
   *
   * A dynamic state suppresses inference from arbitrary runtime mutations while
   * allowing the scanner to retain the failure diagnostic.
   */
  state: EvidencePythonAllState;

  /**
   * Export names recovered from supported literal assignment and concatenation.
   *
   * The array preserves declaration order; the resolver later converts it to a
   * set when it combines explicit exports with imported bindings.
   */
  names: string[];
}
