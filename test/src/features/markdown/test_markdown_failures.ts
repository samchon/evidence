import { EvidenceMarkdownAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Retains Markdown path and discovery failures without losing independent
 * diagnostics.
 *
 * A source spelling can fail to form a public Markdown address even when the
 * physical content is readable, and a source-read failure must keep parsing
 * diagnostics visible.
 *
 * 1. Analyze a whitespace-containing source path and require no units plus its
 *    path diagnostic.
 * 2. Analyze that physical file through invalid and valid aliases:
 *
 *    - Keep the valid address for both physical entries.
 *    - Retain the invalid alias diagnostic.
 * 3. Combine a failed source snapshot with malformed heading syntax and require
 *    incomplete status with both diagnostic classes.
 */
export async function test_markdown_failures(): Promise<void> {
  const adapter = new EvidenceMarkdownAdapter();

  const whitespace = await adapter.analyze(
    EvidenceTestSourceSnapshot.create("docs/space name.md", "# Contract"),
  );
  TestValidator.equals("unaddressable file has no units", whitespace.units, []);
  TestValidator.equals(
    "unaddressable path diagnostic",
    whitespace.diagnostics.map((diagnostic) => diagnostic.code),
    ["markdown-path"],
  );

  // A valid alias preserves the physical unit while every invalid alias remains visible.
  const aliases = await adapter.analyze(
    EvidenceTestSourceSnapshot.create("physical.md", "# Contract", [
      "docs/space name.md",
      "docs/contract.md",
    ]),
  );
  TestValidator.equals(
    "valid alias addresses",
    aliases.addresses.map((address) => address.file),
    ["/project/docs/contract.md", "/project/docs/contract.md"],
  );
  TestValidator.equals(
    "invalid alias still reported",
    aliases.diagnostics.map((diagnostic) => diagnostic.code),
    ["markdown-path"],
  );

  const incomplete = await adapter.analyze(
    EvidenceTestSourceSnapshot.fail(
      EvidenceTestSourceSnapshot.create("guide.md", "##"),
      {
        code: "path-unreadable",
        path: "/project/missing.md",
        message: "The selected Markdown source could not be read.",
      },
    ),
  );
  TestValidator.equals(
    "source failure remains incomplete",
    incomplete.complete,
    false,
  );
  TestValidator.equals(
    "source and syntax diagnostics survive together",
    incomplete.diagnostics.map((diagnostic) => diagnostic.code),
    ["inventory-incomplete", "markdown-heading", "source-path-unreadable"],
  );
}
