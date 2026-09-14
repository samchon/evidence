import { TestValidator } from "@nestia/e2e";

import { EvidenceParser } from "../../../../packages/evidence/src/parsers/EvidenceParser";
import { TestParserError } from "../../internal/TestParserError";

/** Rejects incomplete syntax and incompatible queries before they can shrink the evidence population. */
export async function test_parser_failures(): Promise<void> {
  const parser = new EvidenceParser({ concurrency: 1 });
  let callbacks = 0;

  try {
    // Both explicit ERROR nodes and a parser-inserted closing brace must fail extraction.
    for (const content of ["export const = ;", "export function compute() {"])
      await TestParserError.expect("parse-incomplete", () =>
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
      await TestParserError.expect("query-invalid", () =>
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
