/**
 * Classifies the entity introduced by the innermost effective C++ declarator.
 *
 * Declarator unwrapping uses this distinction to separate callable declarations
 * from objects without attempting to model the complete C++ type expression.
 */
export type EvidenceCppDeclaratorKind = "direct" | "function" | "object";
