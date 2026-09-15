/**
 * Identifies a C++ declaration owner that establishes structural graph scope.
 *
 * Nested scanning carries this kind with the scope path to determine member
 * ownership and the public address shape of declarations it contains.
 */
export type EvidCppScopeKind = "namespace" | "class" | "struct" | "union" | "enum";
