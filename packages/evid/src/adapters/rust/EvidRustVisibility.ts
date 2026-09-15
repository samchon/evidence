/**
 * Represents source visibility relevant to Rust's externally reachable public surface.
 *
 * EvidRustSyntax classifies modifiers into this reduced vocabulary. EvidRustModuleResolver
 * evaluates the value at module boundaries before it publishes a declaration.
 */
export type EvidRustVisibility = "public" | "restricted" | "private" | "implicit";
