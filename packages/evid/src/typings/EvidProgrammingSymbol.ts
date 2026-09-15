/**
 * Public programming declarations classified by each language adapter.
 *
 * - "type": classes, interfaces, type aliases, namespaces, and their equivalents.
 * - "function": functions, public methods, and callable declarations.
 * - "property": public data fields and variables.
 *
 * TypeScript classification:
 *
 * - Type declarations must be exported; enums are excluded.
 * - Functions include:
 *
 *   - Exported functions and consts initialized with arrow/function expressions,
 *       including parentheses and type-only wrappers.
 *   - Public class methods and method signatures of interfaces and object-shaped
 *       type aliases, including the same forms inside namespaces.
 *   - Members initialized with functions or annotated with an inline function type.
 *       Overload declarations form one unit.
 * - Properties include:
 *
 *   - Exported const/let/var bindings and destructured leaves, except the const
 *       function initializers above. Function-valued let/var remain properties.
 *       A function type annotation alone also leaves a variable a property.
 *   - Non-callable members of classes, interfaces, and object-shaped type aliases.
 *       A named type alias, union, or constructor type does not make a member a
 *       function; an inline function type does.
 *   - Public constructor parameter properties, classified like body fields
 *       regardless of the constructor's visibility. Property modifiers include
 *       public, protected, private, readonly, and override; documentation
 *       belongs on the parameter.
 * - Constructors, accessors, computed names, and private/protected members are
 *   excluded. Computed literal names are excluded too.
 *
 * TypeScript addresses:
 *
 * - Use the public export name, including aliases; default exports use "default".
 *   Anonymous default classes/functions also have that address. A default-only
 *   local binding is not a named export.
 * - Namespace members use qualified names; ambient members are public without
 *   individual export modifiers.
 * - Type-only exports expose type-space declarations and withhold value-space
 *   declarations across every export spelling and module boundary:
 *
 *   - Classes/namespaces themselves remain visible, but class members and namespace
 *       values do not.
 *   - Standalone interface and object-shaped alias members remain visible,
 *       including callable members. Interfaces merged with classes follow the
 *       class's value-space member rules.
 * - Static class members use Class.member; instance members and parameter
 *   properties use Class.prototype.member. Standalone interface/alias members
 *   use Type.member; interfaces merged with classes use
 *   Class.prototype.member.
 * - File-qualified targets use a path relative to the citing file, "#", and the
 *   accessor. Literal member names use bracketed JSON strings. Symbol
 *   characters match exactly; path normalization must not rewrite them.
 * - Re-exports do not create duplicate units in the barrel file.
 *
 * Types and namespaces contain their declared descendants. Ordinary citations
 * and permitted exclusions cover selected descendants, and unselected ancestors
 * remain addressable.
 */
export type EvidProgrammingSymbol = "type" | "function" | "property";
