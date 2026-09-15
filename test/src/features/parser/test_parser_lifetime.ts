import { EvidParser } from "evid";
import type { EvidParseSession, IEvidParserInput } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestParserError } from "../../internal/EvidTestParserError";
import { EvidTestSignal } from "../../internal/EvidTestSignal";

/**
 * Bounds parser sessions and drains accepted work after callback failure and
 * close.
 *
 * A one-slot parser holds its first callback behind a signal while another
 * request queues. Shutdown and callback rejection must release resources
 * without losing already accepted work or allowing callers to reuse borrowed
 * sessions.
 *
 * 1. Hold the first callback, queue a second parse, and require one active and one
 *    waiting request. Mutate the shared request object after submitting the
 *    second.
 * 2. Begin close and require a newly submitted parse to reject as session-closed.
 * 3. Release the first callback and verify that:
 *
 *    - Its original error object propagates unchanged.
 *    - The queued parse drains using the original identifier `answer`.
 *    - Closing finishes with no active or waiting requests.
 * 4. Query a retained session after disposal and require session-closed.
 * 5. Close again and require the runtime to remain closed without failure.
 */
export async function test_parser_lifetime(): Promise<void> {
  const parser = new EvidParser({ concurrency: 1 });
  const entered = new EvidTestSignal();
  const release = new EvidTestSignal();
  const borrowed: EvidParseSession[] = [];
  const expected = new Error("Adapter callback failed.");
  const input: IEvidParserInput = {
    type: "typescript",
    file: "contract.ts",
    content: "export const answer = 42;",
  };

  // Hold one callback so the second request must wait without creating another tree.
  const first = parser.parse(input, async (session) => {
    borrowed.push(session);
    entered.open();
    await release.wait;
    throw expected;
  });
  const observed = first.catch((error: unknown) => error);
  try {
    await Promise.race([entered.wait, first]);

    const second = parser.parse(input, (session) =>
      session
        .captures("(identifier) @name")
        .map((capture) => capture.node.text),
    );
    // A queued parse keeps the submitted bytes even if its caller reuses the request object.
    input.content = "export const replacement = 0;";
    TestValidator.equals("one live session", parser.state().active, 1);
    TestValidator.equals("one queued request", parser.state().waiting, 1);

    const closing = parser.close();
    await EvidTestParserError.expect("session-closed", () =>
      parser.parse(input, (session) => session.root.type),
    );
    release.open();

    TestValidator.predicate(
      "callback failure preserved",
      (await observed) === expected,
    );
    TestValidator.equals("accepted request drains", await second, ["answer"]);
    await closing;
  } finally {
    release.open();
    await parser.close();
  }

  TestValidator.equals("all capacity released", parser.state().active, 0);
  TestValidator.equals("no pending work", parser.state().waiting, 0);
  for (const session of borrowed)
    await EvidTestParserError.expect("session-closed", () =>
      session.captures("(identifier) @name"),
    );

  // Repeated close is harmless and never reopens the runtime.
  await parser.close();
  TestValidator.predicate("closed remains closed", parser.state().closed);
}
