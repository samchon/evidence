/**
 * Represents Ruby method or constant visibility that the scanner can establish
 * statically.
 *
 * EvidRubyFileScanner updates it in source order, and EvidRubyAdapter
 * publishes only public records while retaining unsupported visibility changes
 * as diagnostics.
 */
export type EvidRubyVisibility = "private" | "protected" | "public";
