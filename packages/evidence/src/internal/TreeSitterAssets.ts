import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import typia from "typia";

import { EvidenceParserError } from "../EvidenceParserError";
import type { IEvidenceGrammar } from "../structures/IEvidenceGrammar";

/** Reads only packaged assets and verifies bytes before they enter the WASM loader. */
export class TreeSitterAssets {
  private manifest: Promise<IEvidenceGrammar[]> | undefined;

  public constructor(
    private readonly directory: string = path.resolve(
      __dirname,
      "../../assets",
    ),
  ) {}

  public async list(): Promise<IEvidenceGrammar[]> {
    this.manifest ??= this.readManifest();
    return structuredClone(await this.manifest);
  }

  public async grammar(id: string): Promise<IEvidenceGrammar> {
    const grammar = (await this.list()).find((entry) => entry.id === id);
    if (grammar === undefined)
      throw new EvidenceParserError(
        "asset-manifest",
        this.directory,
        `The packaged manifest has no ${id} grammar. Restore the package's pinned assets.`,
      );
    return grammar;
  }

  public async bytes(grammar: IEvidenceGrammar): Promise<Uint8Array> {
    const file = this.location(grammar.wasm.file);
    let bytes: Uint8Array;
    try {
      bytes = await readFile(file);
    } catch (cause) {
      throw new EvidenceParserError(
        "asset-missing",
        file,
        "Cannot read the packaged grammar. Restore this package's parser assets.",
        undefined,
        { cause },
      );
    }
    if (
      bytes.length !== grammar.wasm.size ||
      createHash("sha256").update(bytes).digest("hex") !== grammar.wasm.sha256
    )
      throw new EvidenceParserError(
        "asset-corrupt",
        file,
        "The grammar does not match its pinned checksum. Restore the original packaged asset.",
      );
    return bytes;
  }

  private async readManifest(): Promise<IEvidenceGrammar[]> {
    const file = path.join(this.directory, "grammars.json");
    try {
      const entries = typia.json.assertParse<IEvidenceGrammar[]>(
        await readFile(file, "utf8"),
      );
      const ids = new Set<string>();
      for (const entry of entries) {
        if (ids.has(entry.id))
          throw new Error(`Duplicate grammar ID: ${entry.id}`);
        ids.add(entry.id);
        this.location(entry.wasm.file);
        this.location(entry.license.file);
      }
      return entries;
    } catch (cause) {
      throw new EvidenceParserError(
        "asset-manifest",
        file,
        "Cannot read the pinned grammar manifest. Restore this package's parser assets.",
        undefined,
        { cause },
      );
    }
  }

  private location(file: string): string {
    const absolute = path.resolve(this.directory, file);
    const relative = path.relative(this.directory, absolute);
    if (
      relative === "" ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
      throw new EvidenceParserError(
        "asset-manifest",
        file,
        "A grammar asset path must name a file inside the package's assets directory.",
      );
    return absolute;
  }
}
