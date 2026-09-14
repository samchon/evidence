import { readFile } from "node:fs/promises";
import { hash, Singleton, VariadicSingleton } from "tstl";
import { Language, Parser } from "web-tree-sitter";

import { EvidenceParserError } from "../parsers/EvidenceParserError";
import type { IEvidenceGrammar } from "../structures/IEvidenceGrammar";

/** Shares immutable grammar modules; the binding has no Language disposal API. */
export namespace TreeSitterRuntime {
  /** Awaits the shared engine before obtaining the grammar's immutable language module. */
  export async function language(
    grammar: IEvidenceGrammar,
    bytes: Uint8Array,
  ): Promise<Language> {
    await initialization.get();
    return languages.get(grammar, bytes);
  }

  /** Initializes the installed engine exactly once on first use. */
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

  /** Shares one language load per immutable digest, independent of input object identity. */
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
