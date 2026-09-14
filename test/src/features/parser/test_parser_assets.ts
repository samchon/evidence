import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserError } from "../../internal/TestParserError";

/**
 * Shares verified grammar acquisition and repairs corruption in a reusable cache.
 *
 * Grammar bytes must remain immutable across callers, and offline reuse is safe
 * only after verification. The scenario supplies pinned bytes through a controlled
 * fetch implementation and uses a disposable cache to exercise cold and warm paths.
 *
 * 1. Request one cold grammar concurrently from eight callers:
 *    - Require exactly one request to the pinned URL.
 *    - Require complete bytes for every caller and independent returned arrays.
 * 2. Open the warm cache with a fetch implementation that always fails and require
 *    the same bytes without network access.
 * 3. Replace the cached file with corrupt content and require offline acquisition
 *    to fail instead of accepting the damaged entry.
 * 4. Restore network access and require one repair download, successful offline
 *    reuse afterward, and no transient files beside the verified cache entry.
 */
export async function test_parser_assets(): Promise<void> {
  const original = new TreeSitterAssets();
  const grammar = await original.grammar("python");
  const pinned = Uint8Array.from(await TestParserAssets.bytes(grammar));
  const directory = join(__dirname, "assets-" + randomUUID());

  await TestFileSystem.experiment(directory, {}, async (location) => {
    const requests: string[] = [];
    const assets = new TreeSitterAssets({
      cacheDirectory: location,
      fetch: async (input) => {
        requests.push(String(input));
        return new Response(pinned);
      },
    });

    // Independent callers share a single cold transfer and receive owned byte arrays.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => assets.bytes(grammar)),
    );
    TestValidator.equals("one pinned request", requests, [grammar.wasm.url]);
    TestValidator.predicate(
      "all callers receive the complete grammar",
      results.every((bytes) => Buffer.from(bytes).equals(pinned)),
    );
    const first = results[0];
    if (first !== undefined) first.fill(0);
    TestValidator.predicate(
      "callers cannot mutate shared bytes",
      results.slice(1).every((bytes) => Buffer.from(bytes).equals(pinned)),
    );

    // A separate resolver performs no request with verified cache bytes, including no HEAD.
    const offline = new TreeSitterAssets({
      cacheDirectory: location,
      attempts: 1,
      fetch: async () => {
        throw new Error("offline");
      },
    });
    TestValidator.equals(
      "warm offline bytes",
      Array.from(await offline.bytes(grammar)),
      Array.from(pinned),
    );

    // Corruption cannot be accepted offline, and a later network recovery repairs it automatically.
    const destination = join(
      location,
      "grammars-v1",
      `${String(grammar.wasm.sha256)}.wasm`,
    );
    await writeFile(destination, "damaged grammar");
    await TestParserError.expect("asset-download", () =>
      offline.bytes(grammar),
    );
    await assets.bytes(grammar);
    TestValidator.equals("one repair request", requests.length, 2);
    TestValidator.equals(
      "repaired pinned size",
      (await offline.bytes(grammar)).length,
      grammar.wasm.size,
    );
    TestValidator.equals(
      "no transient files remain",
      await readdir(join(location, "grammars-v1")),
      [`${String(grammar.wasm.sha256)}.wasm`],
    );
  });
}
