import { EvidenceInventory } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TestInventory } from "../../internal/TestInventory";

/**
 * Merges physical aliases while retaining every public address and citation origin.
 *
 * Independent populations may discover one inode through different hard-link
 * spellings. The merged inventory must avoid duplicate units and hosts without
 * choosing relative citation behavior according to whichever input arrived first.
 *
 * 1. Clone a declaration and its host under another physical-path spelling while
 *    retaining the same source identity, then merge both input orders.
 * 2. Require complete, identical serialization with one source, one selected unit,
 *    and one host whose origins contain both logical paths.
 * 3. Resolve both the original and alias public addresses successfully.
 * 4. Change a source identity at the same path while keeping its content and
 *    require incomplete analysis, exposing replacement between snapshots.
 */
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
