import { EvidenceMarkdownAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Excludes Markdown syntax examples from heading and annotation discovery.
 *
 * Fence, inline-code, rendered-code, MDX-template, indentation, and comment
 * regions may contain realistic Evidence syntax without declaring a public unit or host.
 *
 * 1. Analyze one visible heading plus heading and annotation syntax in each excluded region.
 * 2. Verify only the visible heading and real child materialize as section units.
 * 3. Verify only the real HTML comment declares its Evidence target.
 * 4. Require no diagnostics from the ignored examples.
 */
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
