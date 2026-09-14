import type { IEcmaScriptBinding } from "./IEcmaScriptBinding";

/** Static bindings and the reasons an exported name may have no supported unit. */
export interface IEcmaScriptResolution {
  bindings: IEcmaScriptBinding[];
  excluded: boolean;
  cyclic: boolean;
}
