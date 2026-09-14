import { EvidenceSwiftAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Prevents unavailable ownership and compiler expansion from becoming successful smaller inventories. */
export async function test_swift_boundaries(): Promise<void> {
  const adapter = new EvidenceSwiftAdapter();
  for (const source of [
    "extension External { public func run() {} }",
    "public struct Local {}\npublic extension Local where Value: P { func run() {} }",
    "@MyMacro public struct Generated {}",
    'public macro generated() = #externalMacro(module: "X", type: "Y")',
    dedent`
      #if DEBUG
      public func debug() {}
      #else
      public func release() {}
      #endif
    `,
    "public struct Malformed {",
    "public struct Synthesized: Codable {}",
    "public struct Local {}\nextension Local: ExternalProtocol {}",
  ]) {
    const inventory = await adapter.analyze(
      TestSourceSnapshot.create("src/Boundary.swift", source),
    );
    TestValidator.equals(
      "unsupported source remains incomplete",
      inventory.complete,
      false,
    );
    TestValidator.predicate(
      "incomplete surface has actionable findings",
      inventory.diagnostics.some(
        (diagnostic) =>
          diagnostic.severity === "error" && diagnostic.repair.length > 0,
      ),
    );
  }
  const sourceFailure = await adapter.analyze(
    TestSourceSnapshot.fail(
      TestSourceSnapshot.create(
        "src/Missing.swift",
        "public struct Present {}",
      ),
      {
        code: "path-unreadable",
        path: "/project/src/Missing.swift",
        message: "Source unavailable.",
      },
    ),
  );
  TestValidator.equals(
    "source failure remains incomplete",
    sourceFailure.complete,
    false,
  );
  const wrongExtension = await adapter.analyze(
    TestSourceSnapshot.create("src/Contract.kt", "public struct Present {}"),
  );
  TestValidator.equals(
    "configured language does not guess another source spelling",
    wrongExtension.complete,
    false,
  );
  const internalOwner = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create("src/Owner.swift", "struct Internal {}"),
      TestSourceSnapshot.create(
        "src/Extension.swift",
        "public extension Internal { func exposed() {} }",
      ),
    ]),
  );
  TestValidator.equals(
    "internal owner clamps extension visibility",
    internalOwner.units,
    [],
  );
}
