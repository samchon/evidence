import { EvidenceParser } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestParserError } from "../../internal/EvidenceTestParserError";

/**
 * Rejects partial syntax and unsupported queries without losing parser
 * recoverability.
 *
 * Extraction must not treat a repaired syntax tree or an unevaluated query
 * predicate as a complete public population. A one-slot parser makes leaked
 * capacity observable while later valid requests verify recovery.
 *
 * 1. Parse malformed declarations and a function missing its closing brace:
 *
 *    - Both reject as parse-incomplete before any extraction callback runs.
 *    - Active capacity returns to zero after the failures.
 * 2. Reject an unknown node query, an external predicate, and a property predicate
 *    as query-invalid instead of returning unfiltered or incomplete captures.
 * 3. Run a supported equality predicate on valid source and require only `answer`;
 *    repeated captures and grouped matches must agree within the same session.
 * 4. Parse empty valid source and require zero named children, distinguishing a
 *    healthy empty result from the preceding syntax and query failures.
 */
export async function test_parser_failures(): Promise<void> {
  const parser = new EvidenceParser({ concurrency: 1 });
  let callbacks = 0;

  try {
    // Both explicit ERROR nodes and a parser-inserted closing brace must fail extraction.
    for (const content of ["export const = ;", "export function compute() {"])
      await EvidenceTestParserError.expect("parse-incomplete", () =>
        parser.parse(
          { type: "typescript", file: "broken.ts", content },
          () => ++callbacks,
        ),
      );

    TestValidator.equals("no partial extraction", callbacks, 0);
    TestValidator.equals(
      "failed parses release capacity",
      parser.state().active,
      0,
    );

    for (const query of [
      "(this_node_does_not_exist) @name",
      "((identifier) @name (#external? @name))",
      "((identifier) @name (#is? public))",
    ])
      await EvidenceTestParserError.expect("query-invalid", () =>
        parser.parse(
          {
            type: "typescript",
            file: "valid.ts",
            content: "export const answer = 42;",
          },
          (session) => session.captures(query).length,
        ),
      );

    // A supported predicate filters captures; repeated queries reuse only this session's cache.
    const names = await parser.parse(
      {
        type: "typescript",
        file: "valid.ts",
        content: "export const answer = 42, other = 0;",
      },
      (session) => {
        const query = '((identifier) @name (#eq? @name "answer"))';
        const first = session
          .captures(query)
          .map((capture) => capture.node.text);
        const second = session
          .matches(query)
          .flatMap((match) =>
            match.captures.map((capture) => capture.node.text),
          );
        TestValidator.equals("repeated query", second, first);
        return first;
      },
    );

    TestValidator.equals("valid query after failures", names, ["answer"]);
    const empty = await parser.parse(
      { type: "typescript", file: "empty.ts", content: "" },
      (session) => session.root.namedChildCount,
    );
    TestValidator.equals("healthy empty source", empty, 0);
  } finally {
    await parser.close();
  }
}
