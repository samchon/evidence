import type { IEvidenceGrammar } from "../../../packages/evidence/src/structures/IEvidenceGrammar";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { TreeSitterAssets } from "../../../packages/evidence/src/internal/TreeSitterAssets";
import { TreeSitterAssetScope } from "../../../packages/evidence/src/internal/TreeSitterAssetScope";
import { TestFileSystem } from "./TestFileSystem";

/** Acquires real pinned test grammars automatically while isolating each suite's runtime cache. */
export namespace TestParserAssets {
  /** Reuses a contributor/CI fixture cache independently of the acquisition scenario under test. */
  export async function bytes(grammar: IEvidenceGrammar): Promise<Uint8Array> {
    return TreeSitterAssetScope.run(
      {
        cacheDirectory: resolve(
          __dirname,
          "../../../node_modules/.cache/evidence-parser-fixtures",
        ),
        fetch: globalThis.fetch,
        attempts: 3,
        timeoutMilliseconds: 30_000,
        signal: undefined,
        progress: undefined,
      },
      async () => new TreeSitterAssets().bytes(grammar),
    );
  }

  /** Creates a disposable runtime cache and supplies only catalog-pinned bytes as its controlled transport. */
  export async function run<T>(closure: () => Promise<T>): Promise<T> {
    const grammars = await new TreeSitterAssets().list();
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
      join(tmpdir(), `evidence-parser-test-${randomUUID()}`),
      {},
      async (cacheDirectory) =>
        TreeSitterAssetScope.run(
          { cacheDirectory, fetch: fetchFixture },
          closure,
        ),
    );
  }
}
