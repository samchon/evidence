import type { PythonBindingKind } from "./PythonBindingKind";

/** One source-ordered module binding used by static export resolution. */
export interface IPythonBinding {
  kind: PythonBindingKind;
  order: number;
  localName?: string;
  /** Declaration root selected by a local binding; absent for imports. */
  root?: string;
  importedName?: string;
  specifier?: string;
}
