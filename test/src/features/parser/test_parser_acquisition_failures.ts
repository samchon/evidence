import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestValidator } from "@nestia/e2e";
import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserError } from "../../internal/TestParserError";

/** Rejects invalid downloads, bounds transient retries, and permits later recovery without retaining a failed promise. */
export async function test_parser_acquisition_failures(): Promise<void> {
  const grammar = await new TreeSitterAssets().grammar("python");
  const pinned = Uint8Array.from(await TestParserAssets.bytes(grammar));
  await TestFileSystem.experiment(
    join(__dirname, `acquisition-${randomUUID()}`),
    {},
    async (cacheDirectory) => {
      let requests = 0;
      let mode = "unavailable";
      const assets = new TreeSitterAssets({
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
