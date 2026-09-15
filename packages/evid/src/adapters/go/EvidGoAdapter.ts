import { EvidGoAdapterBase } from "./EvidGoAdapterBase";

/**
 * Extracts exported Go declarations with package-wide receiver ownership.
 *
 * Selected files are scanned before package resolution attaches receiver
 * methods and interface members to their owner types. Package and test-file
 * boundaries remain explicit; a documentation comment can participate only at
 * an eligible declaration position. Public paths stay file-qualified after
 * reconciliation.
 *
 * Analysis does not evaluate GOOS, GOARCH, promoted members, or
 * dependency-derived declarations. Conditional or unresolved public ownership
 * must not produce a passing inventory with the affected declarations missing.
 */
export class EvidGoAdapter extends EvidGoAdapterBase {}
