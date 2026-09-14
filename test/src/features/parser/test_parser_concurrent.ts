import { TestValidator } from "@nestia/e2e";

import type { EvidenceParseSession } from "../../../../packages/evidence/src/parsers/EvidenceParseSession";
import { EvidenceParser } from "../../../../packages/evidence/src/parsers/EvidenceParser";
import type { IEvidenceParserInput } from "../../../../packages/evidence/src/structures/IEvidenceParserInput";
import { TestParserError } from "../../internal/TestParserError";
import { TestSignal } from "../../internal/TestSignal";

/** Concurrent languages retain independent trees and reject queries against another session's nodes. */
export async function test_parser_concurrent(): Promise<void> {
  const parser = new EvidenceParser({ concurrency: 2 });
  const ready = new TestSignal();
  const release = new TestSignal();
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
    await TestParserError.expect("query-invalid", () =>
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
