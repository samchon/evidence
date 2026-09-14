import { TestValidator } from "@nestia/e2e";

import { EvidenceInventory } from "../../../../packages/evidence/src/graph/EvidenceInventory";
import { TestInventory } from "../../internal/TestInventory";

/** Scope closure follows explicit parents and cannot invent ancestry from literal dots. */
export async function test_inventory_scopes(): Promise<void> {
  const input = TestInventory.create();
  TestInventory.unit(
    input,
    "box",
    ["Box"],
    "type",
    "export class Box { value = 1; }",
  );
  TestInventory.unit(
    input,
    "member",
    ["Box", "value.part"],
    "property",
    "value = 1",
    "box",
  );
  TestInventory.unit(
    input,
    "lookalike",
    ["Box", "value"],
    "property",
    "extra: string",
  );
  TestInventory.unit(
    input,
    "other",
    ["Other"],
    "property",
    "export const unrelated = 3;",
  );

  const index = new EvidenceInventory([input]);
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
