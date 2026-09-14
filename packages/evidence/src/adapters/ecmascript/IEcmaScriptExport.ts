import type { EcmaScriptExportKind } from "./EcmaScriptExportKind";

/** One local or module-qualified ECMAScript export edge. */
export interface IEcmaScriptExport {
  kind: EcmaScriptExportKind;
  publicName?: string;
  localName?: string;
  importedName?: string;
  specifier?: string;
  typeOnly: boolean;
}
