/**
 * Parsed standalone request for the installed package version.
 *
 * The command reads package metadata without loading project configuration.
 * Version flags cannot be combined with another operation or its options.
 */
export interface IEvidVersionCommand {
  /**
   * Discriminator selecting installed-version output.
   *
   * Execution reports a manifest failure if package metadata cannot be read.
   */
  operation: "version";
}
