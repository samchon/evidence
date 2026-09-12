import { Query } from "web-tree-sitter";
import type { Node, QueryCapture, QueryMatch, Tree } from "web-tree-sitter";

import { EvidenceParserError } from "./EvidenceParserError";
import { TreeSitterRange } from "./internal/TreeSitterRange";
import type { IEvidenceSourceRange } from "./structures/IEvidenceSourceRange";

/**
 * A borrowed tree and query cache, valid only during EvidenceParser.parse's callback.
 * Copy names, ranges, and relationships into data structures before the callback returns.
 */
export class EvidenceParseSession {
  private closed = false;
  private readonly queries = new Map<string, Query>();

  /** @internal Created and disposed by the parser runtime. */
  public constructor(
    private readonly tree: Tree,
    private readonly file: string,
  ) {}

  public get root(): Node {
    this.assertOpen();
    return this.tree.rootNode;
  }

  /** Converts a node belonging to this session into a serializable source range. */
  public range(node: Node): IEvidenceSourceRange {
    this.assertNode(node);
    return TreeSitterRange.from(node);
  }

  /** Returns borrowed nodes; compilation errors and truncated queries reject extraction. */
  public captures(source: string, node?: Node): QueryCapture[] {
    const target = node ?? this.root;
    this.assertNode(target);
    const query = this.query(source);
    const captures = query.captures(target);
    this.assertComplete(query);
    return captures;
  }

  /** Preserves the relationship between captures belonging to one query match. */
  public matches(source: string, node?: Node): QueryMatch[] {
    const target = node ?? this.root;
    this.assertNode(target);
    const query = this.query(source);
    const matches = query.matches(target);
    this.assertComplete(query);
    return matches;
  }

  /** @internal Releases cached queries; the runtime separately owns the tree. */
  public dispose(): void {
    if (this.closed) return;
    this.closed = true;
    for (const query of this.queries.values()) query.delete();
    this.queries.clear();
  }

  private query(source: string): Query {
    let query = this.queries.get(source);
    if (query !== undefined) return query;
    try {
      query = new Query(this.tree.language, source);
      // The binding exposes custom/property predicates without evaluating their semantics.
      if (
        query.predicates.some((predicates) => predicates.length !== 0) ||
        query.assertedProperties.some(
          (properties) => Object.keys(properties).length !== 0,
        ) ||
        query.refutedProperties.some(
          (properties) => Object.keys(properties).length !== 0,
        )
      ) {
        query.delete();
        throw new Error(
          "Query predicates requiring an external evaluator are unsupported.",
        );
      }
      this.queries.set(source, query);
      return query;
    } catch (cause) {
      throw new EvidenceParserError(
        "query-invalid",
        this.file,
        "The adapter query is incompatible with this grammar or requires an unsupported predicate. Correct the query before extracting symbols.",
        undefined,
        { cause },
      );
    }
  }

  private assertComplete(query: Query): void {
    if (query.didExceedMatchLimit())
      throw new EvidenceParserError(
        "query-incomplete",
        this.file,
        "The adapter query exceeded its match limit. Simplify the query before using its captures as a complete inventory.",
      );
  }

  private assertOpen(): void {
    if (this.closed)
      throw new EvidenceParserError(
        "session-closed",
        this.file,
        "This parse callback has ended; its borrowed nodes are no longer valid.",
      );
  }

  private assertNode(node: Node): void {
    this.assertOpen();
    if (node.tree !== this.tree)
      throw new EvidenceParserError(
        "query-invalid",
        this.file,
        "The node belongs to another parse session.",
      );
  }
}
