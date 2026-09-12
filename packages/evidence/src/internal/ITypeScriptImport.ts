/** One static TypeScript import binding that a local export may publish. */
export interface ITypeScriptImport {
  localName: string;
  importedName?: string;
  specifier: string;
  typeOnly: boolean;
  namespace: boolean;
}
