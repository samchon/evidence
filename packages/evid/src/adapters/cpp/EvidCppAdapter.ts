import { EvidCppAdapterBase } from "./EvidCppAdapterBase";

/**
 * Extracts explicit C++ public declarations and bounded aliases across a
 * snapshot.
 *
 * Analysis reconciles namespaces, types, callable families, qualified
 * definitions, templates, and public members from selected source.
 * File-qualified addresses retain template arity and operator names as literal
 * segments, and attached Doxygen supplies the documentation hosts used by graph
 * policies.
 *
 * This is declared-source analysis: it does not expand macros, traverse
 * includes, instantiate or specialize templates, perform inherited or friend
 * lookup, or evaluate module and linker visibility. Such public-surface
 * dependencies cannot be silently treated as absent declarations.
 */
export class EvidCppAdapter extends EvidCppAdapterBase {}
