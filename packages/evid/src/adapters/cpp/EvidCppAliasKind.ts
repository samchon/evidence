/**
 * Identifies a C++ declaration that projects another unit into a local address.
 *
 * The scanner distinguishes namespace aliases from using declarations because
 * each resolves its target and contributes public address segments
 * differently.
 */
export type EvidCppAliasKind = "namespace" | "using";
