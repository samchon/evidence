import { EvidInventory, EvidMarkdownAdapter } from "evid";
import type { IEvidInventory, IEvidUnit } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Materializes the Markdown file and supported ATX heading identities.
 *
 * The adapter must make a file unit and H1 through H4 units without treating
 * Setext headings, code, malformed markers, or H5/H6 headings as public units.
 *
 * 1. Analyze headings with Unicode text, punctuation, explicit anchors, and
 *    duplicate anchors.
 * 2. Verify the supported units:
 *
 *    - Their count, symbols, normalized identities, and parent hierarchy are exact.
 *    - Unsupported heading spellings do not add a unit.
 * 3. Resolve a repeated public anchor and require an ambiguous result while each
 *    duplicate remains a file child.
 * 4. Require an otherwise diagnostic-free inventory.
 */
export async function test_markdown_units(): Promise<void> {
  const content = dedent`
    Setext is ordinary content
    ==========================

    # 계약 명세
    ## Café déjà vu
    ### Punctuation: price & tax! ###
       #### Public title {#fixed.anchor}
    ##### H5 is content
    ###### H6 is content
        # Four-space indentation is code
    #not-an-atx-heading
    ####### H7 is ordinary content
    # First duplicate {#same}
    # Second duplicate {#same}
  `;
  const adapter = new EvidMarkdownAdapter();
  const inventory = await adapter.analyze(
    EvidTestSourceSnapshot.create("docs/guide.custom", content),
  );
  const file = requireUnit(inventory, "file", "docs/guide.custom");
  const first = requireUnit(inventory, "h1", "계약 명세");
  const second = requireUnit(inventory, "h2", "Café déjà vu");
  const third = requireUnit(inventory, "h3", "Punctuation: price & tax!");
  const fourth = requireUnit(inventory, "h4", "Public title");

  TestValidator.equals("public Markdown unit count", inventory.units.length, 7);
  TestValidator.equals(
    "three independent H1 units",
    inventory.units.filter((unit) => unit.symbol === "h1").length,
    3,
  );
  TestValidator.equals(
    "Unicode and explicit anchors",
    [first.identity, second.identity, third.identity, fourth.identity],
    [
      ["계약-명세"],
      ["café-déjà-vu"],
      ["punctuation-price-tax"],
      ["fixed.anchor"],
    ],
  );
  TestValidator.equals("H1 parent", first.parentId, file.id);
  TestValidator.equals("H2 parent", second.parentId, first.id);
  TestValidator.equals("H3 parent", third.parentId, second.id);
  TestValidator.equals("H4 parent", fourth.parentId, third.id);

  // Repeated public anchors remain distinct identities and therefore resolve ambiguously.
  const duplicateIds = inventory.units
    .filter((unit) => unit.identity[0] === "same")
    .map((unit) => unit.id);
  TestValidator.equals("distinct duplicate identities", duplicateIds.length, 2);
  for (const id of duplicateIds) {
    const unit = inventory.units.find((candidate) => candidate.id === id);
    if (unit === undefined) throw new Error(`Missing duplicate unit: ${id}`);
    TestValidator.equals(
      "duplicate remains under file",
      unit.parentId,
      file.id,
    );
  }
  const index = new EvidInventory([inventory]);
  TestValidator.equals(
    "duplicate heading target",
    index.resolve(
      { file: "/project/docs/guide.custom", segments: ["same"] },
      duplicateIds,
    ).status,
    "ambiguous",
  );
  TestValidator.equals("valid unit inventory", inventory.diagnostics, []);
}

function requireUnit(
  inventory: IEvidInventory,
  symbol: IEvidUnit["symbol"],
  name: string,
): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) => candidate.symbol === symbol && candidate.name === name,
  );
  if (unit === undefined)
    throw new Error(`Missing Markdown unit: ${symbol} ${name}`);
  return unit;
}
