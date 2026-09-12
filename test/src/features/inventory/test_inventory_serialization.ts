import { TestValidator } from "@nestia/e2e";

import { EvidenceInventory } from "../../../../packages/evidence/src/EvidenceInventory";
import { TestInventory } from "../../internal/TestInventory";

/** Input ordering changes neither the serialized inventory nor the separation between reviews and evidence. */
export async function test_inventory_serialization(): Promise<void> {
  const input = TestInventory.create();
  TestInventory.unit(
    input,
    "box",
    ["Box"],
    "type",
    "export class Box { value = 1; }",
  );
  const host = TestInventory.host(
    input,
    "box-doc",
    "box-site",
    ["box"],
    "/** Class documentation. */",
  );
  input.reviews.push({
    id: "review",
    hostId: host.id,
    reviews: "evidence",
    target: "docs/spec.md#rule",
    description: "Checked the contract.",
    location: { file: host.file, range: host.range },
  });
  input.diagnostics.push({
    code: "unattached-tag",
    severity: "error",
    message: "A tag needs an owner.",
    repair: "Attach it to the intended declaration.",
    location: { file: host.file },
  });
  const second = structuredClone(input);
  second.addresses.push({
    unitId: "box",
    file: "/project/barrel.ts",
    segments: ["Alias"],
  });
  // Content ranges form a set; ordering or repeated ranges must not create a conflict.
  const originalUnit = input.units[0];
  const repeatedUnit = second.units[0];
  if (originalUnit === undefined || repeatedUnit === undefined)
    throw new Error("Missing fixture declaration.");
  const originalSite = originalUnit.sites[0];
  const repeatedSite = repeatedUnit.sites[0];
  if (originalSite === undefined || repeatedSite === undefined)
    throw new Error("Missing fixture declaration site.");
  const body = TestInventory.range(input, "value = 1");
  originalSite.content.push(body);
  repeatedSite.content = [body, ...repeatedSite.content, body];

  const forward = new EvidenceInventory([input, second]);
  const reverse = new EvidenceInventory([second, input]);

  TestValidator.equals(
    "deterministic serialization",
    forward.serialize(),
    reverse.serialize(),
  );
  TestValidator.equals(
    "reviews cannot add acknowledgements",
    forward.snapshot().declarations,
    [],
  );
  TestValidator.equals(
    "review retained independently",
    forward.snapshot().reviews.length,
    1,
  );
  TestValidator.equals(
    "tag problems preserve complete denominator",
    forward.select(["box"]).units.length,
    1,
  );
  TestValidator.predicate(
    "tag problems are not load failures",
    forward.snapshot().complete,
  );

  // A duplicate range with wrong original coordinates cannot disappear during merging.
  const invalid = structuredClone(second);
  for (const unit of invalid.units)
    for (const site of unit.sites)
      for (const range of site.content)
        if (range.start.offset === body.start.offset) range.start.line += 1;
  TestValidator.predicate(
    "conflicting content coordinates fail",
    !new EvidenceInventory([input, invalid]).snapshot().complete,
  );
}
