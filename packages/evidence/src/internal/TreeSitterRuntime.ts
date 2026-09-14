import { readFile } from "node:fs/promises";
import { hash, Singleton, VariadicSingleton } from "tstl";
import { Language, Parser } from "web-tree-sitter";

import { EvidenceParserError } from "../parsers/EvidenceParserError";
import type { IEvidenceGrammar } from "../structures/IEvidenceGrammar";

/**
 * Initializes the WASM binding once and shares immutable loaded grammar modules.
 *
 * web-tree-sitter offers no language disposal API, so cache keys use verified
 * byte digests and instances are intentionally process-lifetime resources.
 */
export namespace TreeSitterRuntime {
  /**
   * Returns the language module for verified grammar bytes after engine initialization.
   *
   * The runtime key is the grammar digest, so equivalent metadata objects share
   * one process-lifetime Language instance regardless of object identity.
   */
  export async function language(
    grammar: IEvidenceGrammar,
    bytes: Uint8Array,
  ): Promise<Language> {
    await initialization.get();
    return languages.get(grammar, bytes);
  }

  /**
   * Initializes the installed web-tree-sitter engine once on first use.
   *
   * Loading the packaged core WASM from its resolved path avoids cwd-sensitive
   * fetches, and failures become runtime-initialization diagnostics.
   */
  const initialization = new Singleton(async () => {
    try {
      // Supplying local bytes avoids cwd-sensitive URLs and any runtime fetch fallback.
      const wasmBinary = await readFile(
        require.resolve("web-tree-sitter/web-tree-sitter.wasm"),
      );
      await Parser.init({ wasmBinary });
    } catch (cause) {
      throw new EvidenceParserError(
        "runtime-initialization",
        "web-tree-sitter",
        "Cannot initialize the packaged WASM runtime. Inspect the installed core asset and underlying error.",
        undefined,
        { cause },
      );
    }
  });

  /**
   * Shares one grammar Language load per immutable WASM digest.
   *
   * The singleton compares digest strings rather than input objects because all
   * callers with the same verified bytes can safely reuse one loaded module.
   */
  const languages = new VariadicSingleton(
    async (grammar: IEvidenceGrammar, bytes: Uint8Array): Promise<Language> => {
      try {
        return await Language.load(bytes);
      } catch (cause) {
        throw new EvidenceParserError(
          "grammar-incompatible",
          grammar.wasm.file,
          `Cannot link grammar ${grammar.id} (${grammar.version}) with web-tree-sitter. Supply a compatible pinned grammar/runtime pair.`,
          undefined,
          { cause },
        );
      }
    },
    ([grammar]) => hash(grammar.wasm.sha256),
    ([left], [right]) => left.wasm.sha256 === right.wasm.sha256,
  );
}
