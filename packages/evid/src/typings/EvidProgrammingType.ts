/**
 * Programming-language identifiers accepted by programming artifact adapters.
 *
 * A configuration selects one of these explicit parser and extraction
 * contracts; filename detection is not a substitute for declaring the artifact
 * type. New language research remains in the candidate types until it meets
 * that contract.
 */
export type EvidProgrammingType =
  | "c"
  | "cpp"
  | "csharp"
  | "dart"
  | "go"
  | "java"
  | "javascript"
  | "kotlin"
  | "lua"
  | "matlab"
  | "objc"
  | "php"
  | "python"
  | "ruby"
  | "rust"
  | "scala"
  | "swift"
  | "typescript"
  | "zig";
