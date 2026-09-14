import { TestValidator } from "@nestia/e2e";

import { EvidenceInventory } from "../../../../packages/evidence/src/graph/EvidenceInventory";
import { TestInventory } from "../../internal/TestInventory";

/** Shared filesystem identities retain both public paths and one deterministic declaration location. */
export async function test_inventory_physical_aliases(): Promise<void> {
  // Two populations can discover the same inode through different hard-link paths.
  const first = TestInventory.create();
  TestInventory.unit(
    first,
    "box",
    ["Box"],
    "type",
    "export class Box { value = 1; }",
  );
  TestInventory.host(
    first,
    "box-doc",
    "box-site",
    ["box"],
    "/** Class documentation. */",
  );
  const second = structuredClone(first);
  const alias = "/elsewhere/linked.ts";
  for (const source of second.sources) {
    source.physicalPath = alias;
    source.addresses = [
      { absolute: alias, relative: "linked.ts", display: "linked.ts" },
    ];
  }
  for (const unit of second.units)
    for (const site of unit.sites) site.file = alias;
  for (const host of second.hosts) host.file = alias;
  for (const address of second.addresses) address.file = alias;

  const forward = new EvidenceInventory([first, second]);
  const reverse = new EvidenceInventory([second, first]);

  TestValidator.predicate(
    "physical aliases remain complete",
    forward.snapshot().complete,
  );
  TestValidator.equals(
    "scan order cannot choose declaration spelling",
    forward.serialize(),
    reverse.serialize(),
  );
  TestValidator.equals(
    "one physical source",
    forward.snapshot().sources.length,
    1,
  );
  TestValidator.equals(
    "one obligation",
    forward.select(["box"]).units.length,
    1,
  );
  TestValidator.equals("one host", forward.select(["box"]).hosts.length, 1);
  TestValidator.equals(
    "relative citation origins are not overwritten",
    forward.select(["box"]).hosts.flatMap((host) => host.origins ?? []),
    [alias, "/project/source.ts"],
  );
  TestValidator.equals(
    "alias stays addressable",
    forward.resolve({ file: alias, segments: ["Box"] }, ["box"]).status,
    "resolved",
  );
  TestValidator.equals(
    "original stays addressable",
    forward.resolve({ file: "/project/source.ts", segments: ["Box"] }, ["box"])
      .status,
    "resolved",
  );

  // Replacing a file between snapshots is a conflict, even when its bytes match.
  const replaced = structuredClone(first);
  for (const source of replaced.sources) source.id = "replacement-inode";
  TestValidator.predicate(
    "conflicting physical identity fails",
    !new EvidenceInventory([first, replaced]).snapshot().complete,
  );
}
