import {
  EvidAccessor,
  EvidInventory,
  EvidLuaAdapter,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Classifies Lua module ownership, literal aliases, colon methods, scalar copies, and file isolation.
 *
 * Module assignment determines public owners while literal names and physical files retain their boundaries.
 *
 * 1. Analyze module tables and members. 2. Compare symbols and identities. 3. Verify method, alias, copy, and file-isolation behavior.
 */
export async function test_lua_units(): Promise<void> {
  const snapshot = EvidTestSourceSnapshot.create(
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
  const inventory = await new EvidLuaAdapter().analyze(snapshot);

  TestValidator.equals("static module complete", inventory.diagnostics, []);
  TestValidator.equals(
    "exact public denominator",
    inventory.units
      .map((unit) => `${unit.symbol}:${EvidAccessor.format(unit.identity)}`)
      .sort((left, right) => left.localeCompare(right)),
    [
      "property:module",
      "property:module.value",
      "property:module.nested",
      'property:module.nested["a.b"]',
      "function:module.run",
      "function:module.method",
      "property:module.copy",
      "function:globalFunction",
    ].sort((left, right) => left.localeCompare(right)),
  );
  const selected = inventory.units.map((unit) => unit.id);
  const graph = new EvidInventory([inventory]);
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
  const files = await new EvidLuaAdapter().analyze(
    EvidTestSourceSnapshot.combine([
      EvidTestSourceSnapshot.create("first.lua", "function run() end"),
      EvidTestSourceSnapshot.create("second.lua", "function run() end"),
    ]),
  );
  TestValidator.equals(
    "same name in different files remains distinct",
    new Set(files.units.map((unit) => unit.id)).size,
    2,
  );
  const longKey = await new EvidLuaAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "long.lua",
      "return { [ [=[\rname\n\rpart]=] ] = 1 }",
    ),
  );
  TestValidator.equals(
    "long string keys normalize Lua newline sequences",
    longKey.addresses
      .map((address) => address.segments)
      .sort((left, right) => left.length - right.length),
    [["module"], ["module", "name\npart"]],
  );
  TestValidator.equals(
    "long string key stays complete",
    longKey.diagnostics,
    [],
  );
}
