/**
 * Identifies the supported Ruby container form backed by a constant path.
 *
 * EvidRubyAdapterBase compares this form when reconciling reopened
 * declarations. A class and module with the same identity cannot form one
 * semantic container.
 */
export type EvidRubyContainerKind = "class" | "module";
