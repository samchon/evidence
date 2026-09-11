/** One static import binding that a local export may publish. */
export interface IEcmaScriptImport {
  localName: string;
  importedName?: string;
  specifier: string;
  typeOnly: boolean;
  namespace: boolean;
}
