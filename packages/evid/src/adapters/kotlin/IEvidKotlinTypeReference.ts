/**
 * Retains a Kotlin receiver reference for later static nominal lookup.
 *
 * EvidKotlinFileScanner records lookup candidates while file scope and imports
 * are available, and EvidKotlinReceivers resolves the reference after
 * declarations and supported aliases have been collected without invoking the
 * Kotlin compiler.
 */
export interface IEvidKotlinTypeReference {
  /**
   * Names the physical source that supplied this receiver reference.
   *
   * EvidKotlinReceivers permits file-private aliases only from this file,
   * preserving Kotlin visibility during deferred lookup.
   */
  file: string;

  /**
   * Lists nominal lookup candidates from lexical, imported, and package scope.
   *
   * EvidKotlinReceivers checks these paths in order and accepts exactly one
   * visible declaration, so their ordering represents EvidKotlinFileScanner's
   * precedence.
   */
  paths: string[][];

  /**
   * Provides a resolved external, qualified, or Kotlin-core type path.
   *
   * Omission means no such path is statically known, so lookup must find a
   * selected declaration through {@link paths} or report an unresolved
   * receiver.
   */
  external?: string[];

  /**
   * Records whether the parsed receiver reference has a nullable suffix.
   *
   * Alias resolution combines this value with nullability inherited from the
   * expanded alias target.
   */
  nullable: boolean;

  /**
   * Explains why this receiver cannot use nominal static resolution.
   *
   * Omission permits EvidKotlinReceivers lookup; when present, callers preserve
   * the unsupported-receiver diagnostic instead of guessing substitutions or
   * imports.
   */
  problem?: string;
}
