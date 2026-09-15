import path from "node:path";
import typia from "typia";

import { EvidParserError } from "../parsers/EvidParserError";
import type { IEvidGrammar } from "../structures/IEvidGrammar";
import type { IEvidTreeSitterAssetOptions } from "./IEvidTreeSitterAssetOptions";
import { EvidTreeSitterAssetCache } from "./EvidTreeSitterAssetCache";
import { EvidTreeSitterAssetScope } from "./EvidTreeSitterAssetScope";
import grammars from "./parser-grammars.json";

/**
 * Reads compiled grammar provenance and lazily acquires verified pinned bytes.
 *
 * Metadata validation occurs before cache-key or URL use so a corrupted package
 * catalog cannot redirect filesystem writes or downloads outside the asset boundary.
 */
export class EvidTreeSitterAssets {
  /**
   * Caches grammar bytes under the inherited and constructor-provided acquisition controls.
   *
   * The constructor creates this instance after merging scope controls with local
   * overrides, so every bytes request follows the same policy.
   */
  private readonly cache: EvidTreeSitterAssetCache;

  /**
   * Captures optional acquisition overrides without accessing grammar assets.
   *
   * Scope controls supply defaults, and explicit constructor options take precedence
   * before a later bytes call resolves a cache entry or download.
   */
  public constructor(options: IEvidTreeSitterAssetOptions = {}) {
    this.cache = new EvidTreeSitterAssetCache({
      ...EvidTreeSitterAssetScope.current(),
      ...options,
    });
  }

  /**
   * Returns validated grammar metadata without initializing WASM or acquiring bytes.
   *
   * Consumers can inspect the compiled catalog safely because readManifest rejects
   * invalid records before they are returned.
   */
  public async list(): Promise<IEvidGrammar[]> {
    return this.readManifest();
  }

  /**
   * Resolves one validated pinned grammar by its catalog ID.
   *
   * This lookup does not prepare or load the WASM bytes; unknown IDs become an
   * asset-manifest error with repair guidance.
   */
  public async grammar(id: string): Promise<IEvidGrammar> {
    const grammar = (await this.list()).find((entry) => entry.id === id);
    if (grammar === undefined)
      throw new EvidParserError(
        "asset-manifest",
        id,
        `The parser catalog has no ${id} grammar. Restore the package's pinned catalog.`,
      );
    return grammar;
  }

  /**
   * Obtains a caller-owned copy of verified grammar bytes from the immutable cache.
   *
   * Input is cloned and validated before cache acquisition, preventing unsafe
   * metadata from selecting a filesystem key or network destination.
   */
  public async bytes(input: IEvidGrammar): Promise<Uint8Array> {
    const grammar = structuredClone(typia.assert(input));
    this.validate(grammar);
    return this.cache.bytes(grammar);
  }

  /**
   * Validates the packaged grammar pins and rejects duplicate identifiers.
   *
   * list delegates here before exposing metadata, ensuring each grammar has safe
   * provenance paths and credential-free HTTPS asset URLs. The pins are imported
   * from parser-grammars.json as a plain module; no payload bytes are read here.
   */
  private readManifest(): IEvidGrammar[] {
    try {
      const entries: IEvidGrammar[] = typia.assert<IEvidGrammar[]>(
        structuredClone(grammars),
      );
      const ids = new Set<string>();
      for (const entry of entries) {
        if (ids.has(entry.id))
          throw new Error(`Duplicate grammar ID: ${entry.id}`);
        ids.add(entry.id);
        this.validate(entry);
      }
      return entries;
    } catch (cause) {
      throw new EvidParserError(
        "asset-manifest",
        "grammar-catalog",
        "The compiled grammar catalog is invalid. Restore this package's parser metadata.",
        undefined,
        { cause },
      );
    }
  }

  /**
   * Rejects unsafe asset metadata before it chooses a filesystem key or network destination.
   *
   * Both grammar WASM and license records require relative provenance paths and
   * credential-free HTTPS URLs to remain within the asset trust boundary.
   */
  private validate(grammar: IEvidGrammar): void {
    for (const asset of [grammar.wasm, grammar.license]) {
      this.location(asset.file);
      const url = new URL(asset.url);
      if (
        url.protocol !== "https:" ||
        url.username !== "" ||
        url.password !== ""
      )
        throw new EvidParserError(
          "asset-manifest",
          grammar.id,
          "Parser assets require an HTTPS URL without credentials.",
        );
    }
  }

  /**
   * Requires a provenance path to remain relative on every supported platform.
   *
   * This lexical validation rejects empty, absolute, and parent-traversing paths
   * without requiring the referenced asset file to exist locally.
   */
  private location(file: string): void {
    if (
      file === "" ||
      file.replaceAll("\\", "/").split("/").includes("..") ||
      path.posix.isAbsolute(file) ||
      path.win32.isAbsolute(file)
    )
      throw new EvidParserError(
        "asset-manifest",
        file,
        "A grammar provenance path must be relative and cannot traverse parent directories.",
      );
  }
}
