import { EvidTestParserAssets } from "../../internal/EvidTestParserAssets";
import { TestValidator } from "@nestia/e2e";
import { EvidTreeSitterAssets } from "evid";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";
import { EvidTestParserError } from "../../internal/EvidTestParserError";
import { EvidTestSignal } from "../../internal/EvidTestSignal";

/**
 * Isolates subscriber cancellation while bounding shared acquisition timeouts.
 *
 * Two asset providers can subscribe to one cold transfer. Aborting one caller
 * must not invalidate another caller's bytes, while an unresponsive transport
 * must still terminate after the configured finite retry budget.
 *
 * 1. Join two providers to a transfer held behind a signal, with cancellation
 *    attached only to the first subscriber.
 * 2. Abort the first subscriber and require its asset-cancelled failure, then
 *    release the transfer and check the survivor:
 *
 *    - It receives the complete pinned byte length.
 *    - Exactly one transfer occurred and its transport signal was not aborted.
 * 3. Use a separate empty cache and a transport that waits for abort; configure
 *    two attempts with a short deadline and require asset-download failure
 *    after exactly two timeout aborts.
 */
export async function test_parser_acquisition_cancellation(): Promise<void> {
  const grammar = await new EvidTreeSitterAssets().grammar("python");
  const pinned = Uint8Array.from(await EvidTestParserAssets.bytes(grammar));
  await EvidTestFileSystem.experiment(
    join(__dirname, `cancel-${randomUUID()}`),
    {},
    async (cacheDirectory) => {
      const release = new EvidTestSignal();
      const joined = new EvidTestSignal();
      const cancellation = new AbortController();
      let requests = 0;
      let transferAborted = false;
      /**
       * Holds a shared download until both subscriber paths can be exercised.
       *
       * The captured transport signal distinguishes subscriber cancellation
       * from aborting the underlying request that the surviving caller still
       * needs.
       */
      async function transfer(
        _input: string | URL | Request,
        init?: RequestInit,
      ): Promise<Response> {
        ++requests;
        await release.wait;
        transferAborted = init?.signal?.aborted ?? false;
        return new Response(pinned);
      }
      const first = new EvidTreeSitterAssets({
        cacheDirectory,
        fetch: transfer,
        signal: cancellation.signal,
      });
      const second = new EvidTreeSitterAssets({
        cacheDirectory,
        fetch: transfer,
        progress: () => joined.open(),
      });
      const cancelled = EvidTestParserError.expect("asset-cancelled", () =>
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
      const timed = new EvidTreeSitterAssets({
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
      await EvidTestParserError.expect("asset-download", () =>
        timed.bytes(grammar),
      );
      TestValidator.equals("bounded timeout attempts", timeouts, 2);
    },
  );
}
