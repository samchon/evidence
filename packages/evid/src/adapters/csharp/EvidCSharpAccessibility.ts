/**
 * Records C# accessibility as declared before containing-type reachability.
 *
 * EvidCSharpFileScanner retains the raw form so later visibility evaluation can
 * combine C# defaults and modifiers with every enclosing type's accessibility.
 */
export type EvidCSharpAccessibility =
  | "default"
  | "public"
  | "private"
  | "protected"
  | "internal"
  | "protected-internal"
  | "private-protected"
  | "file";
