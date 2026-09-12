/** Failures that must stop adapter extraction rather than yield an empty inventory. */
export type EvidenceParserErrorCode =
  | "unsupported-language"
  | "unsupported-extension"
  | "asset-manifest"
  | "asset-missing"
  | "asset-corrupt"
  | "runtime-initialization"
  | "grammar-incompatible"
  | "parse-failed"
  | "parse-incomplete"
  | "query-invalid"
  | "query-incomplete"
  | "session-closed";
