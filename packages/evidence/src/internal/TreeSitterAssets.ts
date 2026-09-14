import path from "node:path";
import typia from "typia";

import { EvidenceParserError } from "../parsers/EvidenceParserError";
import type { IEvidenceGrammar } from "../structures/IEvidenceGrammar";
import type { ITreeSitterAssetOptions } from "./ITreeSitterAssetOptions";
import { TreeSitterAssetCache } from "./TreeSitterAssetCache";
import { TreeSitterAssetScope } from "./TreeSitterAssetScope";
import { TreeSitterGrammarCatalog } from "./TreeSitterGrammarCatalog";

/** Reads compiled provenance and lazily acquires pinned grammar bytes in the user cache. */
export class TreeSitterAssets {
  /** Execution-local acquisition controls inherited by independently constructed adapters. */
  private readonly cache: TreeSitterAssetCache;

  /** Captures optional acquisition overrides without reading or writing any package files. */
  public constructor(options: ITreeSitterAssetOptions = {}) {
    this.cache = new TreeSitterAssetCache({
      ...TreeSitterAssetScope.current(),
      ...options,
    });
  }

  /** Returns independent metadata without initializing WASM, writing the cache, or downloading assets. */
  public async list(): Promise<IEvidenceGrammar[]> {
    return this.readManifest();
  }

  /** Resolves a pinned syntax variant without preparing its bytes. */
  public async grammar(id: string): Promise<IEvidenceGrammar> {
    const grammar = (await this.list()).find((entry) => entry.id === id);
    if (grammar === undefined)
      throw new EvidenceParserError(
        "asset-manifest",
        id,
        `The parser catalog has no ${id} grammar. Restore the package's pinned catalog.`,
      );
    return grammar;
  }

  /** Obtains verified cache bytes or automatically downloads the exact pinned asset. */
  public async bytes(input: IEvidenceGrammar): Promise<Uint8Array> {
    const grammar = structuredClone(typia.assert(input));
    this.validate(grammar);
    return this.cache.bytes(grammar);
  }

  /** Validates compiled catalog records and rejects duplicate identifiers. */
  private readManifest(): IEvidenceGrammar[] {
    try {
      const entries = typia.assert(TreeSitterGrammarCatalog.list());
      const ids = new Set<string>();
      for (const entry of entries) {
        if (ids.has(entry.id))
          throw new Error(`Duplicate grammar ID: ${entry.id}`);
        ids.add(entry.id);
        this.validate(entry);
      }
      return entries;
    } catch (cause) {
      throw new EvidenceParserError(
        "asset-manifest",
        "grammar-catalog",
        "The compiled grammar catalog is invalid. Restore this package's parser metadata.",
        undefined,
        { cause },
      );
    }
  }

  /** Rejects unsafe metadata before it can choose a filesystem key or download destination. */
  private validate(grammar: IEvidenceGrammar): void {
    for (const asset of [grammar.wasm, grammar.license]) {
      this.location(asset.file);
      const url = new URL(asset.url);
      if (
        url.protocol !== "https:" ||
        url.username !== "" ||
        url.password !== ""
      )
        throw new EvidenceParserError(
          "asset-manifest",
          grammar.id,
          "Parser assets require an HTTPS URL without credentials.",
        );
    }
  }

  /** Keeps provenance paths relative on every platform without requiring local asset files. */
  private location(file: string): void {
    if (
      file === "" ||
      file.replaceAll("\\", "/").split("/").includes("..") ||
      path.posix.isAbsolute(file) ||
      path.win32.isAbsolute(file)
    )
      throw new EvidenceParserError(
        "asset-manifest",
        file,
        "A grammar provenance path must be relative and cannot traverse parent directories.",
      );
  }
}
