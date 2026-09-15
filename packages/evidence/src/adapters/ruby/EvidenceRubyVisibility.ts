/**
 * Represents Ruby method or constant visibility that the scanner can establish
 * statically.
 *
 * EvidenceRubyFileScanner updates it in source order, and EvidenceRubyAdapter
 * publishes only public records while retaining unsupported visibility changes
 * as diagnostics.
 */
export type EvidenceRubyVisibility = "private" | "protected" | "public";
