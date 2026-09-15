import { EvidLuaAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Rejects smaller Lua inventories for dynamic exports and recovers on static
 * source.
 *
 * Dynamic module publication cannot pass coverage by omitting unknown exported
 * units.
 *
 * 1. Analyze dynamic exports. 2. Require incompleteness. 3. Analyze a fresh static
 *    snapshot and require recovery.
 */
export async function test_lua_boundaries(): Promise<void> {
  const adapter = new EvidLuaAdapter();
  const cases = [
    'local M = require("dependency")\nreturn M',
    "local M = {}\nsetmetatable(M, {})\nreturn M",
    "local M = {}\nM[key] = 1\nreturn M",
    "return { [key] = 1 }",
    "local M = { x = 1 }\nM.x = nil\nreturn M",
    "local M = { x = 1, x = nil }\nreturn M",
    "local M = {}\nlocal alias = M\nalias[key] = 1\nreturn M",
    "local M = {}\nif flag then M.x = 1 end\nreturn M",
    "local M = {}\nM.self = M\nreturn M",
    "local shared = {}\nreturn { first = { child = shared }, second = { child = shared } }",
    "local M = {}\nfunction M.run() M.x = 1 end\nreturn M",
    "local M = {}\nfunction M:run() self.x = 1 end\nreturn M",
    "local M = {}\nfunction M.run() consume(M) end\nreturn M",
    "local M = {}\nfunction M.run() local alias = M\nalias.x = 1 end\nreturn M",
    "local M = {}\nfunction M.run() local alias\nalias = M\nalias.x = 1 end\nreturn M",
    "local M = {}\nfunction M.run() local M = M\nM.x = 1 end\nreturn M",
    "local M = {}\nlocal function get() return M end\nfunction M.run() local alias = get()\nalias.x = 1 end\nreturn M",
    "local M = {}\nfunction M:run() consume(self) end\nreturn M",
    "function run() function leaked() end end",
    "_ENV = {}\nfunction run() end",
    "local M = { [1] = true }\nreturn M",
    "local M = { true }\nreturn M",
    'local M = { ["a\\x2eb"] = true }\nreturn M',
    "return unknown",
    "return function() end",
    "local x, y = 1, 2\nreturn {}",
  ];
  for (const content of cases) {
    const inventory = await adapter.analyze(
      EvidTestSourceSnapshot.create("module.lua", content),
    );

    TestValidator.equals(
      `incomplete surface: ${content}`,
      inventory.complete,
      false,
    );
    TestValidator.predicate(
      "actionable boundary",
      inventory.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "lua-dynamic-surface" &&
          diagnostic.repair.length !== 0 &&
          diagnostic.location?.range !== undefined,
      ),
    );
  }
  const repaired = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "module.lua",
      "function run(x) local t = {}\nt.x = 1\nx = 2\nreturn x end",
    ),
  );
  TestValidator.equals(
    "private body state does not change exports",
    repaired.diagnostics,
    [],
  );
  TestValidator.equals("fresh static recovery", repaired.complete, true);
  const reading = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "module.lua",
      "local M = { value = -1 }\nfunction M.run() local value = M.value\nprint(M.value)\nreturn value end\nreturn M",
    ),
  );
  TestValidator.equals(
    "scalar reads do not escape the table",
    reading.diagnostics,
    [],
  );
  const multiline = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "module.lua",
      "local\nfunction hidden() end\nlocal\nvalue = 1\nfunction visible() end",
    ),
  );
  TestValidator.equals(
    "local keyword survives line breaks",
    multiline.units.map((unit) => unit.name),
    ["visible"],
  );
  for (const file of ["module.LUA", "module.txt"]) {
    const unsupported = await adapter.analyze(
      EvidTestSourceSnapshot.create(file, "function run() end"),
    );
    TestValidator.equals(
      "only advertised source spelling is accepted",
      unsupported.complete,
      false,
    );
  }
  const failed = EvidTestSourceSnapshot.create(
    "module.lua",
    "function run() end",
  );
  failed.complete = false;
  failed.diagnostics.push({
    code: "path-unreadable",
    path: "/project/missing.lua",
    message: "Access denied.",
  });
  const inaccessible = await adapter.analyze(failed);
  TestValidator.equals(
    "source failures never pass",
    inaccessible.complete,
    false,
  );
  TestValidator.predicate(
    "source failure is retained",
    inaccessible.diagnostics.some(
      (diagnostic) => diagnostic.message === "Access denied.",
    ),
  );
}
