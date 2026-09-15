import { EvidenceSwiftAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Rejects Swift surfaces with unavailable ownership or compiler expansion.
 *
 * These boundaries must remain incomplete rather than reduce the selected
 * population.
 *
 * 1. Analyze each unsupported source boundary.
 * 2. Verify incomplete diagnostics and failed-source handling.
 */
export async function test_swift_boundaries(): Promise<void> {
  const adapter = new EvidenceSwiftAdapter();
  const cases = new Map<string, string>([
    [
      "extension External { public func run() {} }",
      "swift-extension-ownership",
    ],
    [
      "public struct Local {}\npublic extension Local where Value: P { func run() {} }",
      "swift-constrained-extension",
    ],
    ["@MyMacro public struct Generated {}", "swift-attribute-expansion"],
    [
      'public macro generated() = #externalMacro(module: "X", type: "Y")',
      "swift-macro",
    ],
    [
      dedent`
      #if DEBUG
      public func debug() {}
      #else
      public func release() {}
      #endif
    `,
      "swift-conditional-compilation",
    ],
    ["public struct Malformed {", "swift-parse-incomplete"],
    ["public struct Synthesized: Codable {}", "swift-conformance-expansion"],
    [
      "public struct Local {}\nextension Local: ExternalProtocol {}",
      "swift-conformance-expansion",
    ],
  ]);
  for (const [source, code] of cases) {
    const inventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("src/Boundary.swift", source),
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
          diagnostic.code === code &&
          diagnostic.severity === "error" &&
          diagnostic.repair.length > 0,
      ),
    );
  }
  const sourceFailure = await adapter.analyze(
    EvidenceTestSourceSnapshot.fail(
      EvidenceTestSourceSnapshot.create(
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
    EvidenceTestSourceSnapshot.create(
      "src/Contract.kt",
      "public struct Present {}",
    ),
  );
  TestValidator.equals(
    "configured language does not guess another source spelling",
    wrongExtension.complete,
    false,
  );
  const internalOwner = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create("src/Owner.swift", "struct Internal {}"),
      EvidenceTestSourceSnapshot.create(
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
