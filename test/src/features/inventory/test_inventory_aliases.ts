import { TestValidator } from "@nestia/e2e";

import { EvidenceInventory } from "../../../../packages/evidence/src/EvidenceInventory";
import { TestInventory } from "../../internal/TestInventory";

/** Multiple module-qualified exports keep one obligation while preserving unrelated homonyms. */
export async function test_inventory_aliases(): Promise<void> {
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
    "other",
    ["Other"],
    "type",
    "export interface Box { extra: string; }",
  );
  input.addresses.push({
    unitId: "box",
    file: "/project/barrel.ts",
    segments: ["Renamed"],
  });
  input.addresses.push({
    unitId: "box",
    file: "/project/barrel.ts",
    segments: ["Again"],
  });

  const index = new EvidenceInventory([input, structuredClone(input)]);
  const population = index.select(["box", "box"]);

  TestValidator.predicate("complete identity inventory", population.complete);
  TestValidator.equals(
    "aliases owe once",
    population.units.map((unit) => unit.id),
    ["box"],
  );
  TestValidator.equals(
    "renamed export resolves",
    index
      .resolve({ file: "/project/barrel.ts", segments: ["Renamed"] }, ["box"])
      .units.map((unit) => unit.id),
    ["box"],
  );
  TestValidator.equals(
    "no global-name fallback",
    index.resolve({ file: "/project/absent.ts", segments: ["Box"] }, ["box"])
      .status,
    "missing",
  );
  TestValidator.equals(
    "address case stays significant",
    index.resolve({ file: "/project/Barrel.ts", segments: ["Renamed"] }, [
      "box",
    ]).status,
    "missing",
  );

  // Two distinct identities under one public address remain ambiguous.
  input.addresses.push({
    unitId: "other",
    file: "/project/barrel.ts",
    segments: ["Renamed"],
  });
  const ambiguous = new EvidenceInventory([input]).resolve(
    { file: "/project/barrel.ts", segments: ["Renamed"] },
    ["box", "other"],
  );
  TestValidator.equals(
    "distinct declarations are not merged by name",
    ambiguous.status,
    "ambiguous",
  );

  // Snapshot and source-input edits cannot mutate a previously constructed index.
  population.units.splice(0);
  input.units.splice(0);
  index.snapshot().units.splice(0);
  TestValidator.equals(
    "immutable inventory ownership",
    index.select(["box"]).units.length,
    1,
  );
}
