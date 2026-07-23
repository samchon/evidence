/**
 * A TypeScript symbol kind that can become an evidence unit.
 *
 * Evidence should cover public contracts, not indiscriminately turn every
 * implementation detail into a documentation obligation. This selector lets a
 * source choose the kinds whose individual semantics must remain traceable.
 *
 * - `"type"` selects exported interfaces and type aliases.
 * - `"function"` selects exported function declarations.
 * - `"property"` selects properties declared by exported type-level symbols.
 *
 * Properties use their declaring type as part of their identity, so they are
 * distinct from top-level function and type symbols.
 */
export type EvidenceGraphTypeScriptSymbol = "type" | "function" | "property";
