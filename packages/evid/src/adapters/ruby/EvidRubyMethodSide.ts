/**
 * Identifies the receiver side on which Ruby installs a method or generated attribute.
 *
 * Scanner contexts retain this distinction so instance and singleton members of
 * the same container receive separate semantic identities and public addresses.
 */
export type EvidRubyMethodSide = "instance" | "singleton";
