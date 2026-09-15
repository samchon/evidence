/**
 * Classifies the effective entity introduced by a supported C declarator.
 *
 * The scanner unwraps syntax that only changes type spelling and uses this
 * discriminator to distinguish callable declarations from object declarations.
 * It does not model the declaration's full C type.
 */
export type EvidCDeclaratorKind = "direct" | "function" | "object";
