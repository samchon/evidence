import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { ConfigDependencyScanner } from "../../../../packages/evidence/src/internal/ConfigDependencyScanner";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Keeps config dependency discovery complete by accepting static and refusing computed imports. */
export async function test_watch_config_dependencies(): Promise<void> {
  const location = join(__dirname, `config dependencies ${randomUUID()}`);
  await TestFileSystem.experiment(
    location,
    {
      "helper.ts": `export const files = ["src/**/*.ts"];\n`,
      "package.json": JSON.stringify({ type: "commonjs" }),
      "evidence.config.ts": dedent`
        import { files } from "./helper";

        export default { claims: [], files };
      `,
    },
    async (directory) => {
      // Static local imports contribute their exact resolved source file.
      const scanner = new ConfigDependencyScanner(
        join(directory, "evidence.config.ts"),
      );
      const dependencies = await scanner.scan();
      TestValidator.predicate(
        "static helper discovered",
        dependencies.some(
          (dependency) =>
            dependency.path.replaceAll("\\", "/") ===
            join(directory, "helper.ts").replaceAll("\\", "/"),
        ),
      );
      TestValidator.predicate(
        "module scope discovered",
        dependencies.some(
          (dependency) =>
            dependency.path.replaceAll("\\", "/") ===
            join(directory, "package.json").replaceAll("\\", "/"),
        ),
      );

      // A computed runtime dependency cannot silently produce an incomplete watch set.
      await TestFileSystem.save(directory, {
        "evidence.config.ts": dedent`
          const specifier = "./helper";
          const settings = require(specifier);

          export default settings;
        `,
      });
      await TestValidator.error("computed config dependency", async () => {
        await new ConfigDependencyScanner(
          join(directory, "evidence.config.ts"),
        ).scan();
      });
    },
  );
}
