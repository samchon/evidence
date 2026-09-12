/** Ownership and visibility inherited while walking TypeScript statement lists. */
export interface ITypeScriptStatementContext {
  semanticPrefix: string[];
  publicPrefix: string[];
  root?: string;
  parentId?: string;
  ambient: boolean;
  visible: boolean;
  typeOnly: boolean;
}
