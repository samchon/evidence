import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/adapters/markdown/EvidenceMarkdownAdapter";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Syntax examples cannot create headings or annotations, while real HTML comments can. */
export async function test_markdown_boundaries(): Promise<void> {
  const content = dedent`
    # Visible

    ~~~~markdown
    ## Fenced heading
    <!-- @evidence docs/fake.md#fenced This is an example. -->
    ~~~~

    \`<!-- @evidence docs/fake.md#inline This is inline code. -->\`

    <pre>
    ## Rendered heading
    @evidence docs/fake.md#pre This is rendered code.
    </pre>

    const example={\`
    ## MDX heading
    @evidence docs/fake.md#mdx This is rendered code.
    \`}

        <pre> This indented example does not open a rendered block.

    <!--
      ## Comment heading
      @evidence docs/spec.md#rule Implements the visible <pre> section.
    -->

    ## Real child
  `;
  const inventory = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create("guide.md", content),
  );

  TestValidator.equals(
    "only real headings materialize",
    inventory.units.map((unit) => unit.name).sort(compare),
    ["Real child", "Visible", "guide.md"],
  );
  TestValidator.equals(
    "only the real HTML annotation is parsed",
    inventory.declarations.map((entry) => entry.target),
    ["docs/spec.md#rule"],
  );
  TestValidator.equals(
    "example annotations stay silent",
    inventory.diagnostics,
    [],
  );
}

function compare(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}
