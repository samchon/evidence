/**
 * Command execution, watch lifecycle, and command syntax boundaries.
 *
 * Use EvidCommand for CLI-compatible finite execution, EvidWatcher for
 * long-lived publication, and EvidCommandError to distinguish invalid syntax
 * before a project configuration is loaded.
 */
export * from "./EvidCommand";
export * from "./EvidCommandError";
export * from "./EvidWatcher";
