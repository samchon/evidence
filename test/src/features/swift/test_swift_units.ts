import {
  EvidenceAccessor,
  EvidenceInventory,
  EvidenceSwiftAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Extracts Swift public units with exact ownership.
 *
 * Visibility, overloads, protocols, aliases, and extensions determine public
 * identities.
 *
 * 1. Analyze the supported declaration matrix.
 * 2. Verify units, ownership, and target resolution.
 */
export async function test_swift_units(): Promise<void> {
  const snapshot = EvidenceTestSourceSnapshot.combine([
    EvidenceTestSourceSnapshot.create(
      "src/Contract.swift",
      dedent`
      /// Public contract.
      @available(*, deprecated)
      public struct Contract {
        public private(set) var readable: Int = 0
        var internalValue = 1
        public init(_ value: Int) { readable = value }
        public func run(with value: Int) -> Int { value }
        public func run(_ value: String) -> String { value }
        public subscript(index: Int) -> Int { readable }
        public static func +(lhs: Contract, rhs: Contract) -> Contract { lhs }
        public static var count = 0
        public struct Nested { public let value = 1 }
        private struct Hidden { public let child = 1 }
      }
      public typealias Alias = Contract
      public enum State { case ready, value(Int) }
      public protocol Service {
        associatedtype Value
        var value: Value { get set }
        func call(with value: Value)
        init()
        subscript(index: Int) -> Int { get }
      }
      open class Open { open func act() {} }
      struct Internal { public func hidden() {} }
      fileprivate struct FilePrivate {}
      package struct PackageOnly {}
      private func privateFunction() {}
    `,
      ["src/Contract.swift", "alias/Contract.swift"],
    ),
    EvidenceTestSourceSnapshot.create(
      "src/Additional.swift",
      dedent`
      public extension Alias {
        func more() {}
        private func hidden() {}
      }
      extension Contract {
        func internalExtensionMember() {}
        public func explicitMember() {}
      }
      extension Service {
        func extraInternal() {}
        public func helper() {}
      }
    `,
    ),
  ]);
  const inventory = await new EvidenceSwiftAdapter().analyze(snapshot);

  TestValidator.equals("complete Swift surface", inventory.diagnostics, []);
  TestValidator.equals(
    "exact source-public denominator",
    inventory.units
      .map((unit) => `${unit.symbol}:${EvidenceAccessor.format(unit.identity)}`)
      .sort((left, right) => left.localeCompare(right)),
    [
      "type:Contract",
      "property:Contract.readable",
      "function:Contract.init",
      "function:Contract.run",
      "function:Contract.subscript",
      'function:Contract.static["+"]',
      "property:Contract.static.count",
      "type:Contract.Nested",
      "property:Contract.Nested.value",
      "type:Alias",
      "type:State",
      "property:State.ready",
      "property:State.value",
      "type:Service",
      "type:Service.Value",
      "property:Service.value",
      "function:Service.call",
      "function:Service.init",
      "function:Service.subscript",
      "type:Open",
      "function:Open.act",
      "function:Contract.more",
      "function:Contract.explicitMember",
      "function:Service.helper",
    ].sort((left, right) => left.localeCompare(right)),
  );
  const contract = inventory.units.find((unit) => unit.name === "Contract");
  const run = inventory.units.find((unit) => unit.name === "run");
  const more = inventory.units.find((unit) => unit.name === "more");
  TestValidator.equals(
    "label and signature overload family",
    run?.sites?.length,
    2,
  );
  TestValidator.equals(
    "nominal type and two extension sites",
    contract?.sites?.length,
    3,
  );
  TestValidator.equals(
    "cross-file extension parent",
    more?.parentId,
    contract?.id,
  );
  const graph = new EvidenceInventory([inventory]);
  const selected = inventory.units.map((unit) => unit.id);
  TestValidator.equals(
    "logical source alias",
    graph.resolve(
      {
        file: "/project/alias/Contract.swift",
        segments: ["Contract", "readable"],
      },
      selected,
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "extension uses canonical nominal owner",
    graph.resolve(
      { file: "/project/src/Additional.swift", segments: ["Contract", "more"] },
      selected,
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "type alias remains an independent type unit",
    graph.resolve(
      { file: "/project/src/Contract.swift", segments: ["Alias", "readable"] },
      selected,
    ).status,
    "missing",
  );
  TestValidator.equals(
    "source dependencies cover extension owners",
    inventory.dependencies
      .map((dependency) => dependency.path)
      .sort((left, right) => left.localeCompare(right)),
    ["/project/src/Additional.swift", "/project/src/Contract.swift"],
  );
}
