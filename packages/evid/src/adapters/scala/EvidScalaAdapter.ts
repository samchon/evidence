import { EvidScalaAdapterBase } from "./EvidScalaAdapterBase";

/**
 * Extracts explicit unrestricted Scala declarations and supported static exports.
 *
 * Selected Scala 2/3 source supplies package and lexical ownership. Singleton
 * objects and package objects retain explicit literal owner segments, and attached
 * Scaladoc supplies evidence hosts. Supported export projections preserve the
 * defining declaration's identity rather than duplicating its coverage unit.
 *
 * Anonymous givens, wildcard or unresolved exports, inherited or synthesized
 * members, macro expansion, derives/uses clauses, and extractor bindings are not
 * inferred as a complete source-public population.
 */
export class EvidScalaAdapter extends EvidScalaAdapterBase {}
