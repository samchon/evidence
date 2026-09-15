/**
 * Static export spellings understood by the ECMAScript module resolver.
 *
 * The scanner assigns one of these forms to every supported export edge so the
 * resolver can distinguish local bindings, named re-exports, namespaces, and
 * stars.
 */
export type EvidEcmaScriptExportKind = "local" | "named" | "namespace" | "star";
