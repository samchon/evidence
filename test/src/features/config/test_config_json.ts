import { TestValidator } from "@nestia/e2e";
import { EvidenceConfigLoader, EvidenceCommand } from "@wrtnlabs/evidence";
import type { IEvidenceConfig } from "@wrtnlabs/evidence";
import assert from "node:assert/strict";
import { join } from "node:path";

import { ConfigDependencyScanner } from "../../../../packages/evidence/src/internal/ConfigDependencyScanner";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Loads equivalent JSON and TS plans, rejects malformed formats, and treats JSON strings as data. */
export async function test_config_json(): Promise<void> {
  const config: IEvidenceConfig = {
    claims: [
      {
        name: "require('./missing-module')",
        type: "markdown",
        files: ["source.md"],
        reference: { type: "markdown", files: ["target.md"] },
      },
    ],
  };
  await TestFileSystem.experiment(
    "json-config",
    {
      "evidence.json": JSON.stringify(config),
      "evidence.config.ts": `export default ${JSON.stringify(config)};`,
      "evidence.yaml": JSON.stringify(config),
      "evidence.yml": JSON.stringify(config),
      "broken.json": "{",
    },
    async (directory) => {
      const json = join(directory, "evidence.json");
      const fromJson = await EvidenceConfigLoader.plan(json);
      const fromTs = await EvidenceConfigLoader.plan(
        join(directory, "evidence.config.ts"),
      );
      TestValidator.equals(
        "equivalent active claims",
        fromJson.claims,
        fromTs.claims,
      );
      TestValidator.equals("JSON config anchoring", fromJson.configFile, json);

      const dependencies = await new ConfigDependencyScanner(json).scan();
      TestValidator.predicate(
        "JSON strings are not imports",
        dependencies.every((entry) => !entry.path.includes("missing-module")),
      );
      for (const name of ["evidence.yaml", "evidence.yml", "broken.json"])
        await assert.rejects(() =>
          EvidenceConfigLoader.plan(join(directory, name)),
        );

      // Initialization creates usable JSON and refuses extensions and existing destinations.
      const created = join(directory, "created.json");
      await EvidenceCommand.initialize(created);
      await EvidenceConfigLoader.plan(created);
      await assert.rejects(() => EvidenceCommand.initialize(created));
      await assert.rejects(() =>
        EvidenceCommand.initialize(join(directory, "new.yaml")),
      );
      await assert.rejects(() =>
        EvidenceCommand.initialize(join(directory, "new.yml")),
      );
    },
  );
}
