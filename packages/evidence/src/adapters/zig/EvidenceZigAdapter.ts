import { ZigAdapter } from "./ZigAdapter";

/**
 * Extracts explicit Zig pub declarations and fields of public containers.
 *
 * The pinned grammar recognizes the configured Zig source syntax. Lexical
 * container paths establish public addresses, and bounded same-container aliases
 * retain canonical source identity. Attached documentation belongs to the original
 * declaration even when another public path exposes it.
 *
 * Namespace imports, usingnamespace, namespace comptime execution, computed public
 * types, and build-generated declarations are not evaluated. Unsupported forms
 * that can change the public surface must leave incomplete analysis rather than
 * a convenient subset of the declarations.
 */
export class EvidenceZigAdapter extends ZigAdapter {}
