import type { IEvidGrammar } from "evid";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { EvidTreeSitterAssets } from "../../../packages/evidence/src/internal/EvidTreeSitterAssets";
import { EvidTreeSitterAssetScope } from "../../../packages/evidence/src/internal/EvidTreeSitterAssetScope";
import { TestFileSystem } from "./TestFileSystem";

/** Acquires real pinned test grammars automatically while isolating each suite's runtime cache. */
export namespace TestParserAssets {
  /** Reuses a contributor/CI fixture cache independently of the acquisition scenario under test. */
  export async function bytes(grammar: IEvidGrammar): Promise<Uint8Array> {
    return EvidTreeSitterAssetScope.run(
      {
        cacheDirectory: resolve(__dirname, "../../.tmp/parser-fixtures"),
        fetch: globalThis.fetch,
        attempts: 3,
        timeoutMilliseconds: 30_000,
        signal: undefined,
        progress: undefined,
      },
      async () => new EvidTreeSitterAssets().bytes(grammar),
    );
  }

  /** Creates a disposable runtime cache and supplies only catalog-pinned bytes as its controlled transport. */
  export async function run<T>(closure: () => Promise<T>): Promise<T> {
    const grammars = await new EvidTreeSitterAssets().list();
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

    return TestFileSystem.experiment(
      `parser-runtime-${randomUUID()}`,
      {},
      async (cacheDirectory) => {
        // Child config evaluators inherit the same ignored temporary root.
        const previous = new Map(
          ["TEMP", "TMP", "TMPDIR"].map((key) => [key, process.env[key]]),
        );
        for (const key of previous.keys()) process.env[key] = cacheDirectory;
        try {
          return await EvidTreeSitterAssetScope.run(
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
