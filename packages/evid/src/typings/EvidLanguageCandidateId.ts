/**
 * Identifier for a language or embedded format still being researched.
 *
 * Candidate IDs are deliberately outside `EvidProgrammingType`: recording
 * parser availability, grammar provenance, or extraction gaps must not imply
 * that configurations can already select the language as a supported artifact.
 */
export type EvidLanguageCandidateId =
  | "kotlin"
  | "swift"
  | "php"
  | "dart"
  | "scala"
  | "lua"
  | "objc"
  | "zig"
  | "matlab"
  | "vue"
  | "svelte";
