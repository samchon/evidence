import type { ITypeScriptBinding } from "./ITypeScriptBinding";

/** Static bindings and the reasons an exported name may have no supported unit. */
export interface ITypeScriptResolution {
  bindings: ITypeScriptBinding[];
  excluded: boolean;
  cyclic: boolean;
}
