/** Ownership and visibility inherited while walking declaration lists. */
export interface IEcmaScriptStatementContext {
  semanticPrefix: string[];
  publicPrefix: string[];
  root?: string;
  parentId?: string;
  ambient: boolean;
  visible: boolean;
  typeOnly: boolean;
}
