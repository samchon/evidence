/**
 * Stable categories for failures that invalidate adapter extraction.
 *
 * Parser failures never quietly become an empty inventory: callers retain the
 * category in diagnostics so an unavailable asset, malformed query, incomplete
 * parse, or closed session cannot reduce the coverage denominator. The codes
 * separate remediation of cache/runtime problems from source and query issues.
 */
export type EvidenceParserErrorCode =
  | "unsupported-language"
  | "unsupported-extension"
  | "asset-manifest"
  | "asset-missing"
  | "asset-corrupt"
  | "asset-download"
  | "asset-cache"
  | "asset-cancelled"
  | "runtime-initialization"
  | "grammar-incompatible"
  | "parse-failed"
  | "parse-incomplete"
  | "query-invalid"
  | "query-incomplete"
  | "session-closed";
