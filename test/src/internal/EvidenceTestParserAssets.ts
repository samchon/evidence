import type { IEvidenceGrammar } from "evidence";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import {
  EvidenceTreeSitterAssets,
  EvidenceTreeSitterAssetScope,
} from "evidence";
import { EvidenceTestFileSystem } from "./EvidenceTestFileSystem";

/**
 * Acquires real pinned test grammars automatically while isolating each suite's
 * runtime cache.
 */
export namespace EvidenceTestParserAssets {
  /**
   * Reuses a contributor/CI fixture cache independently of the acquisition
   * scenario under test.
   */
  export async function bytes(grammar: IEvidenceGrammar): Promise<Uint8Array> {
    return EvidenceTreeSitterAssetScope.run(
      {
        cacheDirectory: resolve(__dirname, "../../.tmp/parser-fixtures"),
        fetch: globalThis.fetch,
        attempts: 3,
        timeoutMilliseconds: 30_000,
        signal: undefined,
        progress: undefined,
      },
      async () => new EvidenceTreeSitterAssets().bytes(grammar),
    );
  }

  /**
   * Creates a disposable runtime cache and supplies only catalog-pinned bytes
   * as its controlled transport.
   */
  export async function run<T>(closure: () => Promise<T>): Promise<T> {
    const grammars = await new EvidenceTreeSitterAssets().list();
    const files = new Map(
      grammars.map((grammar) => [grammar.wasm.url, grammar]),
    );

    async function fetchFixture(
      input: string | URL | Request,
    ): Promise<Response> {
      const url = input instanceof Request ? input.url : String(input);
      const grammar = files.get(url);
      if (grammar === undefined)
        throw new Error(`No pinned parser fixture for ${url}`);
      return new Response(Uint8Array.from(await bytes(grammar)));
    }

    return EvidenceTestFileSystem.experiment(
      `parser-runtime-${randomUUID()}`,
      {},
      async (cacheDirectory) => {
        // Child config evaluators inherit the same ignored temporary root.
        const previous = new Map(
          ["TEMP", "TMP", "TMPDIR"].map((key) => [key, process.env[key]]),
        );
        for (const key of previous.keys()) process.env[key] = cacheDirectory;
        try {
          return await EvidenceTreeSitterAssetScope.run(
            { cacheDirectory, fetch: fetchFixture },
            closure,
          );
        } finally {
          for (const [key, value] of previous)
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
      },
    );
  }
}
