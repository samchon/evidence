import { readFile } from "node:fs/promises";
import { Language, Parser } from "web-tree-sitter";

import { EvidenceParserError } from "../EvidenceParserError";
import type { IEvidenceGrammar } from "../structures/IEvidenceGrammar";

/** Shares immutable grammar modules; the binding has no Language disposal API. */
export namespace TreeSitterRuntime {
  let initialization: Promise<void> | undefined;
  const languages = new Map<string, Promise<Language>>();

  export async function language(
    grammar: IEvidenceGrammar,
    bytes: Uint8Array,
  ): Promise<Language> {
    initialization ??= initialize();
    await initialization;

    let pending = languages.get(grammar.wasm.sha256);
    if (pending === undefined) {
      pending = load(grammar, bytes);
      languages.set(grammar.wasm.sha256, pending);
    }
    try {
      return await pending;
    } catch (cause) {
      if (languages.get(grammar.wasm.sha256) === pending)
        languages.delete(grammar.wasm.sha256);
      throw cause;
    }
  }

  async function initialize(): Promise<void> {
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
  }

  async function load(
    grammar: IEvidenceGrammar,
    bytes: Uint8Array,
  ): Promise<Language> {
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
  }
}
