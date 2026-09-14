import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestValidator } from "@nestia/e2e";
import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestParserError } from "../../internal/TestParserError";
import { TestSignal } from "../../internal/TestSignal";

/** Cancelling one subscriber preserves a shared transfer, while body deadlines bound abandoned network waits. */
export async function test_parser_acquisition_cancellation(): Promise<void> {
  const grammar = await new TreeSitterAssets().grammar("python");
  const pinned = Uint8Array.from(await TestParserAssets.bytes(grammar));
  await TestFileSystem.experiment(
    join(__dirname, `cancel-${randomUUID()}`),
    {},
    async (cacheDirectory) => {
      const release = new TestSignal();
      const joined = new TestSignal();
      const cancellation = new AbortController();
      let requests = 0;
      let transferAborted = false;
      async function transfer(
        _input: string | URL | Request,
        init?: RequestInit,
      ): Promise<Response> {
        ++requests;
        await release.wait;
        transferAborted = init?.signal?.aborted ?? false;
        return new Response(pinned);
      }
      const first = new TreeSitterAssets({
        cacheDirectory,
        fetch: transfer,
        signal: cancellation.signal,
      });
      const second = new TreeSitterAssets({
        cacheDirectory,
        fetch: transfer,
        progress: () => joined.open(),
      });
      const cancelled = TestParserError.expect("asset-cancelled", () =>
        first.bytes(grammar),
      );
      const survivor = second.bytes(grammar);
      try {
        await joined.wait;
        cancellation.abort();
        await cancelled;
        release.open();
        TestValidator.equals(
          "other subscriber receives verified bytes",
          (await survivor).length,
          pinned.length,
        );
        TestValidator.equals("one shared transfer", requests, 1);
        TestValidator.equals(
          "shared transfer not aborted",
          transferAborted,
          false,
        );
      } finally {
        release.open();
        await Promise.allSettled([cancelled, survivor]);
      }

      // A timeout aborts the transport and retries only the configured finite number of times.
      let timeouts = 0;
      const timed = new TreeSitterAssets({
        cacheDirectory: join(cacheDirectory, "timeout"),
        attempts: 2,
        timeoutMilliseconds: 10,
        fetch: async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (signal === undefined || signal === null) {
              reject(new Error("Expected a bounded transfer signal."));
              return;
            }
            function abort(): void {
              ++timeouts;
              reject(new Error("timeout"));
            }
            if (signal.aborted) abort();
            else signal.addEventListener("abort", abort, { once: true });
          }),
      });
      await TestParserError.expect("asset-download", () =>
        timed.bytes(grammar),
      );
      TestValidator.equals("bounded timeout attempts", timeouts, 2);
    },
  );
}
