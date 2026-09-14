/**
 * Parsed request to display command syntax and options.
 *
 * Help is resolved before configuration or project analysis. The parser refuses
 * combining the help flag with other options instead of silently ignoring them.
 */
export interface IEvidenceHelpCommand {
  /**
   * Discriminator selecting the built-in help text.
   *
   * No filesystem or configuration context is needed to render this request.
   */
  operation: "help";
}
