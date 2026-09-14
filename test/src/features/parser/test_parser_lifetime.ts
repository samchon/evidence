import { TestValidator } from "@nestia/e2e";

import type { EvidenceParseSession } from "../../../../packages/evidence/src/parsers/EvidenceParseSession";
import { EvidenceParser } from "../../../../packages/evidence/src/parsers/EvidenceParser";
import type { IEvidenceParserInput } from "../../../../packages/evidence/src/structures/IEvidenceParserInput";
import { TestParserError } from "../../internal/TestParserError";
import { TestSignal } from "../../internal/TestSignal";

/** Bounds live sessions, releases failed callbacks, and drains accepted work during close. */
export async function test_parser_lifetime(): Promise<void> {
  const parser = new EvidenceParser({ concurrency: 1 });
  const entered = new TestSignal();
  const release = new TestSignal();
  const borrowed: EvidenceParseSession[] = [];
  const expected = new Error("Adapter callback failed.");
  const input: IEvidenceParserInput = {
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
    await TestParserError.expect("session-closed", () =>
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
    await TestParserError.expect("session-closed", () =>
      session.captures("(identifier) @name"),
    );

  // Repeated close is harmless and never reopens the runtime.
  await parser.close();
  TestValidator.predicate("closed remains closed", parser.state().closed);
}
