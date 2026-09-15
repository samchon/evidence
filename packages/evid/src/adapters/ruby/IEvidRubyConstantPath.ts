/**
 * Represents a statically readable Ruby constant path and root qualification.
 *
 * EvidRubyFileScanner uses it to distinguish lexical nesting from top-level
 * constants before reopened declarations and visibility transitions are
 * reconciled.
 */
export interface IEvidRubyConstantPath {
  /**
   * Whether the source spelling begins at Ruby's top-level constant namespace.
   *
   * An absolute path bypasses the current lexical container during resolution.
   */
  absolute: boolean;

  /**
   * Constant names in source order after any root qualifier.
   *
   * The scanner combines these with lexical context only for relative paths.
   */
  segments: string[];
}
