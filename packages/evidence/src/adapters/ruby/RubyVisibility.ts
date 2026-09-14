/**
 * Represents Ruby method or constant visibility that the scanner can establish statically.
 *
 * RubyFileScanner updates it in source order, and RubyAdapter publishes only
 * public records while retaining unsupported visibility changes as diagnostics.
 */
export type RubyVisibility = "private" | "protected" | "public";
