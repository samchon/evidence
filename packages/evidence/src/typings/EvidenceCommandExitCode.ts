/**
 * Process exit codes reserved by the evidence command-line interface.
 *
 * Command callers can distinguish a passing check, a completed check with
 * reported violations, and an operational failure without parsing formatted
 * output. The numeric values are part of the shell-facing compatibility
 * contract.
 */
export type EvidenceCommandExitCode = 0 | 1 | 2;
