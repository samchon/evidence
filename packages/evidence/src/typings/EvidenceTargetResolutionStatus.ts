/** Outcome category for resolving one authored file-qualified target.
 *
 * `resolved` identifies one visible unit. Every other value explains why the
 * target cannot satisfy a reference, including semantic ambiguity, a boundary
 * violation, or incomplete discovery. Callers preserve this distinction in
 * diagnostics instead of collapsing all failures into a missing member.
 */
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
