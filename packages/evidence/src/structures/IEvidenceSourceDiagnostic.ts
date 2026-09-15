/**
 * Filesystem discovery failure retained in a source snapshot.
 *
 * A failed read, unstable source, or unresolved path boundary prevents the
 * loader from certifying a complete population. Adapters can preserve this
 * failure when producing graph diagnostics instead of silently omitting the
 * affected file.
 */
export interface IEvidenceSourceDiagnostic {
  /**
   * Stable category of the failed discovery operation.
   *
   * Callers can distinguish access, spelling, encoding, and
   * snapshot-consistency failures without interpreting platform-specific
   * message text.
   */
  code:
    | "root-unreadable"
    | "path-unreadable"
    | "case-mismatch"
    | "symlink-cycle"
    | "not-file"
    | "invalid-encoding"
    | "source-changed";

  /**
   * Absolute logical path involved in the failure.
   *
   * This retains the author-visible address even when its physical target could
   * not be read or resolved.
   */
  path: string;

  /**
   * Explanation of the cause and affected discovery operation.
   *
   * Concrete filesystem details complement the stable category when diagnosing
   * permission failures, changing files, or invalid source contents.
   */
  message: string;
}
