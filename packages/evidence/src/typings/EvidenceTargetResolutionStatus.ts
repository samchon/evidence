/** Outcome of resolving one authored file-qualified target. */
export type EvidenceTargetResolutionStatus =
  | "resolved"
  | "ambiguous"
  | "hidden"
  | "malformed"
  | "missing-file"
  | "missing-member"
  | "out-of-population"
  | "unsupported-host"
  | "incomplete";
