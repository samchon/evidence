/** A Python declaration root or module namespace reached through imports. */
export interface IPythonResolvedBinding {
  sourceId: string;
  root?: string;
}
