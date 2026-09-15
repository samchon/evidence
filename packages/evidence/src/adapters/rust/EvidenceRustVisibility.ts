/**
 * Represents source visibility relevant to Rust's externally reachable public
 * surface.
 *
 * EvidenceRustSyntax classifies modifiers into this reduced vocabulary.
 * EvidenceRustModuleResolver evaluates the value at module boundaries before it
 * publishes a declaration.
 */
export type EvidenceRustVisibility =
  "public" | "restricted" | "private" | "implicit";
