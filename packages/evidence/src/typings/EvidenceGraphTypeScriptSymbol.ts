/**
 * A public TypeScript contract kind that can become an evidence unit or host an
 * evidence declaration.
 *
 * The selector is intentionally semantic rather than a list of AST node names:
 * `"function"` includes the common ways a project exports callable behavior,
 * and qualified identities keep nested contracts addressable without adding a
 * file path to every target.
 *
 * - `"type"` selects exported interfaces and type aliases. Classes and namespaces
 *   do not become type units.
 * - `"function"` selects exported function declarations, exported `const`
 *   variables initialized with an arrow function or function expression, public
 *   instance and static methods of exported classes, function-valued public
 *   class fields (an arrow/function initializer or direct function type), and
 *   the same callable forms exported from namespaces. Constructors and
 *   accessors are not selected.
 * - `"property"` selects property signatures declared directly by exported
 *   interfaces and object-shaped type aliases. Class fields and methods are not
 *   property units.
 *
 * Top-level identities use the public export name, and namespace members
 * prepend their namespace, such as `Orders.create`. A local declaration exposed
 * as `export { Local as Public }` therefore uses `Public`. A named default
 * declaration keeps its declaration name; anonymous and default-only aliases
 * have no stable target and are not selected. Type properties use
 * `TypeName.property`. Static class callables use `ClassName.method`; instance
 * callables use `ClassName.prototype.method`. Computed names are not selected,
 * even when their expression is a literal.
 *
 * These targets deliberately omit file paths. If selected files expose the same
 * qualified target, a declaration using that target is ambiguous; rename or
 * further qualify the public symbols. A re-export whose declaration lives in
 * another file does not create a second unit in the barrel file.
 */
export type EvidenceGraphTypeScriptSymbol = "type" | "function" | "property";
