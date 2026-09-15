/**
 * Records whether C++ declaration visibility is known or deferred to
 * qualification.
 *
 * A qualified member requires later owner resolution, whereas public and
 * non-public declarations can be filtered directly from their lexical context.
 */
export type EvidenceCppVisibility = "public" | "non-public" | "qualified";
