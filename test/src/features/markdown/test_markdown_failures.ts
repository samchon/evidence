import { TestValidator } from "@nestia/e2e";

import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/EvidenceMarkdownAdapter";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Retains discovery failures and diagnoses every source spelling that cannot form a target. */
export async function test_markdown_failures(): Promise<void> {
  const adapter = new EvidenceMarkdownAdapter();

  const whitespace = await adapter.analyze(
    TestSourceSnapshot.create("docs/space name.md", "# Contract"),
  );
  TestValidator.equals("unaddressable file has no units", whitespace.units, []);
  TestValidator.equals(
    "unaddressable path diagnostic",
    whitespace.diagnostics.map((diagnostic) => diagnostic.code),
    ["markdown-path"],
  );

  // A valid alias preserves the physical unit while every invalid alias remains visible.
  const aliases = await adapter.analyze(
    TestSourceSnapshot.create("physical.md", "# Contract", [
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
    TestSourceSnapshot.fail(TestSourceSnapshot.create("guide.md", "##"), {
      code: "path-unreadable",
      path: "/project/missing.md",
      message: "The selected Markdown source could not be read.",
    }),
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
