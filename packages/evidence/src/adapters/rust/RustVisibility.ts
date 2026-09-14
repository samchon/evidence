/**
 * Represents source visibility relevant to Rust's externally reachable public surface.
 *
 * RustSyntax classifies modifiers into this reduced vocabulary. RustModuleResolver
 * evaluates the value at module boundaries before it publishes a declaration.
 */
export type RustVisibility = "public" | "restricted" | "private" | "implicit";
