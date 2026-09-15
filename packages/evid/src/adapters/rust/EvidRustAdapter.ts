import { EvidRustAdapterBase } from "./EvidRustAdapterBase";

/**
 * Extracts selected Rust crate modules, public re-exports, and local implementation members.
 *
 * Module placement and use resolution establish public paths before documentation
 * is materialized. Outer or inner documentation and supported static doc attributes
 * retain their physical attachment. Trait implementation paths carry an explicit
 * literal implementation segment so different owners are not merged by method name.
 *
 * Cargo feature evaluation, macro expansion, custom module paths, and ownership
 * of external types are outside the adapter boundary. Generated declarations
 * must be present in selected source rather than inferred by executing a build.
 */
export class EvidRustAdapter extends EvidRustAdapterBase {}
