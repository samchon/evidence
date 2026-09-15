/**
 * Parsed request to create a starter Evidence configuration.
 *
 * Execution resolves the destination from command cwd and creates it
 * exclusively. Existing files are refused so initialization cannot overwrite an
 * authored policy.
 */
export interface IEvidenceInitCommand {
  /**
   * Discriminator selecting configuration creation.
   *
   * Initialization writes a starter contract without running an Evidence Graph
   * check.
   */
  operation: "init";

  /**
   * Working directory anchoring the configuration destination.
   *
   * The command resolves this against its invocation base without changing
   * process cwd.
   */
  cwd: string;

  /**
   * New configuration path, defaulting to evidence.config.ts during parsing.
   *
   * Execution validates the supported file format and rejects an existing
   * destination.
   */
  config: string;
}
