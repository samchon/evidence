/**
 * Installed evidence package manifest fields required by the version command.
 *
 * `EvidenceCommand` validates this narrow projection before reporting its own
 * package version, keeping malformed installed metadata an actionable command
 * failure instead of loading project configuration.
 */
export interface IEvidencePackageManifest {
  /**
   * Published package version presented by the command.
   *
   * This value comes from the installed package manifest and is returned as the
   * version command's output rather than being derived from the running
   * project.
   */
  version: string;
}
