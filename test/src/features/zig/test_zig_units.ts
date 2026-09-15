import {
  EvidAccessor,
  EvidInventory,
  EvidZigAdapter,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Extracts Zig units with independent public, alias, and file ownership.
 *
 * Explicit fields, aliases, private owners, and same-name files must not collapse into one public identity.
 *
 * 1. Analyze declarations spanning those ownership boundaries.
 * 2. Verify exact units, parents, aliases, and addresses.
 */
export async function test_zig_units(): Promise<void> {
  const inventory = await new EvidZigAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/Contract.zig",
        dedent`
      const @"Internal" = struct {
        value: i32,
        pub fn run() i32 { return 1; }
        const secret = 2;
      };
      pub const Contract: type = Internal;
      pub const Alias = Contract;
      pub const State = enum(u8) { ready, stopped, _ };
      pub const Result = union(enum) { value: i32, empty: void };
      pub const Handle = opaque { const privateValue = 1; };
      pub const Error = error{Missing, Invalid};
      pub const Count = u32;
      pub var count: i32 = 1;
      const scalar = 1;
      pub const copied = scalar;
      pub fn generic(comptime T: type, value: T) i32 { return 1; }
      const hidden = struct { pub const child = 1; };
      fn privateFunction() void {}
    `,
        ["src/Contract.zig", "alias/Contract.zig"],
      ),
      TestSourceSnapshot.create(
        "other/Contract.zig",
        "pub const State = enum { other };",
      ),
    ]),
  );

  TestValidator.equals(
    "complete public Zig inventory",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "exact selectors and identities",
    inventory.units
      .map((unit) => `${unit.symbol}:${EvidAccessor.format(unit.identity)}`)
      .sort((left, right) => left.localeCompare(right)),
    [
      "type:Internal",
      "property:Internal.value",
      "function:Internal.run",
      "type:State",
      "property:State.ready",
      "property:State.stopped",
      "type:Result",
      "property:Result.value",
      "property:Result.empty",
      "type:Handle",
      "type:Error",
      "property:Error.Missing",
      "property:Error.Invalid",
      "type:Count",
      "property:count",
      "property:copied",
      "function:generic",
      "type:State",
      "property:State.other",
    ].sort((left, right) => left.localeCompare(right)),
  );
  const graph = new EvidInventory([inventory]);
  const selected = inventory.units.map((unit) => unit.id);
  for (const name of ["Contract", "Alias"])
    TestValidator.equals(
      `${name} exposes canonical field`,
      graph.resolve(
        { file: "/project/alias/Contract.zig", segments: [name, "value"] },
        selected,
      ).status,
      "resolved",
    );
  TestValidator.equals(
    "private spelling stays hidden",
    graph.resolve(
      { file: "/project/src/Contract.zig", segments: ["Internal"] },
      selected,
    ).status,
    "missing",
  );
  TestValidator.equals(
    "private owner descendants stay absent",
    graph.resolve(
      { file: "/project/src/Contract.zig", segments: ["hidden", "child"] },
      selected,
    ).status,
    "missing",
  );
  TestValidator.equals(
    "separate physical files retain distinct State identities",
    new Set(
      inventory.units
        .filter((unit) => unit.name === "State")
        .map((unit) => unit.id),
    ).size,
    2,
  );
  const root = inventory.units.find((unit) => unit.name === "Internal");
  if (root === undefined) throw new Error("Missing aliased canonical type.");
  TestValidator.equals(
    "alias declarations retain source sites",
    root.sites.length,
    3,
  );
  TestValidator.equals(
    "members keep their canonical parent",
    inventory.units
      .filter(
        (unit) => unit.identity[0] === "Internal" && unit.identity.length === 2,
      )
      .map((unit) => unit.parentId),
    [root.id, root.id],
  );
}
