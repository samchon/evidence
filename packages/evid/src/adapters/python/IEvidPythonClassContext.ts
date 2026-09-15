/**
 * Carries the structural ownership needed while scanning one Python class body.
 *
 * Nested functions and properties inherit these segments to keep their unit IDs
 * stable, while exported addresses can still distinguish a class member from an
 * instance member through the suffix selected by the scanner.
 */
export interface IEvidPythonClassContext {
  /**
   * Full semantic path used to construct child unit identities.
   *
   * Every element names one enclosing declaration, in source nesting order.
   */
  identity: string[];

  /**
   * Public-address segments preceding a member declared in this class.
   *
   * The scanner appends a member's own segments without using this path as its
   * semantic identity, because aliases may publish that identity elsewhere.
   */
  suffix: string[];

  /**
   * Module-level root binding under which this class is declared.
   *
   * Export resolution associates the root with a local binding before it emits
   * public file-qualified addresses.
   */
  root: string;

  /**
   * Unit ID of the enclosing class declaration.
   *
   * Members use this parent so ancestor withdrawal directives hide the complete
   * class surface during documentation materialization.
   */
  parentId: string;
}
