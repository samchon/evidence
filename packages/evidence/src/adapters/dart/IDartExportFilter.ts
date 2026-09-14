/** One Dart export combinator applied in source order. */
export interface IDartExportFilter {
  /** Whether the listed names remain or are removed. */
  kind: "show" | "hide";

  /** Literal top-level declaration names. */
  names: string[];
}
