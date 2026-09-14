import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceParser } from "../../../../packages/evidence/src/parsers/EvidenceParser";
import type { IParserFixture } from "../../internal/IParserFixture";

/** Parses and queries a real declaration with every shipped grammar, including TSX and external scanners. */
export async function test_parser_grammars(): Promise<void> {
  const fixtures: IParserFixture[] = [
    {
      type: "typescript",
      grammar: "typescript",
      file: "types/Contract.d.ts",
      name: "Contract",
      content: "export interface Contract { value: number; }",
      query: "(interface_declaration name: (type_identifier) @name)",
    },
    {
      type: "typescript",
      grammar: "tsx",
      file: "View.tsx",
      name: "View",
      content: "export const View = () => <div>Contract</div>;",
      query: "(variable_declarator name: (identifier) @name)",
    },
    {
      type: "javascript",
      grammar: "javascript",
      file: "compute.jsx",
      name: "compute",
      content: "export function compute() { return <div />; }",
      query: "(function_declaration name: (identifier) @name)",
    },
    {
      type: "python",
      grammar: "python",
      file: "compute.py",
      name: "compute",
      content: dedent`
        def compute(value):
            return value + 1
      `,
      query: "(function_definition name: (identifier) @name)",
    },
    {
      type: "go",
      grammar: "go",
      file: "compute.go",
      name: "Compute",
      content: dedent`
        package example
        func Compute(value int) int { return value + 1 }
      `,
      query: "(function_declaration name: (identifier) @name)",
    },
    {
      type: "rust",
      grammar: "rust",
      file: "compute.rs",
      name: "compute",
      content: "pub fn compute(value: i32) -> i32 { value + 1 }",
      query: "(function_item name: (identifier) @name)",
    },
    {
      type: "java",
      grammar: "java",
      file: "Contract.java",
      name: "Contract",
      content: "public class Contract { public int value; }",
      query: "(class_declaration name: (identifier) @name)",
    },
    {
      type: "csharp",
      grammar: "c-sharp",
      file: "Contract.cs",
      name: "Contract",
      content: "public class Contract { public int Value { get; set; } }",
      query: "(class_declaration name: (identifier) @name)",
    },
    {
      type: "c",
      grammar: "c",
      file: "compute.c",
      name: "compute",
      content: "int compute(int value) { return value + 1; }",
      query:
        "(function_definition declarator: (function_declarator declarator: (identifier) @name))",
    },
    {
      type: "cpp",
      grammar: "cpp",
      file: "Contract.hpp",
      name: "Contract",
      content: "class Contract { public: int value; };",
      query: "(class_specifier name: (type_identifier) @name)",
    },
    {
      type: "ruby",
      grammar: "ruby",
      file: "contract.rb",
      name: "Contract",
      content: dedent`
        class Contract
          attr_reader :value
        end
      `,
      query: "(class name: (constant) @name)",
    },
  ];
  const parser = new EvidenceParser();

  try {
    // Manifest parity prevents a newly shipped grammar from escaping this behavioral gate.
    TestValidator.equals(
      "every registered grammar has a real fixture",
      (await parser.grammars()).map((grammar) => grammar.id),
      fixtures.map((fixture) => fixture.grammar),
    );
    TestValidator.equals(
      "metadata does not load grammars",
      parser.state().languages,
      [],
    );

    for (const fixture of fixtures) {
      const captures = await parser.parse(fixture, (session) =>
        session.captures(fixture.query).map((capture) => capture.node.text),
      );

      TestValidator.equals(fixture.grammar + " declaration", captures, [
        fixture.name,
      ]);
      TestValidator.equals(
        fixture.grammar + " releases its session",
        parser.state().active,
        0,
      );
    }
  } finally {
    await parser.close();
  }
}
