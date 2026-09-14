import {
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceSwiftAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Resolves Swift extension ownership independently of source order.
 *
 * Extensions preserve protocol implementation ownership through their dependencies.
 *
 * 1. Analyze reordered extensions and owners.
 * 2. Verify ownership, dependencies, and rejected boundaries.
 */
export async function test_swift_extension_ownership(): Promise<void> {
  const sources = [
    TestSourceSnapshot.create(
      "src/Last.swift",
      "public extension Root.Nested { func final() {} }",
    ),
    TestSourceSnapshot.create(
      "src/Middle.swift",
      "public extension Alias { struct Nested {} }",
    ),
    TestSourceSnapshot.create(
      "src/First.swift",
      dedent`
      public struct Root {}
      public typealias Alias = Root
      public protocol Service {
        var value: Int { get }
        func run()
      }
    `,
    ),
    TestSourceSnapshot.create(
      "src/Defaults.swift",
      dedent`
      public extension Service {
        var value: Int { 1 }
        func run() {}
      }
    `,
    ),
  ];
  const adapter = new EvidenceSwiftAdapter();
  const inventory = await adapter.analyze(TestSourceSnapshot.combine(sources));

  TestValidator.equals(
    "extension dependency chain is complete",
    inventory.diagnostics,
    [],
  );
  const root = inventory.units.find(
    (unit) => unit.identity.join(".") === "Root",
  );
  const nested = inventory.units.find(
    (unit) => unit.identity.join(".") === "Root.Nested",
  );
  const final = inventory.units.find((unit) => unit.name === "final");
  TestValidator.equals(
    "nested extension type parent",
    nested?.parentId,
    root?.id,
  );
  TestValidator.equals(
    "third-file function parent",
    final?.parentId,
    nested?.id,
  );
  TestValidator.equals(
    "protocol default property shares requirement",
    inventory.units.find((unit) => unit.name === "value")?.sites?.length,
    2,
  );
  TestValidator.equals(
    "protocol default function shares requirement",
    inventory.units.find((unit) => unit.name === "run")?.sites?.length,
    2,
  );
  const reversed = await adapter.analyze(
    TestSourceSnapshot.combine([...sources].reverse()),
  );
  TestValidator.equals(
    "source order cannot change semantic populations",
    reversed.units
      .map((unit) => unit.id)
      .sort((left, right) => left.localeCompare(right)),
    inventory.units
      .map((unit) => unit.id)
      .sort((left, right) => left.localeCompare(right)),
  );
  if (root === undefined) throw new Error("Missing root type.");
  const changed = await adapter.analyze(
    TestSourceSnapshot.combine(
      sources.map((source) =>
        source.files.some((file) => file.physicalPath.endsWith("Last.swift"))
          ? TestSourceSnapshot.create(
              "src/Last.swift",
              "public extension Root.Nested { func final() { print(1) } }",
            )
          : source,
      ),
    ),
  );
  TestValidator.notEquals(
    "extension edit invalidates original ancestor review",
    EvidenceFingerprint.inspect(inventory, root.id).fingerprint,
    EvidenceFingerprint.inspect(changed, root.id).fingerprint,
  );
  const graph = new EvidenceInventory([inventory]);
  TestValidator.equals(
    "extension declared nested type is resolvable",
    graph.resolve(
      {
        file: "/project/src/Last.swift",
        segments: ["Root", "Nested", "final"],
      },
      inventory.units.map((unit) => unit.id),
    ).status,
    "resolved",
  );

  for (const sources of [
    ["private struct Hidden {}", "extension Hidden { public func run() {} }"],
    [
      "public typealias A = B\npublic typealias B = A",
      "extension A { public func run() {} }",
    ],
    [
      "public struct Duplicate {}",
      "public struct Duplicate {}\nextension Duplicate { public func run() {} }",
    ],
  ]) {
    const rejected = await adapter.analyze(
      TestSourceSnapshot.combine(
        sources.map((content, index) =>
          TestSourceSnapshot.create(`src/Boundary${index}.swift`, content),
        ),
      ),
    );
    TestValidator.equals(
      "unavailable or ambiguous owner is incomplete",
      rejected.complete,
      false,
    );
    TestValidator.predicate(
      "ownership boundary has a diagnostic",
      rejected.diagnostics.some(
        (diagnostic) => diagnostic.code === "swift-extension-ownership",
      ),
    );
  }

  // Explicit public visibility overrides a private extension's member default.
  const overridden = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/Original.swift",
        "public struct Original {}\nprivate extension Original { public struct Nested {} }",
      ),
      TestSourceSnapshot.create(
        "src/PublicNested.swift",
        "public extension Original.Nested { func visible() {} }",
      ),
    ]),
  );
  TestValidator.equals(
    "explicit public nested type remains accessible",
    overridden.diagnostics,
    [],
  );
  TestValidator.predicate(
    "nested extension member is selected",
    overridden.units.some((unit) => unit.name === "visible"),
  );

  // A real type named static cannot silently merge its instance methods with static members.
  const collision = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/Collision.swift",
      "public struct Owner { public struct `static` { public func call() {} }\npublic static func call() {} }",
    ),
  );
  TestValidator.equals(
    "distinct owners cannot collapse through a shared accessor",
    collision.complete,
    false,
  );
  TestValidator.predicate(
    "owner collision is actionable",
    collision.diagnostics.some(
      (diagnostic) => diagnostic.code === "swift-ownership-conflict",
    ),
  );
}
