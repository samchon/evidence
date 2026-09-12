/** A discovery failure that prevents treating the population as complete. */
export interface IEvidenceSourceDiagnostic {
  /** Stable category for callers; messages retain the concrete filesystem cause. */
  code:
    | "root-unreadable"
    | "path-unreadable"
    | "case-mismatch"
    | "symlink-cycle"
    | "not-file"
    | "invalid-encoding"
    | "source-changed";

  /** Absolute logical path that the author can inspect or correct. */
  path: string;

  /** Failure cause and the affected discovery operation. */
  message: string;
}
