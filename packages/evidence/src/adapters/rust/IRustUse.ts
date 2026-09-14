import type { IRustUseBinding } from "./IRustUseBinding";

/** One unrestricted public Rust use declaration and its expanded bindings. */
export interface IRustUse {
  id: string;
  modulePath: string[];
  bindings: IRustUseBinding[];
  siteId: string;
}
