import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/adapters/markdown/EvidenceMarkdownAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Partitions section content without losing deep-heading bodies, fences, or adjacent prose. */
export async function test_markdown_content(): Promise<void> {
  const content = dedent`
    File prelude.
    # Parent
    Parent body.
    ## Child
    Child body.
    #### Leaf
    Leaf body.
    ##### Detail
    Detail body.
    ~~~~text
    code change
    ~~~~
    <!-- @evidence docs/spec.md#leaf Supplies the leaf. -->
    Inline <!-- @evidence docs/spec.md#inline Supplies adjacent prose. --> prose.
    ##
    Unanchored body.
    ### Nested after missing
    Nested body.
  `;
  const inventory = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create("guide.md", content),
  );
  const file = requireUnit(inventory, "file", "guide.md");
  const parent = requireUnit(inventory, "h1", "Parent");
  const child = requireUnit(inventory, "h2", "Child");
  const leaf = requireUnit(inventory, "h4", "Leaf");
  const nested = requireUnit(inventory, "h3", "Nested after missing");

  TestValidator.equals("file owns its prelude", lines(content, file), [
    "File prelude.",
  ]);
  TestValidator.equals(
    "parent owns the anchorless H2 region",
    lines(content, parent),
    ["# Parent", "Parent body.", "##", "Unanchored body."],
  );
  TestValidator.equals(
    "child owns only its direct section",
    lines(content, child),
    ["## Child", "Child body."],
  );
  TestValidator.equals(
    "deep and fenced content stays with H4",
    lines(content, leaf),
    [
      "#### Leaf",
      "Leaf body.",
      "##### Detail",
      "Detail body.",
      "~~~~text",
      "code change",
      "~~~~",
      "Inline <!-- @evidence docs/spec.md#inline Supplies adjacent prose. --> prose.",
    ],
  );
  TestValidator.equals(
    "later H3 belongs to the real H1 ancestor",
    nested.parentId,
    parent.id,
  );
  TestValidator.equals(
    "comment-only lines leave owned content",
    lines(content, leaf).includes(
      "<!-- @evidence docs/spec.md#leaf Supplies the leaf. -->",
    ),
    false,
  );
}

function requireUnit(
  inventory: IEvidenceInventory,
  symbol: IEvidenceUnit["symbol"],
  name: string,
): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) => candidate.symbol === symbol && candidate.name === name,
  );
  if (unit === undefined)
    throw new Error(`Missing Markdown unit: ${symbol} ${name}`);
  return unit;
}

function lines(content: string, unit: IEvidenceUnit): string[] {
  const site = unit.sites[0];
  if (site === undefined)
    throw new Error(`Markdown unit ${unit.id} has no site.`);
  return site.content.map((range) =>
    content.slice(range.start.offset, range.end.offset),
  );
}
