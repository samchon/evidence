/**
 * Command execution, watch lifecycle, and command syntax boundaries.
 *
 * Use EvidenceCommand for CLI-compatible finite execution, EvidenceWatcher for
 * long-lived publication, and EvidenceCommandError to distinguish invalid
 * syntax before a project configuration is loaded.
 */
export * from "./EvidenceCommand";
export * from "./EvidenceCommandError";
export * from "./EvidenceWatcher";
