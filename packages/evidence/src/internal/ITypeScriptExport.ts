import type { TypeScriptExportKind } from "./TypeScriptExportKind";

/** One local or module-qualified TypeScript export edge. */
export interface ITypeScriptExport {
  kind: TypeScriptExportKind;
  publicName?: string;
  localName?: string;
  importedName?: string;
  specifier?: string;
  typeOnly: boolean;
}
