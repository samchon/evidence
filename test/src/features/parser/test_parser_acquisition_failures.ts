import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestValidator } from "@nestia/e2e";
import { EvidTreeSitterAssets } from "../../../../packages/evidence/src/internal/EvidTreeSitterAssets";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserError } from "../../internal/TestParserError";

/**
 * Rejects unverified grammar downloads and permits recovery on the same provider.
 *
 * Retry policy must distinguish transient transport failures from permanent HTTP
 * and content-integrity failures. Rejected work must leave neither a published
 * cache entry nor a retained promise that prevents a later healthy acquisition.
 *
 * 1. Return HTTP 503 and require asset-download failure after the configured two
 *    attempts; switch to HTTP 404 and require only one additional request.
 * 2. Supply truncated, oversized, and same-sized modified bytes separately:
 *    - Each attempt fails with asset-corrupt.
 *    - No bytes are published in the cache directory.
 *    - Integrity failures are not retried.
 * 3. Switch the same provider to pinned bytes and require successful acquisition
 *    with exactly one additional request.
 */
export async function test_parser_acquisition_failures(): Promise<void> {
  const grammar = await new EvidTreeSitterAssets().grammar("python");
  const pinned = Uint8Array.from(await TestParserAssets.bytes(grammar));
  await TestFileSystem.experiment(
    join(__dirname, `acquisition-${randomUUID()}`),
    {},
    async (cacheDirectory) => {
      let requests = 0;
      let mode = "unavailable";
      const assets = new EvidTreeSitterAssets({
        cacheDirectory,
        attempts: 2,
        fetch: async () => {
          ++requests;
          if (mode === "unavailable")
            return new Response("unavailable", { status: 503 });
          if (mode === "missing")
            return new Response("missing", { status: 404 });
          if (mode === "truncated")
            return new Response(pinned.slice(0, pinned.length - 1));
          if (mode === "oversized")
            return new Response(new Uint8Array(pinned.length + 1));
          if (mode === "modified")
            return new Response(new Uint8Array(pinned.length));
          return new Response(pinned);
        },
      });

      await TestParserError.expect("asset-download", () =>
        assets.bytes(grammar),
      );
      TestValidator.equals("bounded transient attempts", requests, 2);
      mode = "missing";
      await TestParserError.expect("asset-download", () =>
        assets.bytes(grammar),
      );
      TestValidator.equals("permanent HTTP error is not retried", requests, 3);

      for (const invalid of ["truncated", "oversized", "modified"]) {
        mode = invalid;
        await TestParserError.expect("asset-corrupt", () =>
          assets.bytes(grammar),
        );
        TestValidator.equals(
          `${invalid} bytes never published`,
          await readdir(join(cacheDirectory, "grammars-v1")),
          [],
        );
      }
      TestValidator.equals("checksum failures are not retried", requests, 6);
      mode = "healthy";
      TestValidator.equals(
        "same resolver recovers",
        (await assets.bytes(grammar)).length,
        pinned.length,
      );
      TestValidator.equals("one recovery request", requests, 7);
    },
  );
}
