import { EvidInventory } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestInventory } from "../../internal/EvidTestInventory";

/**
 * Builds structural scope from explicit parents while preserving literal
 * accessor segments.
 *
 * Public name prefixes are not ownership edges. A selected property with a dot
 * in its literal name must retain its actual parent without making a similarly
 * named unselected declaration or unrelated unit part of the resolvable
 * population.
 *
 * 1. Create Box, its explicit child named value.part, a parentless lookalike named
 *    Box.value, and an unrelated declaration; select only the literal dotted
 *    child.
 * 2. Require the scope closure to contain exactly Box and that selected child.
 * 3. Resolve the literal value.part segment successfully, but reject splitting it
 *    into value and part as a different, missing accessor.
 * 4. Require both the unselected lookalike and the unrelated declaration to remain
 *    missing from lookup within this selected population.
 */
export async function test_inventory_scopes(): Promise<void> {
  const input = EvidTestInventory.create();
  EvidTestInventory.unit(
    input,
    "box",
    ["Box"],
    "type",
    "export class Box { value = 1; }",
  );
  EvidTestInventory.unit(
    input,
    "member",
    ["Box", "value.part"],
    "property",
    "value = 1",
    "box",
  );
  EvidTestInventory.unit(
    input,
    "lookalike",
    ["Box", "value"],
    "property",
    "extra: string",
  );
  EvidTestInventory.unit(
    input,
    "other",
    ["Other"],
    "property",
    "export const unrelated = 3;",
  );

  const index = new EvidInventory([input]);
  const selected = index.select(["member"]);

  TestValidator.equals(
    "actual ancestor closure",
    selected.scopes.map((unit) => unit.id),
    ["box", "member"],
  );
  TestValidator.equals(
    "literal dotted member is addressable",
    index.resolve(
      { file: "/project/source.ts", segments: ["Box", "value.part"] },
      ["member"],
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "literal dot does not split",
    index.resolve(
      { file: "/project/source.ts", segments: ["Box", "value", "part"] },
      ["member"],
    ).status,
    "missing",
  );
  TestValidator.equals(
    "unselected lookalike is not a scope",
    index.resolve({ file: "/project/source.ts", segments: ["Box", "value"] }, [
      "member",
    ]).status,
    "missing",
  );
  TestValidator.equals(
    "unrelated declarations stay outside closure",
    index.resolve({ file: "/project/source.ts", segments: ["Other"] }, [
      "member",
    ]).status,
    "missing",
  );
}
