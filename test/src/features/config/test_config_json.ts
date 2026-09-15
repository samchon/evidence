import { TestValidator } from "@nestia/e2e";
import { EvidConfigLoader, EvidCommand } from "evid";
import type { IEvidConfig } from "evid";
import assert from "node:assert/strict";
import { join } from "node:path";

import { EvidConfigDependencyScanner } from "evid";
import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";

/**
 * Preserves JSON configuration semantics through loading, dependency scanning, and initialization.
 *
 * JSON strings must remain data even when they resemble module-loading code.
 * The loader should produce the same claim plan as equivalent TypeScript while
 * rejecting malformed or unsupported formats and refusing destructive initialization.
 *
 * 1. Load matching JSON and TypeScript configurations and require equal active
 *    claims, with the JSON plan anchored to its own absolute configuration path.
 * 2. Scan JSON containing a require-like claim label and require no dependency
 *    on the module name embedded in that string.
 * 3. Reject YAML extensions and malformed JSON during planning.
 * 4. Initialize a new JSON configuration and successfully plan it; reject a second
 *    initialization at the same destination and reject new YAML destinations.
 */
export async function test_config_json(): Promise<void> {
  const config: IEvidConfig = {
    claims: [
      {
        name: "require('./missing-module')",
        type: "markdown",
        files: ["source.md"],
        reference: { type: "markdown", files: ["target.md"] },
      },
    ],
  };
  await EvidTestFileSystem.experiment(
    "json-config",
    {
      "evid.json": JSON.stringify(config),
      "evidence.config.ts": `export default ${JSON.stringify(config)};`,
      "evidence.yaml": JSON.stringify(config),
      "evidence.yml": JSON.stringify(config),
      "broken.json": "{",
    },
    async (directory) => {
      const json = join(directory, "evid.json");
      const fromJson = await EvidConfigLoader.plan(json);
      const fromTs = await EvidConfigLoader.plan(
        join(directory, "evidence.config.ts"),
      );
      TestValidator.equals(
        "equivalent active claims",
        fromJson.claims,
        fromTs.claims,
      );
      TestValidator.equals("JSON config anchoring", fromJson.configFile, json);

      const dependencies = await new EvidConfigDependencyScanner(json).scan();
      TestValidator.predicate(
        "JSON strings are not imports",
        dependencies.every((entry) => !entry.path.includes("missing-module")),
      );
      for (const name of ["evidence.yaml", "evidence.yml", "broken.json"])
        await assert.rejects(() =>
          EvidConfigLoader.plan(join(directory, name)),
        );

      // Initialization creates usable JSON and refuses extensions and existing destinations.
      const created = join(directory, "created.json");
      await EvidCommand.initialize(created);
      await EvidConfigLoader.plan(created);
      await assert.rejects(() => EvidCommand.initialize(created));
      await assert.rejects(() =>
        EvidCommand.initialize(join(directory, "new.yaml")),
      );
      await assert.rejects(() =>
        EvidCommand.initialize(join(directory, "new.yml")),
      );
    },
  );
}
