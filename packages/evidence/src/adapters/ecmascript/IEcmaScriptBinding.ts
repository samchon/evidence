/** One declaration binding or namespace reached through a public module name. */
export interface IEcmaScriptBinding {
  sourceId: string;
  localName?: string;
  typeOnly: boolean;
}
