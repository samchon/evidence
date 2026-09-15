/**
 * Represents a grammar-derived C++ qualified name in the scanner's normalized
 * form.
 *
 * `EvidCppSyntax.qualifiedName` produces this value for declarations and
 * aliases. `EvidCppFileScanner` consumes its segments as semantic paths and
 * rejects specialized names that cannot safely share the primary template's
 * public accessor.
 */
export interface IEvidCppQualifiedName {
  /**
   * Ordered semantic name segments decoded from the supported grammar node.
   *
   * Consumers preserve these boundaries when building declaration identities
   * and alias targets. Template segments include their parameter arity with a
   * backtick suffix, such as `Vector\`1`.
   */
  segments: string[];

  /**
   * Whether the parsed spelling names a template specialization rather than a
   * reusable primary-template path.
   *
   * The scanner propagates this flag through declarators and aliases, then
   * reports the unsupported spelling instead of assigning it the primary
   * template's common accessor.
   */
  specialized: boolean;
}
