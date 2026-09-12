import typia from "typia";
import { Parser } from "web-tree-sitter";
import type { Language, Tree } from "web-tree-sitter";

import { EvidenceLanguageRegistry } from "./EvidenceLanguageRegistry";
import { EvidenceParseSession } from "./EvidenceParseSession";
import { EvidenceParserError } from "./EvidenceParserError";
import { ParserSlots } from "./internal/ParserSlots";
import { TreeSitterAssets } from "./internal/TreeSitterAssets";
import { TreeSitterRange } from "./internal/TreeSitterRange";
import { TreeSitterRuntime } from "./internal/TreeSitterRuntime";
import type { IEvidenceGrammar } from "./structures/IEvidenceGrammar";
import type { IEvidenceParserInput } from "./structures/IEvidenceParserInput";
import type { IEvidenceParserOptions } from "./structures/IEvidenceParserOptions";
import type { IEvidenceParserState } from "./structures/IEvidenceParserState";

/** Lazily loads local grammars and owns a bounded number of independent parse sessions. */
export class EvidenceParser {
  private readonly assets = new TreeSitterAssets();
  private readonly slots: ParserSlots;
  private readonly languages = new Map<string, Promise<Language>>();
  private readonly loaded = new Set<string>();

  public constructor(options: IEvidenceParserOptions = {}) {
    this.slots = new ParserSlots(typia.assert(options).concurrency ?? 4);
  }

  /** Reads provenance without initializing WASM or loading any language. */
  public async grammars(): Promise<IEvidenceGrammar[]> {
    return this.assets.list();
  }

  public state(): IEvidenceParserState {
    return {
      active: this.slots.active,
      waiting: this.slots.waiting,
      languages: Array.from(this.loaded).sort((x, y) =>
        x.localeCompare(y, "en"),
      ),
      closed: this.slots.closed,
    };
  }

  /**
   * Extracts data from a complete syntax tree and releases native resources in finally.
   * Callbacks may await work, but must not await another parse or close on this same pool.
   * Returned data must not retain Tree-sitter nodes, trees, or the borrowed session.
   */
  public async parse<T>(
    input: IEvidenceParserInput,
    closure: (session: EvidenceParseSession) => T | Promise<T>,
  ): Promise<T> {
    input = { ...input };
    const grammar = EvidenceLanguageRegistry.select(input.type, input.file);
    try {
      await this.slots.acquire();
    } catch (cause) {
      throw new EvidenceParserError(
        "session-closed",
        input.file,
        "This parser runtime is closed. Create a new runtime to parse additional files.",
        undefined,
        { cause },
      );
    }

    let parser: Parser | undefined;
    let tree: Tree | null = null;
    let session: EvidenceParseSession | undefined;
    try {
      const language = await this.language(grammar.id);
      parser = new Parser();
      try {
        parser.setLanguage(language);
      } catch (cause) {
        throw new EvidenceParserError(
          "grammar-incompatible",
          input.file,
          `Grammar ${grammar.id} is not compatible with this runtime. Update the pinned grammar/runtime pair.`,
          undefined,
          { cause },
        );
      }
      try {
        tree = parser.parse(input.content);
      } catch (cause) {
        throw new EvidenceParserError(
          "parse-failed",
          input.file,
          "The parser could not analyze this source. Inspect the underlying parser failure.",
          undefined,
          { cause },
        );
      }
      if (tree === null)
        throw new EvidenceParserError(
          "parse-failed",
          input.file,
          "Parsing stopped before producing a tree; this source has no complete inventory.",
        );
      if (tree.rootNode.hasError) {
        const cursor = tree.walk();
        try {
          // Descend only through error-bearing branches, including inserted MISSING tokens.
          let node = cursor.currentNode;
          while (!node.isError && !node.isMissing) {
            if (!cursor.gotoFirstChild()) break;
            while (
              !cursor.currentNode.hasError &&
              !cursor.currentNode.isMissing
            ) {
              if (!cursor.gotoNextSibling()) break;
            }
            node = cursor.currentNode;
          }
          throw new EvidenceParserError(
            "parse-incomplete",
            input.file,
            "The grammar found an ERROR or MISSING node. Correct the source or add support for its syntax before checking coverage.",
            TreeSitterRange.from(node),
          );
        } finally {
          cursor.delete();
        }
      }
      session = new EvidenceParseSession(tree, input.file);
      return await closure(session);
    } finally {
      if (session !== undefined) session.dispose();
      if (tree !== null) tree.delete();
      if (parser !== undefined) parser.delete();
      this.slots.release();
    }
  }

  /** Stops new requests and waits for accepted callbacks; process-wide immutable grammars remain cached. */
  public async close(): Promise<void> {
    await this.slots.close();
    this.languages.clear();
  }

  private async language(id: string): Promise<Language> {
    let pending = this.languages.get(id);
    if (pending === undefined) {
      pending = this.load(id);
      this.languages.set(id, pending);
    }
    try {
      return await pending;
    } catch (cause) {
      if (this.languages.get(id) === pending) this.languages.delete(id);
      throw cause;
    }
  }

  private async load(id: string): Promise<Language> {
    const grammar = await this.assets.grammar(id);
    const bytes = await this.assets.bytes(grammar);
    const language = await TreeSitterRuntime.language(grammar, bytes);
    this.loaded.add(id);
    return language;
  }
}
