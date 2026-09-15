/**
 * Declaration state inherited while the scanner walks a statement list.
 *
 * Namespace recursion extends this context so nested units preserve semantic
 * ownership and public address paths while declaration modifiers continue to
 * govern their visibility and type-space eligibility.
 */
export interface IEvidenceEcmaScriptStatementContext {
  /**
   * Literal semantic identity segments inherited from enclosing namespaces.
   *
   * Each discovered declaration appends its own name to form the unit identity
   * and structural ownership chain.
   */
  semanticPrefix: string[];

  /**
   * Public-address segments inherited below the root binding.
   *
   * Nested declarations append their names here so published addresses retain
   * namespace and member structure after the root export name.
   */
  publicPrefix: string[];

  /**
   * Outermost local binding that owns nested declarations.
   *
   * Omission at file scope makes each declaration its own root; namespace scans
   * set it so their contents publish through the enclosing binding.
   */
  root?: string;

  /**
   * Evidence unit ID of the direct enclosing declaration.
   *
   * Omission denotes a root unit. Nested scanner calls pass this ID so
   * inventory structure follows language containment instead of public path
   * spelling.
   */
  parentId?: string;

  /**
   * Whether enclosing syntax declares an ambient TypeScript context.
   *
   * Ambient declarations are treated as exportable while visibility is being
   * calculated because their module contract is declared rather than executed.
   */
  ambient: boolean;

  /**
   * Whether declarations in this context can produce supported units.
   *
   * Nested declarations require their enclosing namespace to be visible and to
   * use an export modifier; file-scope declarations begin visible.
   */
  visible: boolean;

  /**
   * Whether enclosing export syntax restricts declarations to the type space.
   *
   * Functions and variables stop scanning under this flag, while TypeScript
   * type declarations retain the restriction for later export resolution.
   */
  typeOnly: boolean;
}
