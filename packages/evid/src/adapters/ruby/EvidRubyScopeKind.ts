/**
 * Classifies lexical Ruby scopes that can contain supported declarations.
 *
 * EvidRubyFileScanner uses the current scope to decide which directives are valid and
 * how declarations inherit container identity, receiver side, and visibility.
 */
export type EvidRubyScopeKind = "class" | "module" | "singleton" | "top";
