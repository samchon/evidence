import {
  EvidenceAccessor,
  EvidenceInventory,
  EvidenceLuaAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Establishes module ownership, literal aliases, colon methods, scalar copies, and file isolation. */
export async function test_lua_units(): Promise<void> {
  const snapshot = TestSourceSnapshot.create(
    "src/contract.lua",
    dedent`
    local hidden = 0
    local M = { value = 1, absent = nil, nested = { ["a.b"] = false } }
    local alias = M
    local function run(x) return x end
    alias.run = run
    alias.again = run
    function M:method(x) return x end
    alias.copy = M.value
    function globalFunction() return 1 end
    return alias
  `,
    ["src/contract.lua", "alias/contract.lua"],
  );
  const inventory = await new EvidenceLuaAdapter().analyze(snapshot);

  TestValidator.equals("static module complete", inventory.diagnostics, []);
  TestValidator.equals(
    "exact public denominator",
    inventory.units
      .map((unit) => `${unit.symbol}:${EvidenceAccessor.format(unit.identity)}`)
      .sort(),
    [
      "property:module",
      "property:module.value",
      "property:module.nested",
      'property:module.nested["a.b"]',
      "function:module.run",
      "function:module.method",
      "property:module.copy",
      "function:globalFunction",
    ].sort(),
  );
  const selected = inventory.units.map((unit) => unit.id);
  const graph = new EvidenceInventory([inventory]);
  const primary = graph.resolve(
    { file: "/project/src/contract.lua", segments: ["module", "run"] },
    selected,
  );
  TestValidator.equals(
    "function alias retains identity",
    graph.resolve(
      { file: "/project/alias/contract.lua", segments: ["module", "again"] },
      selected,
    ),
    primary,
  );
  TestValidator.equals(
    "all undocumented public values retain hosts",
    inventory.hosts.length,
    8,
  );
  const nested = inventory.units.find((unit) => unit.name === "a.b");
  TestValidator.equals(
    "literal owner is explicit",
    nested?.parentId,
    inventory.units.find((unit) => unit.identity.join(".") === "module.nested")
      ?.id,
  );
  TestValidator.equals(
    "local name is not exported",
    graph.resolve(
      { file: "/project/src/contract.lua", segments: ["M"] },
      selected,
    ).status,
    "missing",
  );
  const files = await new EvidenceLuaAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create("first.lua", "function run() end"),
      TestSourceSnapshot.create("second.lua", "function run() end"),
    ]),
  );
  TestValidator.equals(
    "same name in different files remains distinct",
    new Set(files.units.map((unit) => unit.id)).size,
    2,
  );
}
