import { EvidenceParser } from "evidence";
import type { EvidenceParseSession, IEvidenceParserInput } from "evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestParserError } from "../../internal/EvidenceTestParserError";
import { EvidenceTestSignal } from "../../internal/EvidenceTestSignal";

/**
 * Keeps concurrent language trees independent and enforces session node
 * ownership.
 *
 * TypeScript and Python parses run in a two-slot pool and pause while both
 * trees are live. A node can be valid in one session yet still be invalid for
 * another; accepting it would mix source coordinates and grammar state across
 * callbacks.
 *
 * 1. Start both parses and hold their callbacks until two active sessions exist.
 * 2. Pass the second session's root to the first session's query and require a
 *    query-invalid failure while both sessions are still live.
 * 3. Release the callbacks and require the separate identifier results `alpha` and
 *    `beta` in their original request order.
 * 4. Close the parser and require every active slot to be released.
 */
export async function test_parser_concurrent(): Promise<void> {
  const parser = new EvidenceParser({ concurrency: 2 });
  const ready = new EvidenceTestSignal();
  const release = new EvidenceTestSignal();
  const sessions: EvidenceParseSession[] = [];
  const inputs: IEvidenceParserInput[] = [
    {
      type: "typescript",
      file: "alpha.ts",
      content: "export const alpha = 1;",
    },
    { type: "python", file: "beta.py", content: "beta = 2" },
  ];
  const results = Promise.all(
    inputs.map((input) =>
      parser.parse(input, async (session) => {
        sessions.push(session);
        if (sessions.length === 2) ready.open();
        await release.wait;
        return session
          .captures("(identifier) @name")
          .map((capture) => capture.node.text);
      }),
    ),
  );

  try {
    await Promise.race([ready.wait, results]);
    TestValidator.equals(
      "two independent live sessions",
      parser.state().active,
      2,
    );

    const first = sessions[0];
    const second = sessions[1];
    if (first === undefined || second === undefined)
      throw new Error("Both parser callbacks must be active.");
    await EvidenceTestParserError.expect("query-invalid", () =>
      first.captures("(identifier) @name", second.root),
    );

    release.open();
    TestValidator.equals("language-specific contents retained", await results, [
      ["alpha"],
      ["beta"],
    ]);
  } finally {
    release.open();
    await parser.close();
  }

  TestValidator.equals("all sessions released", parser.state().active, 0);
}
