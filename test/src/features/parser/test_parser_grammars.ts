import { EvidParser } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import type { IEvidParserFixture } from "../../internal/IEvidParserFixture";

/**
 * Parses and queries representative declarations across registered language
 * grammars.
 *
 * Metadata alone cannot establish that a pinned WASM grammar can initialize,
 * accept source, and execute a query with the runtime. The fixtures include TSX
 * and languages with external scanners, and copy captured text before sessions
 * end.
 *
 * 1. Construct a parser and require no eagerly initialized languages.
 * 2. For each fixture, parse its declared language and filename, run its
 *    declaration-name query, and require exactly the independently specified
 *    name.
 * 3. After every callback, require zero active sessions so successful extraction
 *    cannot accumulate native parser ownership across the fixture sequence.
 * 4. Close the parser in cleanup, including when an earlier assertion fails.
 */
export async function test_parser_grammars(): Promise<void> {
  const fixtures: IEvidParserFixture[] = [
    {
      type: "objc",
      grammar: "objc",
      file: "Contract.h",
      name: "Contract",
      content: "@interface Contract\n@property int value;\n@end\n",
      query: "(class_interface (identifier) @name)",
    },
    {
      type: "lua",
      grammar: "lua",
      file: "contract.lua",
      name: "run",
      content: "function run() return 1 end",
      query: "(function_declaration name: (identifier) @name)",
    },
    {
      type: "dart",
      grammar: "dart",
      file: "Contract.dart",
      name: "Contract",
      content: "class Contract { int value = 1; }",
      query: "(class_declaration name: (identifier) @name)",
    },
    {
      type: "zig",
      grammar: "zig",
      file: "contract.zig",
      name: "run",
      content: "pub fn run() i32 { return 1; }",
      query: "(function_declaration name: (identifier) @name)",
    },
    {
      type: "php",
      grammar: "php",
      file: "Contract.php",
      name: "Contract",
      content: "<?php class Contract { public int $value = 1; }",
      query: "(class_declaration name: (name) @name)",
    },
    {
      type: "scala",
      grammar: "scala",
      file: "Contract.scala",
      name: "Contract",
      content: "class Contract { val value = 1 }",
      query: "(class_definition name: (identifier) @name)",
    },
    {
      type: "matlab",
      grammar: "matlab",
      file: "Contract.m",
      name: "Contract",
      content: "classdef Contract\nproperties\nvalue\nend\nend\n",
      query: "(class_definition name: (identifier) @name)",
    },
    {
      type: "swift",
      grammar: "swift",
      file: "Contract.swift",
      name: "Contract",
      content: "public struct Contract { public var value = 1 }",
      query: "(class_declaration name: (type_identifier) @name)",
    },
    {
      type: "kotlin",
      grammar: "kotlin",
      file: "Contract.kt",
      name: "Contract",
      content: "class Contract { val value = 1; }\n",
      query: "(class_declaration name: (identifier) @name)",
    },
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
  const parser = new EvidParser();

  try {
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
