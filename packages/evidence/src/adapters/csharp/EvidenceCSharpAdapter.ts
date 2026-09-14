import { CSharpAdapter } from "./CSharpAdapter";

/**
 * Extracts C# source-public declarations within one configured snapshot.
 *
 * The implementation reconciles supported partial declarations and preserves
 * attached XML documentation across their physical sites. Public addresses use
 * namespace and owner segments, with literal spelling for generic arity, indexers,
 * and operators rather than flattening those forms into ordinary identifiers.
 *
 * Conditional compilation, explicit interface implementation units, source
 * generators, inherited members, and generated record members are outside this
 * source boundary. Complete syntax alone does not establish their public inventory.
 */
export class EvidenceCSharpAdapter extends CSharpAdapter {}
